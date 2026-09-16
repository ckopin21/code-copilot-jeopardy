import { describe, expect, it } from 'vitest';
import { scoreboardWagersVisible, turnIndicatorLabel, turnIndicatorVisible } from '../src/lib/gameUiRules';

describe('shared game UI rules', () => {
  it('shows turn ownership only during the board round', () => {
    expect(turnIndicatorVisible('board')).toBe(true);
    expect(turnIndicatorVisible('question')).toBe(true);
    expect(turnIndicatorVisible('daily-double-wager')).toBe(true);
    expect(turnIndicatorVisible('daily-double-question')).toBe(true);
    expect(turnIndicatorVisible('final-category')).toBe(false);
    expect(turnIndicatorVisible('final-wager')).toBe(false);
    expect(turnIndicatorVisible('final-question')).toBe(false);
    expect(turnIndicatorVisible('final-review')).toBe(false);
    expect(turnIndicatorVisible('recap')).toBe(false);
  });

  it('uses a truthful turn label for board versus active clue states', () => {
    expect(turnIndicatorLabel('board')).toBe('SELECTS NEXT');
    expect(turnIndicatorLabel('question')).toBe('ON TURN');
    expect(turnIndicatorLabel('daily-double-question')).toBe('ON TURN');
  });

  it('keeps full Final wagers off shared scoreboards until recap', () => {
    expect(scoreboardWagersVisible('final-wager')).toBe(false);
    expect(scoreboardWagersVisible('final-question')).toBe(false);
    expect(scoreboardWagersVisible('final-review')).toBe(false);
    expect(scoreboardWagersVisible('recap')).toBe(true);
  });
});
