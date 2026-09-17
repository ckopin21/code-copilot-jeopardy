import type { RoomState } from '../shared/types';

export const FINAL_FAIRNESS_CAP = 1000;

export interface FinalWagerRules {
  maxWager: number;
  protectedLoss: boolean;
  runawayLeaderCap: boolean;
  allInAllowed: boolean;
}

export function finalWagerRules(
  state: Pick<RoomState, 'players' | 'settings' | 'finalRound'>,
  playerId: string
): FinalWagerRules {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error('Player not found');

  const participantIds = new Set(
    state.finalRound?.participantIds?.length
      ? state.finalRound.participantIds
      : state.players.map((candidate) => candidate.id)
  );
  const competitors = state.players.filter(
    (candidate) => candidate.id !== player.id && participantIds.has(candidate.id)
  );
  const highestOtherScore = competitors.length
    ? Math.max(...competitors.map((candidate) => candidate.score))
    : 0;
  const soleLeader = competitors.length > 0 && competitors.every((candidate) => player.score > candidate.score);
  const runawayLeaderCap = soleLeader && player.score >= 2 * Math.max(FINAL_FAIRNESS_CAP, highestOtherScore);

  const settingsMax = Math.max(0, Math.floor(state.settings.maxWager));
  const normalMax = state.settings.allowWagerBeyondScore
    ? settingsMax
    : Math.min(settingsMax, Math.max(0, Math.floor(player.score)));
  const protectedLoss = player.score <= 0;
  const maxWager = protectedLoss
    ? Math.min(settingsMax, FINAL_FAIRNESS_CAP)
    : runawayLeaderCap
      ? Math.min(normalMax, FINAL_FAIRNESS_CAP)
      : normalMax;

  return {
    maxWager,
    protectedLoss,
    runawayLeaderCap,
    allInAllowed: player.score > 0 && !runawayLeaderCap && player.score <= maxWager
  };
}
