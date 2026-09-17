import { audio } from './audio';

export const MUSIC_GAIN_MAX = 0.15;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function musicSliderToGain(value: number): number {
  return clamp01(value) * MUSIC_GAIN_MAX;
}

export function musicGainToSlider(value: number): number {
  return clamp01(value / MUSIC_GAIN_MAX);
}

export function applyMusicVolumePolicy(): void {
  if (audio.settings.music <= MUSIC_GAIN_MAX) return;
  audio.setSettings({ music: MUSIC_GAIN_MAX });
}
