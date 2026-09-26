import type { DealAmount, OfferChoice, RoundScore, Verdict } from '../types';

/** Extra points for a deal on a GOOD business, for the presenter and the winning shark alike. */
export const GOOD_DEAL_BONUS = 2;
export const PRESENTER_NO_DEAL: Record<Verdict, number> = { good: 1, bad: -2 };
/** A shark who bid $0 on a BAD business. */
export const PASS_ON_BAD = 1;

export type Deal = { sharkId: string; amount: DealAmount } | null;

/** Points scale with the deal: one per $100K. */
export function dealUnits(amount: DealAmount): number {
  return amount / 100;
}

/** Largest bid, and every shark tied at it. A $0 bid never makes a deal. */
export function largestOffers(offers: Record<string, OfferChoice>): { amount: DealAmount | null; sharkIds: string[] } {
  let amount: DealAmount | null = null;
  for (const choice of Object.values(offers)) if (choice > 0 && (amount === null || choice > amount)) amount = choice as DealAmount;
  return { amount, sharkIds: amount === null ? [] : Object.keys(offers).filter((id) => offers[id] === amount) };
}

export function scoreRound(verdict: Verdict, presenterId: string, offers: Record<string, OfferChoice>, deal: Deal): RoundScore[] {
  const scores: RoundScore[] = [];
  if (deal) {
    const units = dealUnits(deal.amount);
    const presenter = verdict === 'good' ? units + GOOD_DEAL_BONUS : units;
    scores.push({ playerId: presenterId, delta: presenter, reason: verdict === 'good' ? `Sold it for $${deal.amount}K, and it was GOOD` : `Sold it for $${deal.amount}K` });
  } else {
    scores.push({ playerId: presenterId, delta: PRESENTER_NO_DEAL[verdict], reason: verdict === 'good' ? 'No deal, but the business was GOOD' : 'No deal on a BAD business' });
  }
  for (const [sharkId, choice] of Object.entries(offers)) {
    if (deal && deal.sharkId === sharkId) {
      const units = dealUnits(deal.amount);
      const delta = verdict === 'good' ? units + GOOD_DEAL_BONUS : -units;
      scores.push({ playerId: sharkId, delta, reason: verdict === 'good' ? `Invested $${deal.amount}K in a winner` : `Lost $${deal.amount}K` });
    } else if (choice === 0) {
      const delta = verdict === 'bad' ? PASS_ON_BAD : 0;
      scores.push({ playerId: sharkId, delta, reason: verdict === 'bad' ? 'Bid $0 on a BAD business' : 'Bid $0 on a GOOD business' });
    } else {
      scores.push({ playerId: sharkId, delta: 0, reason: 'Outbid' });
    }
  }
  return scores;
}
