import { Fragment, useEffect, useState } from 'react';
import { audio, BACKGROUND_TRACKS, type BackgroundTrackId } from '../lib/audio';
import { MUSIC_GAIN_MAX, musicGainToSlider, musicSliderToGain } from '../lib/musicVolumePolicy';

const MENU_MUSIC_RESTORE_KEY = 'blue-stage-menu-music-before-mute';

function savedMusicRestoreGain(): number {
  try {
    const saved = Number(localStorage.getItem(MENU_MUSIC_RESTORE_KEY));
    if (Number.isFinite(saved) && saved > 0) return Math.min(MUSIC_GAIN_MAX, saved);
  } catch { /* optional preference storage */ }
  return MUSIC_GAIN_MAX * 0.5;
}

export function MusicTrackSelect({ className = '' }: { className?: string }) {
  const [track, setTrack] = useState<BackgroundTrackId>(audio.settings.backgroundTrack);
  const [musicGain, setMusicGain] = useState(audio.settings.music);
  const [globalMuted, setGlobalMuted] = useState(audio.settings.muted);
  const musicMuted = globalMuted || musicGain <= 0;
  const showMenuControls = className.split(/\s+/).includes('menu-music-select');

  useEffect(() => {
    const sync = () => {
      setTrack(audio.settings.backgroundTrack);
      setMusicGain(audio.settings.music);
      setGlobalMuted(audio.settings.muted);
    };
    window.addEventListener('blue-stage:audio-settings', sync);
    return () => window.removeEventListener('blue-stage:audio-settings', sync);
  }, []);

  const changeTrack = (next: BackgroundTrackId) => {
    setTrack(next);
    audio.setBackgroundTrack(next);
  };

  const setMenuMusicVolume = (sliderValue: number) => {
    const nextGain = musicSliderToGain(sliderValue);
    if (nextGain > 0) {
      try { localStorage.setItem(MENU_MUSIC_RESTORE_KEY, String(nextGain)); } catch { /* optional preference storage */ }
    }
    audio.setSettings(nextGain > 0 ? { music: nextGain, muted: false } : { music: nextGain });
    if (nextGain > 0) void audio.unlock().then(() => audio.setMusic('lobby')).catch(() => {});
  };

  const toggleMenuMusic = () => {
    if (audio.settings.muted) {
      const restoreGain = audio.settings.music > 0 ? audio.settings.music : savedMusicRestoreGain();
      audio.setSettings({ muted: false, music: restoreGain });
      void audio.unlock().then(() => audio.setMusic('lobby')).catch(() => {});
      return;
    }

    if (audio.settings.music > 0) {
      try { localStorage.setItem(MENU_MUSIC_RESTORE_KEY, String(audio.settings.music)); } catch { /* optional preference storage */ }
      audio.setSettings({ music: 0 });
      return;
    }

    audio.setSettings({ muted: false, music: savedMusicRestoreGain() });
    void audio.unlock().then(() => audio.setMusic('lobby')).catch(() => {});
  };

  const selector = <label className={`music-track-select ${className}`.trim()}>
    <span>Background Music</span>
    <select value={track} onChange={(event) => changeTrack(event.target.value as BackgroundTrackId)}>
      {BACKGROUND_TRACKS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
  </label>;

  if (!showMenuControls) return selector;

  const sliderValue = musicGainToSlider(musicGain);
  return <Fragment>
    {selector}
    <label className="menu-music-volume">
      <span>Music</span>
      <input type="range" min="0" max="1" step="0.05" value={sliderValue} onChange={(event) => setMenuMusicVolume(Number(event.target.value))} />
      <b>{Math.round(sliderValue * 100)}%</b>
    </label>
    <button type="button" className={`menu-tool-button menu-music-mute${musicMuted ? ' active' : ''}`} aria-pressed={musicMuted} onClick={toggleMenuMusic}>
      <span aria-hidden="true">{musicMuted ? '🔇' : '♫'}</span>{musicMuted ? 'Unmute Music' : 'Mute Music'}
    </button>
  </Fragment>;
}
