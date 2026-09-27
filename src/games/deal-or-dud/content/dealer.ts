// Pure content logic: builder hands, headlines and business names. Shared by server and phones.
import type { BuilderColumn, BuilderPicks, OptionalColumn, ProductForm, Tone } from '../types';
import { toneAllows } from '../types';
import { AUDIENCES, CONNECTORS, FEATURES, MODIFIERS, PRODUCTS, type ModifierWord, type ProductWord } from './words';
import { NAME_PATTERNS, type ToneLine } from './cues';

export type Rng = () => number;

/** Cards dealt per builder step. */
export const HAND_SIZE = 6;
/** Longest text a player can write for one step. */
export const CUSTOM_MAX = 40;
/** The emoji a written-in step shows on the product card. */
export const CUSTOM_EMOJI = '✏️';

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
export const featureById = (id: string | null | undefined) => FEATURES.find((item) => item.id === id);
/** The word before the who ("made by"); an unknown or missing id is "for". */
export const connectorText = (id: string | null | undefined) => (CONNECTORS.find((item) => item.id === id) ?? CONNECTORS[0]).text;

/** Every builder step in reading order: "[twist] [product] for [who], [feature]". */
export const COLUMNS: readonly BuilderColumn[] = ['modifiers', 'products', 'audiences', 'features'];
export const OPTIONAL_COLUMNS: readonly OptionalColumn[] = ['modifiers', 'audiences', 'features'];
/** Where each step's card pick lives on `BuilderPicks`. */
export const PICK_KEY = { products: 'product', modifiers: 'modifier', audiences: 'audience', features: 'feature' } as const;

/** A step's card pick. */
export function pickedId(picks: HeadlinePicks, column: BuilderColumn): string | null {
  return picks[PICK_KEY[column]] ?? null;
}

export function tonePool<T extends { tone?: Tone }>(items: readonly T[], tone: Tone): T[] {
  return items.filter((item) => toneAllows(tone, item.tone));
}

export function modifierFits(modifier: ModifierWord, product: ProductWord): boolean {
  return modifier.forms.includes(product.form);
}

/**
 * Every card that could be dealt in a step. The twist and the product filter each other: once one is picked from the
 * cards, the other step only deals cards that fit it (a written-in step fits anything).
 */
export function columnPool(column: BuilderColumn, picks: Pick<BuilderPicks, 'product' | 'modifier'>, tone: Tone): { id: string; form?: ProductForm }[] {
  const product = productById(picks.product);
  const modifier = modifierById(picks.modifier);
  if (column === 'products') return tonePool(PRODUCTS, tone).filter((item) => !modifier || modifierFits(modifier, item));
  if (column === 'audiences') return tonePool(AUDIENCES, tone);
  if (column === 'features') return tonePool(FEATURES, tone);
  return tonePool(MODIFIERS, tone).filter((item) => !product || modifierFits(item, product));
}

/**
 * Fresh cards for a step (HAND_SIZE of them). Products spread across kinds (a food, a gadget, a service…) and skip ids in `avoid`
 * (other players' cards); a reroll also skips the four on the table when there are enough left.
 */
export function dealHand(column: BuilderColumn, picks: BuilderPicks, tone: Tone, rng: Rng, avoid: readonly string[] = []): string[] {
  const pool = shuffle(columnPool(column, picks, tone), rng);
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
  return { product: null, modifier: null, audience: null, feature: null, connector: 'for', skipped: {}, hands: { products: [], modifiers: [], audiences: [], features: [] }, custom: {} };
}

/** A player's written-in text, cleaned: one line, no extra spaces, at most CUSTOM_MAX characters. */
export function cleanCustom(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, CUSTOM_MAX) : '';
}

/** What a step says in the headline: the written-in text, or the picked card's text. */
export function stepText(picks: HeadlinePicks, column: BuilderColumn): string | null {
  const custom = picks.custom?.[column];
  if (custom) return custom;
  if (column === 'products') return productById(picks.product)?.text ?? null;
  if (column === 'modifiers') return modifierById(picks.modifier)?.text ?? null;
  if (column === 'features') return featureById(picks.feature)?.text ?? null;
  return audienceById(picks.audience)?.text ?? null;
}

/** A step is done when it has a card, the player's own words, or the player skipped it. */
export function stepDone(picks: HeadlinePicks, column: BuilderColumn): boolean {
  return Boolean(stepText(picks, column) || (column !== 'products' && picks.skipped?.[column]));
}

/** What the headline needs from the picks. Only the product, twist and who are required, so older callers still fit. */
export type HeadlinePicks = Pick<BuilderPicks, 'product' | 'modifier' | 'audience'> & Partial<Pick<BuilderPicks, 'feature' | 'connector' | 'skipped' | 'custom'>>;

export function capitalize(text: string): string { return text.charAt(0).toUpperCase() + text.slice(1); }

/**
 * "[Twist] [product] [for] [who], [feature]". Missing and skipped picks are left out, and so is a card twist that doesn't
 * fit a card product. The feature follows a comma after a who ("…for the IRS, with a built-in bidet"), or the product.
 */
export function buildHeadline(picks: HeadlinePicks): string {
  const productText = stepText(picks, 'products');
  if (!productText) return '';
  const skipped = picks.skipped ?? {};
  const product = productById(picks.product);
  const modifier = modifierById(picks.modifier);
  const twist = skipped.modifiers ? null : picks.custom?.modifiers || (modifier && (!product || picks.custom?.products || modifierFits(modifier, product)) ? modifier.text : null);
  const audience = skipped.audiences ? null : stepText(picks, 'audiences');
  const feature = skipped.features ? null : stepText(picks, 'features');
  let text = [twist, productText].filter(Boolean).join(' ');
  if (audience) text += ` ${connectorText(picks.connector)} ${audience}`;
  if (feature) text += audience ? `, ${feature}` : ` ${feature}`;
  return capitalize(text);
}

/** Name roots from a written-in step: its longest word, capitalized ("flying hot tubs" gives "Flying"). */
function customRoot(text: string | undefined): string | undefined {
  const word = (text ?? '').replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length)[0];
  return word ? capitalize(word.toLowerCase()) : undefined;
}

export function businessNames(picks: Pick<BuilderPicks, 'product' | 'modifier'> & { custom?: BuilderPicks['custom'] }, tone: Tone, rng: Rng, count = 3): string[] {
  const card = productById(picks.product);
  const writtenRoot = customRoot(picks.custom?.products);
  const product = picks.custom?.products ? (writtenRoot ? { roots: [writtenRoot] } : null) : card;
  if (!product) return [];
  const modifierRoot = picks.custom?.modifiers ? customRoot(picks.custom.modifiers) : modifierById(picks.modifier)?.root;
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

/** The steps in this game, in reading order: the product always, the others unless the host switched them off. */
export function activeColumns(steps: Partial<Record<OptionalColumn, boolean>> | undefined): BuilderColumn[] {
  return COLUMNS.filter((column) => column === 'products' || steps?.[column] !== false);
}
