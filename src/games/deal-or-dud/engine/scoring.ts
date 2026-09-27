import type { BonusSettings, DealPlayer, OfferChoice, RoundResult, RoundScore } from '../types';
import { BONUS_POINTS, DEFAULT_BONUSES, OVATION_MIN_BID } from '../types';

/** The presenter scores one point per $100K raised in total. */
export function raisedPoints(total: number): number {
  return Math.floor(total / 100);
}

/** Lowest bid first, so the reveal builds up. Equal bids keep seat order. */
export function revealOrder(sharkIds: readonly string[], offers: Record<string, OfferChoice>): string[] {
  return [...sharkIds].sort((a, b) => offers[a] - offers[b]);
}

/** Top bidders (for show: "Ava's in!"). Nobody when every bid is $0. */
export function topBidders(offers: Record<string, OfferChoice>): string[] {
  const best = Math.max(0, ...Object.values(offers));
  return best === 0 ? [] : Object.keys(offers).filter((id) => offers[id] === best);
}

export function moneyLabel(thousands: number): string {
  if (thousands === 0) return '$0';
  return thousands >= 1000 ? `$${(thousands / 1000).toFixed(thousands % 1000 ? 1 : 0)}M` : `$${thousands}K`;
}

export interface RoundOutcome {
  total: number;
  revealOrder: string[];
  dealSharkIds: string[];
  bonuses: RoundResult['bonuses'];
  scores: RoundScore[];
}

export const BONUS_LABELS = { noWalkout: 'Nobody walked out', ovation: 'Standing ovation' } as const;

/**
 * Only the presenter scores: one point per $100K raised, plus any bonuses that are switched on (nobody said "I'm out";
 * every shark bid $300K or more). Sharks' bids decide it, but earn the sharks nothing.
 */
export function scoreRound(presenterId: string, sharkIds: readonly string[], offers: Record<string, OfferChoice>,
  outSharkIds: readonly string[] = [], settings: BonusSettings = DEFAULT_BONUSES): RoundOutcome {
  const total = sharkIds.reduce((sum, id) => sum + (offers[id] ?? 0), 0);
  const bonuses: RoundResult['bonuses'] = [];
  if (settings.noWalkout && outSharkIds.length === 0) bonuses.push({ id: 'noWalkout', points: BONUS_POINTS.noWalkout });
  if (settings.ovation && sharkIds.length > 0 && sharkIds.every((id) => (offers[id] ?? 0) >= OVATION_MIN_BID)) bonuses.push({ id: 'ovation', points: BONUS_POINTS.ovation });
  const reason = [total ? `Raised ${moneyLabel(total)}` : 'Raised nothing', ...bonuses.map((bonus) => `${BONUS_LABELS[bonus.id]} +${bonus.points}`)].join(' · ');
  const scores: RoundScore[] = [
    { playerId: presenterId, delta: raisedPoints(total) + bonuses.reduce((sum, bonus) => sum + bonus.points, 0), reason }
  ];
  return { total, revealOrder: revealOrder(sharkIds, offers), dealSharkIds: topBidders(offers), bonuses, scores };
}

/** Rounds with the most votes (ties share); none when nobody voted. */
export function voteWinners(votes: Record<string, number | null>): number[] {
  const counts = new Map<number, number>();
  for (const pick of Object.values(votes)) if (pick !== null && pick !== undefined) counts.set(pick, (counts.get(pick) ?? 0) + 1);
  const best = Math.max(0, ...counts.values());
  return best === 0 ? [] : [...counts].filter(([, count]) => count === best).map(([round]) => round).sort((a, b) => a - b);
}

export type AwardId = 'silver-tongue' | 'tightwad' | 'big-spender';

export interface Award {
  id: AwardId;
  title: string;
  emoji: string;
  playerIds: string[];
  /** "Raised $1.2M for Flakely", "$300K in bids". */
  detail: string;
}

/** Players with the highest (or lowest) value; everyone shares a tie. */
function extremes(values: Map<string, number>, pick: 'max' | 'min'): { ids: string[]; value: number } {
  const numbers = [...values.values()];
  const value = pick === 'max' ? Math.max(...numbers) : Math.min(...numbers);
  return { ids: [...values].filter(([, amount]) => amount === value).map(([id]) => id), value };
}

/**
 * End-of-game titles, for fun (they score nothing). Silver Tongue: most raised in one pitch. Tightwad and Big Spender:
 * smallest and largest bids in total. An award nobody really earned is left out.
 */
export function gameAwards(history: readonly RoundResult[], players: readonly DealPlayer[]): Award[] {
  const rounds = history.filter((round) => typeof round.total === 'number');
  if (!rounds.length) return [];
  const awards: Award[] = [];
  const best = Math.max(...rounds.map((round) => round.total));
  if (best > 0) {
    const winners = rounds.filter((round) => round.total === best);
    const ids = [...new Set(winners.map((round) => round.presenterId))];
    awards.push({ id: 'silver-tongue', title: 'Silver Tongue', emoji: '👅', playerIds: ids,
      detail: `Raised ${moneyLabel(best)} in one pitch` });
  }
  const bids = new Map(players.map((player) => [player.id, 0]));
  for (const round of rounds) {
    for (const [id, offer] of Object.entries(round.offers)) bids.set(id, (bids.get(id) ?? 0) + offer);
  }
  const low = extremes(bids, 'min');
  const high = extremes(bids, 'max');
  if (high.value > low.value) {
    awards.push({ id: 'tightwad', title: 'Tightwad', emoji: '🪙', playerIds: low.ids, detail: `${moneyLabel(low.value)} in bids all game` });
    awards.push({ id: 'big-spender', title: 'Big Spender', emoji: '💸', playerIds: high.ids, detail: `${moneyLabel(high.value)} in bids all game` });
  }
  return awards;
}
