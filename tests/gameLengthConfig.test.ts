import { describe, expect, it } from 'vitest';
import { GAME_LENGTH_CONFIG } from '../src/shared/config';
import { QUESTION_VALUES } from '../src/shared/types';

describe('game length configuration', () => {
  it('makes quick, standard, and marathon materially different board sizes', () => {
    expect(GAME_LENGTH_CONFIG.quick.categories * GAME_LENGTH_CONFIG.quick.rows).toBe(16);
    expect(GAME_LENGTH_CONFIG.standard.categories * GAME_LENGTH_CONFIG.standard.rows).toBe(25);
    expect(GAME_LENGTH_CONFIG.marathon.categories * GAME_LENGTH_CONFIG.marathon.rows).toBe(36);
  });

  it('reserves the 1000-point row for marathon', () => {
    expect(QUESTION_VALUES.slice(0, GAME_LENGTH_CONFIG.quick.rows)).toEqual([100, 200, 300, 400]);
    expect(QUESTION_VALUES.slice(0, GAME_LENGTH_CONFIG.standard.rows)).toEqual([100, 200, 300, 400, 500]);
    expect(QUESTION_VALUES.slice(0, GAME_LENGTH_CONFIG.marathon.rows)).toEqual([100, 200, 300, 400, 500, 1000]);
  });
});
