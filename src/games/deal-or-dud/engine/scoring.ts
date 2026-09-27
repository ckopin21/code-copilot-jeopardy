import type { DealPlayer, OfferChoice, RoundResult, RoundScore } from '../types';

/** Read the room: the one shark whose bid is closest to the average of the other two. */
export const READ_ROOM_BEST = 2;
/** Two (or all three) sharks tied for closest each get this. */
export const READ_ROOM_SHARED = 1;

/** The presenter scores one point per $100K raised in total. */
export function raisedPoints(total: number): number {
  return Math.floor(total / 100);
}

/**
 * Each shark's bid against the average of the other two ("I'm out" counts as $0). The closest gets +2; two tied get
 * +1 each; all three tied get +1 each.
 */
export function readTheRoom(offers: Record<string, OfferChoice>): Record<string, number> {
  const ids = Object.keys(offers);
  const points: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  if (ids.length < 2) return points;
  // Distances in $K, doubled so they stay whole numbers: |2a - (b + c)| instead of |a - (b + c) / 2|.
  const distance = (id: string) => {
    const others = ids.filter((other) => other !== id);
    return Math.abs(offers[id] * others.length - others.reduce((sum, other) => sum + offers[other], 0));
  };
  const distances = ids.map((id) => ({ id, distance: distance(id) }));
  const best = Math.min(...distances.map((item) => item.distance));
  const closest = distances.filter((item) => item.distance === best).map((item) => item.id);
  for (const id of closest) points[id] = closest.length === 1 ? READ_ROOM_BEST : READ_ROOM_SHARED;
  return points;
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
  readRoom: Record<string, number>;
  scores: RoundScore[];
}

export function scoreRound(presenterId: string, sharkIds: readonly string[], offers: Record<string, OfferChoice>): RoundOutcome {
  const total = sharkIds.reduce((sum, id) => sum + (offers[id] ?? 0), 0);
  const readRoom = readTheRoom(Object.fromEntries(sharkIds.map((id) => [id, offers[id] ?? 0])) as Record<string, OfferChoice>);
  const scores: RoundScore[] = [
    { playerId: presenterId, delta: raisedPoints(total), reason: total ? `Raised ${moneyLabel(total)}` : 'Raised nothing' }
  ];
  for (const id of sharkIds) {
    const delta = readRoom[id];
    scores.push({ playerId: id, delta, reason: delta === READ_ROOM_BEST ? 'Read the room' : delta ? 'Read the room (tied)' : `Bid ${moneyLabel(offers[id] ?? 0)}` });
  }
  return { total, revealOrder: revealOrder(sharkIds, offers), dealSharkIds: topBidders(offers), readRoom, scores };
}

export type AwardId = 'silver-tongue' | 'tightwad' | 'big-spender' | 'mind-reader';

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
 * smallest and largest bids in total. Mind Reader: most read-the-room points. An award nobody really earned is left out.
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
  const minds = new Map(players.map((player) => [player.id, 0]));
  for (const round of rounds) {
    for (const [id, offer] of Object.entries(round.offers)) bids.set(id, (bids.get(id) ?? 0) + offer);
    for (const [id, points] of Object.entries(round.readRoom ?? {})) minds.set(id, (minds.get(id) ?? 0) + points);
  }
  const low = extremes(bids, 'min');
  const high = extremes(bids, 'max');
  if (high.value > low.value) {
    awards.push({ id: 'tightwad', title: 'Tightwad', emoji: '🪙', playerIds: low.ids, detail: `${moneyLabel(low.value)} in bids all game` });
    awards.push({ id: 'big-spender', title: 'Big Spender', emoji: '💸', playerIds: high.ids, detail: `${moneyLabel(high.value)} in bids all game` });
  }
  const mind = extremes(minds, 'max');
  if (mind.value > 0) awards.push({ id: 'mind-reader', title: 'Mind Reader', emoji: '🔮', playerIds: mind.ids, detail: `${mind.value} read-the-room ${mind.value === 1 ? 'point' : 'points'}` });
  return awards;
}
