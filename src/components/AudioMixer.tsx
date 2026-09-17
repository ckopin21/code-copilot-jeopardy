import { Fragment, useEffect, useState } from 'react';
import { audio } from '../lib/audio';
import { musicGainToSlider, musicSliderToGain } from '../lib/musicVolumePolicy';
import { MusicTrackSelect } from './BackgroundMusicPicker';

export function AudioMixer() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(audio.settings);

  useEffect(() => {
    const sync = () => setSettings({ ...audio.settings });
    window.addEventListener('blue-stage:audio-settings', sync);
    return () => window.removeEventListener('blue-stage:audio-settings', sync);
  }, []);

  const update = (key: 'master' | 'music' | 'effects', value: number) => {
    const storedValue = key === 'music' ? musicSliderToGain(value) : value;
    setSettings((current) => ({ ...current, [key]: storedValue }));
    audio.setSettings({ [key]: storedValue });
  };

  const mute = () => {
    const muted = !audio.settings.muted;
    setSettings((current) => ({ ...current, muted }));
    audio.setSettings({ muted });
  };

  return <Fragment>
    <button type="button" className="nav-button audio-toggle-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{settings.muted ? '🔇 Audio' : '🔊 Audio'}</button>
    {open && <section className="audio-drawer" aria-label="Audio controls">
      <div className="audio-drawer-head"><div><strong>Audio Controls</strong><small>Adjust game music and sound effects.</small></div><button type="button" className="audio-close-button" onClick={() => setOpen(false)} aria-label="Close audio controls">×</button></div>
      <MusicTrackSelect className="audio-music-select" />
      <div className="audio-slider-grid">
        {(['master', 'music', 'effects'] as const).map((key) => {
          const sliderValue = key === 'music' ? musicGainToSlider(settings.music) : settings[key];
          return <label key={key}><span>{key === 'master' ? 'Master' : key === 'music' ? 'Music' : 'Sound Effects'}</span><input type="range" min="0" max="1" step="0.05" value={sliderValue} onChange={(event) => update(key, Number(event.target.value))} /><b>{Math.round(sliderValue * 100)}%</b></label>;
        })}
      </div>
      <button type="button" className="secondary-button audio-mute-button" onClick={mute}>{settings.muted ? 'Unmute All Audio' : 'Mute All Audio'}</button>
    </section>}
  </Fragment>;
}
