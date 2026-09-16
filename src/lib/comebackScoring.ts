import type { Player, RoomState } from '../shared/types';

export interface ComebackAward {
  points: number;
  bonus: number;
  underdogRate: number;
  streakRate: number;
}

/**
 * Adds bounded catch-up scoring to ordinary correct answers.
 *
 * Underdog boost:
 * - 25% when the player trails by at least 2x the question value.
 * - 50% when the player trails by at least 4x the question value.
 *
 * Comeback streak:
 * - +25% on the second consecutive correct answer while trailing.
 * - +50% on the third and later consecutive correct answers while trailing.
 *
 * The bonus is capped so bonus points can close a deficit, but can never be
 * the reason a player moves ahead of the current leader. If the base question
 * value is already enough to take the lead, the answer receives no catch-up
 * bonus. Daily Doubles and Final Round intentionally bypass this helper.
 */
export function calculateComebackAward(state: RoomState, player: Player, basePoints: number): ComebackAward {
  if (!Number.isFinite(basePoints) || basePoints <= 0 || state.players.length < 2) {
    return { points: basePoints, bonus: 0, underdogRate: 0, streakRate: 0 };
  }

  const leaderScore = Math.max(...state.players.map((candidate) => candidate.score));
  const deficit = leaderScore - player.score;
  if (deficit <= 0) return { points: basePoints, bonus: 0, underdogRate: 0, streakRate: 0 };

  const underdogRate = deficit >= basePoints * 4 ? 0.5 : deficit >= basePoints * 2 ? 0.25 : 0;
  const streakRate = state.settings.streaksEnabled
    ? player.positiveStreak >= 2 ? 0.5 : player.positiveStreak >= 1 ? 0.25 : 0
    : 0;
  const combinedRate = Math.min(1, underdogRate + streakRate);
  const uncappedBonus = Math.max(0, Math.round(basePoints * combinedRate));

  // A bonus may bring the player level with the leader, but never beyond them.
  // If base points already reach or pass first place, the comeback bonus is zero.
  const maxHelpfulBonus = Math.max(0, deficit - basePoints);
  const bonus = Math.min(uncappedBonus, maxHelpfulBonus);

  return { points: basePoints + bonus, bonus, underdogRate, streakRate };
}
