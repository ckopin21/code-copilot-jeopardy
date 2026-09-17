import { describe, expect, it } from 'vitest';
import { MUSIC_GAIN_MAX, musicGainToSlider, musicSliderToGain } from '../src/lib/musicVolumePolicy';

describe('music volume policy', () => {
  it('maps the full UI slider onto the quieter music gain range', () => {
    expect(MUSIC_GAIN_MAX).toBe(0.15);
    expect(musicSliderToGain(0)).toBe(0);
    expect(musicSliderToGain(0.5)).toBeCloseTo(0.075);
    expect(musicSliderToGain(1)).toBeCloseTo(0.15);
  });

  it('maps previously comfortable low gains into a more useful slider range', () => {
    expect(musicGainToSlider(0.05)).toBeCloseTo(1 / 3);
    expect(musicGainToSlider(0.1)).toBeCloseTo(2 / 3);
  });

  it('clamps values outside the supported range', () => {
    expect(musicSliderToGain(-1)).toBe(0);
    expect(musicSliderToGain(2)).toBeCloseTo(0.15);
    expect(musicGainToSlider(1)).toBe(1);
  });
});
