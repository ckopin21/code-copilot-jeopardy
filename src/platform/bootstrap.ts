// Browser-wide setup shared by every game. Imported once by src/main.tsx before any game loads.
import './audio/defaultBackgroundTrack';
import './net/clientLifecycle';
import { audio } from './audio/audio';
import { applyMusicVolumePolicy, DEFAULT_MUSIC_GAIN } from './audio/musicVolumePolicy';
import { installModeAwareAudioPolicy } from './audio/audioModePolicy';
import { applySavedAccessibility } from './ui/accessibility';

const AUDIO_75_MIGRATION_KEY = 'blue-stage-audio-default-75-v1';

/** Fresh instances start at Master 75%, Music 50%, Effects 75%. Runs once per browser. */
function applyAudioDefaults(): void {
  try {
    if (localStorage.getItem(AUDIO_75_MIGRATION_KEY)) return;
    audio.setSettings({ master: 0.75, music: DEFAULT_MUSIC_GAIN, effects: 0.75 });
    localStorage.setItem(AUDIO_75_MIGRATION_KEY, '1');
  } catch {
    audio.settings = { ...audio.settings, master: 0.75, music: DEFAULT_MUSIC_GAIN, effects: 0.75 };
  }
}

applyAudioDefaults();
applySavedAccessibility();
applyMusicVolumePolicy();
installModeAwareAudioPolicy();
