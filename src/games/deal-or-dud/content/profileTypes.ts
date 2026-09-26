import type { Complexity, ProductForm, SubjectId, Verdict } from '../types';

/**
 * One fact card as authored: subject, favorable (+) or unfavorable (-), then text for
 * Simple, Standard and Challenge. A missing Standard/Challenge text reuses the one before.
 *
 * Tokens: {p} product short name, {customers}/{Customers}, {buy}, {bought}.
 */
export type CardSource = readonly [SubjectId, '+' | '-', string, string?, string?];

export interface ProfileVariant {
  id: string;
  forms: readonly ProductForm[];
  cards: readonly [CardSource, CardSource, CardSource, CardSource, CardSource, CardSource];
}

export interface ProfileFamily {
  id: string;
  verdict: Verdict;
  /** One sentence a high schooler could say after seeing all six cards. */
  explain: string;
  variants: readonly ProfileVariant[];
}

export const PHYS: readonly ProductForm[] = ['food', 'gadget', 'goods', 'pet'];
export const DUR: readonly ProductForm[] = ['gadget', 'goods', 'pet'];
export const ANY: readonly ProductForm[] = ['food', 'gadget', 'goods', 'pet', 'service', 'rental', 'digital', 'event'];
export const LIVE: readonly ProductForm[] = ['service', 'event'];
export const RENT: readonly ProductForm[] = ['rental'];
export const DIG: readonly ProductForm[] = ['digital'];
export const FOOD: readonly ProductForm[] = ['food'];

const WORDS: Record<ProductForm, { customers: string; buy: string; bought: string }> = {
  food: { customers: 'customers', buy: 'buy', bought: 'bought' },
  gadget: { customers: 'customers', buy: 'buy', bought: 'bought' },
  goods: { customers: 'customers', buy: 'buy', bought: 'bought' },
  pet: { customers: 'pet owners', buy: 'buy', bought: 'bought' },
  service: { customers: 'customers', buy: 'book', bought: 'booked' },
  rental: { customers: 'renters', buy: 'rent', bought: 'rented' },
  digital: { customers: 'users', buy: 'sign up for', bought: 'signed up for' },
  event: { customers: 'guests', buy: 'book', bought: 'booked' }
};

const COMPLEXITY_INDEX: Record<Complexity, 2 | 3 | 4> = { simple: 2, standard: 3, challenge: 4 };

export function cardText(card: CardSource, complexity: Complexity): string {
  const index = COMPLEXITY_INDEX[complexity];
  for (let at = index; at >= 2; at -= 1) {
    const text = card[at];
    if (typeof text === 'string' && text) return text;
  }
  return card[2];
}

export function fillTokens(text: string, form: ProductForm, short: string): string {
  const words = WORDS[form];
  const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  return text
    .replaceAll('{p}', short)
    .replaceAll('{Customers}', capital(words.customers))
    .replaceAll('{customers}', words.customers)
    .replaceAll('{buy}', words.buy)
    .replaceAll('{bought}', words.bought);
}
