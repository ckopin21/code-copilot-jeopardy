import { describe, expect, it } from 'vitest';
import { analyzeDevScenario, type DevScenarioInput } from '../../src/games/trivia/dev/devModeScenario';

const base: DevScenarioInput = {
  playerCount: 2,
  scores: [1000, 0],
  selectedSeat: 2,
  clueValue: 100,
  lateMultiplier: 1,
  doubleBoostsSpent: 0,
  tripleBoostsSpent: 0
};

describe('dev mode scenario calculator', () => {
  it('uses the production 2x comeback calculation', () => {
    const result = analyzeDevScenario(base);
    expect(result.normalValue).toBe(100);
    expect(result.comeback.multiplier).toBe(2);
    expect(result.correctValue).toBe(200);
    expect(result.wrongValue).toBe(-100);
    expect(result.otherPlayerCorrectValue).toBe(100);
  });

  it('uses the production 3x comeback calculation', () => {
    const result = analyzeDevScenario({ ...base, scores: [2000, 0] });
    expect(result.comeback.multiplier).toBe(3);
    expect(result.correctValue).toBe(300);
    expect(result.comeback.tripleUsesRemaining).toBe(1);
  });

  it('respects spent boost limits', () => {
    const result = analyzeDevScenario({ ...base, scores: [2000, 0], tripleBoostsSpent: 1, doubleBoostsSpent: 2 });
    expect(result.comeback.multiplier).toBe(1);
    expect(result.correctValue).toBe(100);
    expect(result.comeback.tripleUsesRemaining).toBe(0);
    expect(result.comeback.doubleUsesRemaining).toBe(0);
  });

  it('stacks the comeback multiplier on the late-game effective value', () => {
    const result = analyzeDevScenario({ ...base, lateMultiplier: 2 });
    expect(result.normalValue).toBe(200);
    expect(result.comeback.multiplier).toBe(2);
    expect(result.correctValue).toBe(400);
    expect(result.wrongValue).toBe(-200);
  });

  it('does not activate a comeback boost when the selected player is not last', () => {
    const result = analyzeDevScenario({ ...base, playerCount: 3, scores: [1000, 300, 0], selectedSeat: 2 });
    expect(result.isLastPlace).toBe(false);
    expect(result.comeback.multiplier).toBe(1);
  });

  it('exposes the same Final wager rules used by the live game', () => {
    const protectedPlayer = analyzeDevScenario({ ...base, scores: [500, -100], selectedSeat: 2 });
    expect(protectedPlayer.finalRules.protectedLoss).toBe(true);
    expect(protectedPlayer.finalRules.maxWager).toBe(1000);

    const runawayLeader = analyzeDevScenario({ ...base, scores: [3000, 500], selectedSeat: 1 });
    expect(runawayLeader.finalRules.runawayLeaderCap).toBe(true);
    expect(runawayLeader.finalRules.maxWager).toBe(1000);
  });
});
