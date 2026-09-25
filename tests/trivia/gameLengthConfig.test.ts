import { describe, expect, it } from 'vitest';
import { clampDailyDoubleCount, DAILY_DOUBLE_COUNT_BY_LENGTH, GAME_LENGTH_CONFIG, settingsForGameLength } from '../../src/games/trivia/config';
import { QUESTION_VALUES } from '../../src/games/trivia/types';

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

  it('scales Daily Doubles with game length', () => {
    expect(DAILY_DOUBLE_COUNT_BY_LENGTH).toEqual({ quick: 2, standard: 4, marathon: 6 });
  });

  it('applies 2, 4, and 6 Daily Doubles when the game length changes', () => {
    expect(settingsForGameLength('quick')).toEqual({ gameLength: 'quick', dailyDoubleCount: 2, dailyDoublesEnabled: true });
    expect(settingsForGameLength('standard')).toEqual({ gameLength: 'standard', dailyDoubleCount: 4, dailyDoublesEnabled: true });
    expect(settingsForGameLength('marathon')).toEqual({ gameLength: 'marathon', dailyDoubleCount: 6, dailyDoublesEnabled: true });
  });


  it('clamps manually entered Daily Doubles to the selected pack question count', () => {
    expect(clampDailyDoubleCount(99, 24)).toBe(24);
    expect(clampDailyDoubleCount(12, 24)).toBe(12);
    expect(clampDailyDoubleCount(-3, 24)).toBe(0);
    expect(clampDailyDoubleCount(7.9, 24)).toBe(7);
  });

});
