import { audio } from './audio';

export const MUSIC_GAIN_MAX = 0.15;
export const DEFAULT_MUSIC_SLIDER = 0.5;
export const DEFAULT_MUSIC_GAIN = MUSIC_GAIN_MAX * DEFAULT_MUSIC_SLIDER;

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
