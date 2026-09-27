import type { DealPlayer, OfferChoice, RoundResult, RoundScore } from '../types';

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
  scores: RoundScore[];
}

/** Only the presenter scores: one point per $100K raised. Sharks' bids decide that, but earn the sharks nothing. */
export function scoreRound(presenterId: string, sharkIds: readonly string[], offers: Record<string, OfferChoice>): RoundOutcome {
  const total = sharkIds.reduce((sum, id) => sum + (offers[id] ?? 0), 0);
  const scores: RoundScore[] = [
    { playerId: presenterId, delta: raisedPoints(total), reason: total ? `Raised ${moneyLabel(total)}` : 'Raised nothing' }
  ];
  return { total, revealOrder: revealOrder(sharkIds, offers), dealSharkIds: topBidders(offers), scores };
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
      detail: winners.length === 1 ? `Raised ${moneyLabel(best)} for ${winners[0].businessName}` : `Raised ${moneyLabel(best)}` });
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
