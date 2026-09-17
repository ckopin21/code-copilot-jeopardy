import { audio, BACKGROUND_TRACKS } from './audio';

const AUDIO_KEY = 'blue-stage-audio';
const DEFAULT_BACKGROUND_TRACK = 'tatamusic' as const;

function hasSavedTrackPreference(): boolean {
  try {
    const savedRaw = localStorage.getItem(AUDIO_KEY);
    if (!savedRaw) return false;
    const saved = JSON.parse(savedRaw) as { backgroundTrack?: unknown };
    return typeof saved.backgroundTrack === 'string'
      && BACKGROUND_TRACKS.some((track) => track.id === saved.backgroundTrack);
  } catch {
    return false;
  }
}

if (!hasSavedTrackPreference()) {
  audio.setBackgroundTrack(DEFAULT_BACKGROUND_TRACK);
}
