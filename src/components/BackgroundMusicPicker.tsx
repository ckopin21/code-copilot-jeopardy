import { Fragment, useEffect, useState } from 'react';
import { audio, BACKGROUND_TRACKS, type BackgroundTrackId } from '../lib/audio';
import { MUSIC_GAIN_MAX } from '../lib/musicVolumePolicy';

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
  const [musicMuted, setMusicMuted] = useState(audio.settings.music <= 0);
  const showMenuMute = className.split(/\s+/).includes('menu-music-select');

  useEffect(() => {
    const sync = () => {
      setTrack(audio.settings.backgroundTrack);
      setMusicMuted(audio.settings.music <= 0);
    };
    window.addEventListener('blue-stage:audio-settings', sync);
    return () => window.removeEventListener('blue-stage:audio-settings', sync);
  }, []);

  const changeTrack = (next: BackgroundTrackId) => {
    setTrack(next);
    audio.setBackgroundTrack(next);
  };

  const toggleMenuMusic = () => {
    if (audio.settings.music > 0) {
      try { localStorage.setItem(MENU_MUSIC_RESTORE_KEY, String(audio.settings.music)); } catch { /* optional preference storage */ }
      audio.setSettings({ music: 0 });
      return;
    }

    audio.setSettings({ music: savedMusicRestoreGain() });
    void audio.unlock().then(() => audio.setMusic('lobby')).catch(() => {});
  };

  const selector = <label className={`music-track-select ${className}`.trim()}>
    <span>Background Music</span>
    <select value={track} onChange={(event) => changeTrack(event.target.value as BackgroundTrackId)}>
      {BACKGROUND_TRACKS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
  </label>;

  if (!showMenuMute) return selector;

  return <Fragment>
    {selector}
    <button type="button" className={`menu-tool-button menu-music-mute${musicMuted ? ' active' : ''}`} aria-pressed={musicMuted} onClick={toggleMenuMusic}>
      <span aria-hidden="true">{musicMuted ? '🔇' : '♫'}</span>{musicMuted ? 'Unmute Music' : 'Mute Music'}
    </button>
  </Fragment>;
}
