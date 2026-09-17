import { useEffect, useState } from 'react';
import { audio, BACKGROUND_TRACKS, type BackgroundTrackId } from '../lib/audio';

export function MusicTrackSelect({ className = '' }: { className?: string }) {
  const [track, setTrack] = useState<BackgroundTrackId>(audio.settings.backgroundTrack);

  useEffect(() => {
    const sync = () => setTrack(audio.settings.backgroundTrack);
    window.addEventListener('blue-stage:audio-settings', sync);
    return () => window.removeEventListener('blue-stage:audio-settings', sync);
  }, []);

  const changeTrack = (next: BackgroundTrackId) => {
    setTrack(next);
    audio.setBackgroundTrack(next);
  };

  return <label className={`music-track-select ${className}`.trim()}>
    <span>Background Music</span>
    <select value={track} onChange={(event) => changeTrack(event.target.value as BackgroundTrackId)}>
      {BACKGROUND_TRACKS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
  </label>;
}
