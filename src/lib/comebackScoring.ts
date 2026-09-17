import type { Player, RoomState } from '../shared/types';

export type ComebackMultiplier = 1 | 2 | 3;

export interface ComebackAward {
  points: number;
  bonus: number;
  multiplier: ComebackMultiplier;
  boostType: 'double' | 'triple' | null;
  usesRemaining: number;
  doubleUsesRemaining: number;
  tripleUsesRemaining: number;
  /** Retained for compatibility with older callers. */
  underdogRate: number;
  /** Streaks no longer add comeback scoring. */
  streakRate: number;
}

const MAX_DOUBLE_BOOSTS = 2;
const MAX_TRIPLE_BOOSTS = 1;

function spentComebackBoosts(state: RoomState, playerId: string): { doubles: number; triples: number } {
  let doubles = 0;
  let triples = 0;

  for (const tile of state.board?.questions ?? []) {
    if (tile.dailyDouble) continue;
    const normalValue = tile.playedValue ?? tile.value;
    if (!Number.isFinite(normalValue) || normalValue <= 0) continue;
    const result = tile.results?.find((entry) => entry.playerId === playerId && entry.correct);
    if (!result) continue;

    if (result.delta >= normalValue * 3) triples += 1;
    else if (result.delta >= normalValue * 2) doubles += 1;
  }

  return { doubles, triples };
}

function inactiveAward(basePoints: number, doubleUsesRemaining: number, tripleUsesRemaining: number): ComebackAward {
  return {
    points: basePoints,
    bonus: 0,
    multiplier: 1,
    boostType: null,
    usesRemaining: 0,
    doubleUsesRemaining,
    tripleUsesRemaining,
    underdogRate: 0,
    streakRate: 0
  };
}

/**
 * Limited comeback boosts for the player whose turn selected the clue.
 *
 * - The player must currently be tied for last place.
 * - Trailing the leader by at least 2x the normal clue value unlocks a 2x award.
 * - Trailing by at least 4x unlocks a 3x award while that one-time boost remains.
 * - Each player may successfully use two 2x boosts and one 3x boost per game.
 * - A failed/no-answer attempt still risks only the normal clue value because this
 *   helper is only used for correct ordinary answers.
 * - Other players always receive the normal value, even when they answer a clue
 *   selected on the boosted player's turn.
 * - Daily Doubles and Final intentionally bypass this system.
 *
 * Uses are derived from authoritative board-result history so reconnects and Undo
 * do not need a second counter that can drift out of sync.
 */
export function calculateComebackAward(state: RoomState, player: Player, basePoints: number): ComebackAward {
  const spent = spentComebackBoosts(state, player.id);
  const doubleUsesRemaining = Math.max(0, MAX_DOUBLE_BOOSTS - spent.doubles);
  const tripleUsesRemaining = Math.max(0, MAX_TRIPLE_BOOSTS - spent.triples);

  if (!Number.isFinite(basePoints) || basePoints <= 0 || state.players.length < 2) {
    return inactiveAward(basePoints, doubleUsesRemaining, tripleUsesRemaining);
  }

  const activeTurnPlayerId = state.currentQuestion?.turnPlayerId ?? (state.phase === 'board' ? state.turnPlayerId : null);
  if (activeTurnPlayerId !== player.id || state.currentQuestion?.dailyDouble) {
    return inactiveAward(basePoints, doubleUsesRemaining, tripleUsesRemaining);
  }

  const scores = state.players.map((candidate) => candidate.score);
  const leaderScore = Math.max(...scores);
  const lastPlaceScore = Math.min(...scores);
  const deficit = leaderScore - player.score;
  if (deficit <= 0 || player.score !== lastPlaceScore) {
    return inactiveAward(basePoints, doubleUsesRemaining, tripleUsesRemaining);
  }

  if (deficit >= basePoints * 4 && tripleUsesRemaining > 0) {
    return {
      points: basePoints * 3,
      bonus: basePoints * 2,
      multiplier: 3,
      boostType: 'triple',
      usesRemaining: tripleUsesRemaining,
      doubleUsesRemaining,
      tripleUsesRemaining,
      underdogRate: 2,
      streakRate: 0
    };
  }

  if (deficit >= basePoints * 2 && doubleUsesRemaining > 0) {
    return {
      points: basePoints * 2,
      bonus: basePoints,
      multiplier: 2,
      boostType: 'double',
      usesRemaining: doubleUsesRemaining,
      doubleUsesRemaining,
      tripleUsesRemaining,
      underdogRate: 1,
      streakRate: 0
    };
  }

  return inactiveAward(basePoints, doubleUsesRemaining, tripleUsesRemaining);
}
