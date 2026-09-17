import { describe, expect, it } from 'vitest';
import type { RoomState } from '../src/shared/types';
import { DEFAULT_SETTINGS } from '../src/shared/config';
import { finalWagerRules } from '../src/lib/finalWagerRules';

function state(scores: number[]): Pick<RoomState, 'players' | 'settings' | 'finalRound'> {
  const players = scores.map((score, index) => ({
    id: `p${index + 1}`, seat: index + 1, name: `P${index + 1}`, avatar: '⭐', accent: '#fff', score,
    connected: true, positiveStreak: 0, coldStreak: 0, onFire: false, isCold: false,
    buzzEligible: false, hasBuzzedThisQuestion: false, finalWager: null, finalWagerSubmitted: false,
    finalAnswer: null, finalAnswerSubmitted: false, finalResolved: false,
    stats: { correct: 0, incorrect: 0, longestStreak: 0, longestColdStreak: 0, dailyDoublesFound: 0, biggestWager: 0, fastestBuzzMs: null, pointsGained: 0, pointsLost: 0 }
  }));
  return {
    players,
    settings: { ...DEFAULT_SETTINGS },
    finalRound: { category: 'Final', question: 'Q', acceptedAnswers: ['A'], reviewPlayerIndex: 0, participantIds: players.map((player) => player.id), responsesClosed: false }
  };
}

describe('Final wager fairness', () => {
  it('protects non-positive players while giving them up to 1000 upside', () => {
    const rules = finalWagerRules(state([-700, 2400]), 'p1');
    expect(rules).toMatchObject({ maxWager: 1000, protectedLoss: true, runawayLeaderCap: false, allInAllowed: false });
  });

  it('caps a sole leader who has at least twice the next score', () => {
    const rules = finalWagerRules(state([6000, 2500, 1400]), 'p1');
    expect(rules).toMatchObject({ maxWager: 1000, protectedLoss: false, runawayLeaderCap: true, allInAllowed: false });
  });

  it('keeps normal Final wagering when the lead is competitive', () => {
    const rules = finalWagerRules(state([3500, 2200]), 'p1');
    expect(rules.runawayLeaderCap).toBe(false);
    expect(rules.allInAllowed).toBe(true);
    expect(rules.maxWager).toBe(DEFAULT_SETTINGS.maxWager);
  });

  it('does not cap a tied leader or a solo Final', () => {
    expect(finalWagerRules(state([3000, 3000]), 'p1').runawayLeaderCap).toBe(false);
    expect(finalWagerRules(state([6000]), 'p1').runawayLeaderCap).toBe(false);
  });
});
