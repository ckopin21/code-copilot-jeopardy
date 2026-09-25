import type { Player, RoomState } from '../types';

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
const MIN_COMPLETED_TURNS_PER_PLAYER = 2;

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

function activePlayers(state: RoomState): Player[] {
  const participantIds = state.currentQuestion?.participantIds;
  if (participantIds?.length) {
    const ids = new Set(participantIds);
    return state.players.filter((player) => ids.has(player.id));
  }
  const connected = state.players.filter((player) => player.connected);
  return connected.length ? connected : state.players;
}

/**
 * Comeback thresholds use one stable board reference instead of the selected
 * clue value. That keeps the active comeback tier identical for every clue on
 * the player's turn. The actual award still multiplies the effective clue value,
 * so late-game 2x/3x modifiers stack normally with comeback boosts.
 */
export function comebackReferenceValue(state: RoomState): number {
  const values = (state.board?.questions ?? [])
    .map((tile) => tile.value)
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.max(...values) : 0;
}

/**
 * Comeback help starts only after every active player has individually completed
 * at least two turns. Turn ownership is stored on each played board tile. The
 * currently open clue is excluded, so a player's second turn must be fully
 * completed before it can help unlock the system.
 */
export function comebackBoostsUnlocked(state: RoomState): boolean {
  const players = activePlayers(state);
  if (players.length < 2) return false;

  const activeIds = new Set(players.map((player) => player.id));
  const completedTurns = new Map(players.map((player) => [player.id, 0]));
  const activeQuestionId = state.currentQuestion?.questionId;

  for (const tile of state.board?.questions ?? []) {
    if (!tile.used || tile.questionId === activeQuestionId || !tile.turnPlayerId || !activeIds.has(tile.turnPlayerId)) continue;
    completedTurns.set(tile.turnPlayerId, (completedTurns.get(tile.turnPlayerId) ?? 0) + 1);
  }

  return players.every((player) => (completedTurns.get(player.id) ?? 0) >= MIN_COMPLETED_TURNS_PER_PLAYER);
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
 * - Boosts stay disabled until every active player has completed two turns.
 * - Exactly one active player must be alone in last place; a tie for last gets no boost.
 * - Trailing the leader by at least 2x the board's highest base clue value unlocks
 *   a 2x award on every ordinary clue while that condition remains true.
 * - Trailing by at least 4x that same stable reference unlocks a 3x award on every
 *   ordinary clue while the one-time triple boost remains.
 * - Each player may successfully use two 2x boosts and one 3x boost per game.
 * - A failed/no-answer attempt still risks only the normal effective clue value because
 *   this helper is only used for correct ordinary answers.
 * - Other players always receive the normal effective value, even when they answer a
 *   clue selected on the boosted player's turn.
 * - Daily Doubles and Final intentionally bypass this system.
 * - The comeback multiplier is applied to basePoints, which is already the effective
 *   clue value. This intentionally stacks with late-game 2x/3x modifiers.
 *
 * Uses are derived from authoritative board-result history so reconnects and Undo
 * do not need a second counter that can drift out of sync.
 */
export function calculateComebackAward(state: RoomState, player: Player, basePoints: number): ComebackAward {
  const spent = spentComebackBoosts(state, player.id);
  const doubleUsesRemaining = Math.max(0, MAX_DOUBLE_BOOSTS - spent.doubles);
  const tripleUsesRemaining = Math.max(0, MAX_TRIPLE_BOOSTS - spent.triples);
  const eligiblePlayers = activePlayers(state);
  const referenceValue = comebackReferenceValue(state);

  if (!Number.isFinite(basePoints) || basePoints <= 0 || referenceValue <= 0 || eligiblePlayers.length < 2 || !comebackBoostsUnlocked(state)) {
    return inactiveAward(basePoints, doubleUsesRemaining, tripleUsesRemaining);
  }

  const activeTurnPlayerId = state.currentQuestion?.turnPlayerId ?? (state.phase === 'board' ? state.turnPlayerId : null);
  if (activeTurnPlayerId !== player.id || state.currentQuestion?.dailyDouble || !eligiblePlayers.some((candidate) => candidate.id === player.id)) {
    return inactiveAward(basePoints, doubleUsesRemaining, tripleUsesRemaining);
  }

  const scores = eligiblePlayers.map((candidate) => candidate.score);
  const leaderScore = Math.max(...scores);
  const lastPlaceScore = Math.min(...scores);
  const lastPlacePlayers = eligiblePlayers.filter((candidate) => candidate.score === lastPlaceScore);
  const deficit = leaderScore - player.score;
  if (deficit <= 0 || lastPlacePlayers.length !== 1 || lastPlacePlayers[0].id !== player.id) {
    return inactiveAward(basePoints, doubleUsesRemaining, tripleUsesRemaining);
  }

  if (deficit >= referenceValue * 4 && tripleUsesRemaining > 0) {
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

  if (deficit >= referenceValue * 2 && doubleUsesRemaining > 0) {
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
