// Pure content logic: builder hands, headlines and business names. Shared by server and phones.
import type { BuilderColumn, BuilderPicks, ProductForm, Tone } from '../types';
import { toneAllows } from '../types';
import { AUDIENCES, MODIFIERS, PRODUCTS, type ModifierWord, type ProductWord } from './words';
import { NAME_PATTERNS, type ToneLine } from './cues';

export type Rng = () => number;

/** Cards dealt per builder step. */
export const HAND_SIZE = 4;

export function pick<T>(items: readonly T[], rng: Rng): T {
  if (!items.length) throw new Error('Nothing to pick from');
  return items[Math.floor(rng() * items.length) % items.length];
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export const modifierById = (id: string | null | undefined) => MODIFIERS.find((item) => item.id === id);
export const productById = (id: string | null | undefined) => PRODUCTS.find((item) => item.id === id);
export const audienceById = (id: string | null | undefined) => AUDIENCES.find((item) => item.id === id);

export function tonePool<T extends { tone?: Tone }>(items: readonly T[], tone: Tone): T[] {
  return items.filter((item) => toneAllows(tone, item.tone));
}

export function modifierFits(modifier: ModifierWord, product: ProductWord): boolean {
  return modifier.forms.includes(product.form);
}

/** Every card that could be dealt in a step, given the product already picked. */
export function columnPool(column: BuilderColumn, product: ProductWord | null | undefined, tone: Tone): { id: string; form?: ProductForm }[] {
  if (column === 'products') return tonePool(PRODUCTS, tone);
  if (column === 'audiences') return tonePool(AUDIENCES, tone);
  return tonePool(MODIFIERS, tone).filter((modifier) => !product || modifierFits(modifier, product));
}

/**
 * Four fresh cards for a step. Products spread across kinds (a food, a gadget, a service…) and skip ids in `avoid`
 * (other players' cards); a reroll also skips the four on the table when there are enough left.
 */
export function dealHand(column: BuilderColumn, picks: BuilderPicks, tone: Tone, rng: Rng, avoid: readonly string[] = []): string[] {
  const product = productById(picks.product);
  const pool = shuffle(columnPool(column, product, tone), rng);
  const current = picks.hands[column] ?? [];
  const fresh = pool.filter((item) => !avoid.includes(item.id) && !current.includes(item.id));
  const usable = fresh.length >= HAND_SIZE ? fresh : pool.filter((item) => !avoid.includes(item.id));
  const source = usable.length >= HAND_SIZE ? usable : pool;
  if (column !== 'products') return source.slice(0, HAND_SIZE).map((item) => item.id);
  const hand: string[] = [];
  const forms = new Set<ProductForm | undefined>();
  for (const item of source) if (hand.length < HAND_SIZE && !forms.has(item.form)) { hand.push(item.id); forms.add(item.form); }
  for (const item of source) if (hand.length < HAND_SIZE && !hand.includes(item.id)) hand.push(item.id);
  return hand;
}

export function emptyBuilder(): BuilderPicks {
  return { product: null, modifier: null, audience: null, hands: { products: [], modifiers: [], audiences: [] } };
}

export function capitalize(text: string): string { return text.charAt(0).toUpperCase() + text.slice(1); }

/** "[Twist] [product] for [audience]". Missing picks are left out. */
export function buildHeadline(picks: Pick<BuilderPicks, 'product' | 'modifier' | 'audience'>): string {
  const product = productById(picks.product);
  if (!product) return '';
  const modifier = modifierById(picks.modifier);
  const audience = audienceById(picks.audience);
  const core = [modifier && modifierFits(modifier, product) ? modifier.text : null, product.text].filter(Boolean).join(' ');
  return capitalize(audience ? `${core} for ${audience.text}` : core);
}

export function businessNames(picks: Pick<BuilderPicks, 'product' | 'modifier'>, tone: Tone, rng: Rng, count = 3): string[] {
  const product = productById(picks.product);
  if (!product) return [];
  const modifierRoot = modifierById(picks.modifier)?.root;
  const patterns = shuffle(tonePool(NAME_PATTERNS, tone), rng);
  const names = new Set<string>();
  for (const pattern of patterns) {
    if (names.size >= count) break;
    if (pattern.text.includes('{mod}') && !modifierRoot) continue;
    names.add(pattern.text.replace('{root}', pick(product.roots, rng)).replace('{mod}', modifierRoot ?? ''));
  }
  return [...names];
}

export function toneLine(pool: readonly ToneLine[], tone: Tone, rng: Rng): ToneLine {
  return pick(tonePool(pool, tone), rng);
}
