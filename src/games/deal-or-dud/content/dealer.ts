// Pure content logic: builder compatibility, headlines, names, and dossiers. Shared by server and phones.
import type { BuilderPicks, Complexity, FactCard, ProductForm, Tone, Verdict } from '../types';
import { toneAllows } from '../types';
import { AUDIENCES, MODIFIERS, PRODUCTS, type ModifierWord, type ProductWord } from './words';
import { LATER_LINES, NAME_PATTERNS, PITCH_CUES, type ToneLine } from './cues';
import { GOOD_PROFILES } from './profilesGood';
import { BAD_PROFILES } from './profilesBad';
import { cardText, fillTokens, type ProfileFamily, type ProfileVariant } from './profileTypes';

export type Rng = () => number;

export const MAX_PER_COLUMN = 2;
export const ALL_PROFILES: readonly ProfileFamily[] = [...GOOD_PROFILES, ...BAD_PROFILES];

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

export const modifierById = (id: string) => MODIFIERS.find((item) => item.id === id);
export const productById = (id: string) => PRODUCTS.find((item) => item.id === id);
export const audienceById = (id: string) => AUDIENCES.find((item) => item.id === id);

export function tonePool<T extends { tone?: Tone }>(items: readonly T[], tone: Tone): T[] {
  return items.filter((item) => toneAllows(tone, item.tone));
}

export function modifierFits(modifier: ModifierWord, product: ProductWord): boolean {
  return modifier.forms.includes(product.form);
}

/** Products that every picked modifier works with. */
export function compatibleProducts(modifierIds: readonly string[], tone: Tone): ProductWord[] {
  const modifiers = modifierIds.map(modifierById).filter((item): item is ModifierWord => Boolean(item));
  return tonePool(PRODUCTS, tone).filter((product) => modifiers.every((modifier) => modifierFits(modifier, product)))
    .filter((product) => profilesForForm(product.form).good.length > 0 && profilesForForm(product.form).bad.length > 0);
}

/** Whether a builder option can be tapped given the current picks. Prevents unreadable headlines before they happen. */
export function optionAllowed(column: 'modifiers' | 'products' | 'audiences', id: string, picks: BuilderPicks, tone: Tone): boolean {
  if (picks[column].includes(id)) return true;
  if (picks[column].length >= MAX_PER_COLUMN) return false;
  if (column === 'audiences') return Boolean(audienceById(id)) && toneAllows(tone, audienceById(id)?.tone);
  if (column === 'products') {
    const product = productById(id);
    if (!product || !toneAllows(tone, product.tone)) return false;
    return picks.modifiers.every((modifierId) => { const modifier = modifierById(modifierId); return !modifier || modifierFits(modifier, product); });
  }
  const modifier = modifierById(id);
  if (!modifier || !toneAllows(tone, modifier.tone)) return false;
  // A modifier must fit every picked product and still leave at least one possible product.
  const products = picks.products.map(productById).filter((item): item is ProductWord => Boolean(item));
  if (products.length) return products.every((product) => modifierFits(modifier, product));
  return compatibleProducts([...picks.modifiers, id], tone).length > 0;
}

/** The product the headline is built around. */
export function mainProductOf(picks: BuilderPicks): ProductWord | null {
  const id = picks.mainProduct && picks.products.includes(picks.mainProduct) ? picks.mainProduct : picks.products[0] ?? picks.suppliedProduct;
  return id ? productById(id) ?? null : null;
}

export function supplyProduct(picks: BuilderPicks, tone: Tone, rng: Rng, avoid: readonly string[] = []): string {
  const options = compatibleProducts(picks.modifiers, tone);
  const fresh = options.filter((product) => !avoid.includes(product.id) && product.id !== picks.suppliedProduct);
  return pick(fresh.length ? fresh : options, rng).id;
}

function joinAnd(items: readonly string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function capitalize(text: string): string { return text.charAt(0).toUpperCase() + text.slice(1); }

/** "[Modifier(s)] [main product] for [audience(s)]", with modifiers in natural adjective order. */
export function buildHeadline(picks: BuilderPicks): string {
  const product = mainProductOf(picks);
  if (!product) return '';
  const modifiers = picks.modifiers.map(modifierById).filter((item): item is ModifierWord => Boolean(item))
    .filter((modifier) => modifierFits(modifier, product))
    .sort((a, b) => a.rank - b.rank)
    .map((modifier) => modifier.text);
  const audiences = picks.audiences.map(audienceById).filter(Boolean).map((audience) => audience!.text);
  const core = [...modifiers, product.text].join(' ');
  return capitalize(audiences.length ? `${core} for ${joinAnd(audiences)}` : core);
}

export function addOnProduct(picks: BuilderPicks): ProductWord | null {
  const main = mainProductOf(picks);
  const other = picks.products.find((id) => id !== main?.id);
  return other ? productById(other) ?? null : null;
}

export function businessNames(picks: BuilderPicks, tone: Tone, rng: Rng, count = 3): string[] {
  const product = mainProductOf(picks);
  if (!product) return [];
  const modifierRoots = picks.modifiers.map((id) => modifierById(id)?.root).filter((root): root is string => Boolean(root));
  const patterns = shuffle(tonePool(NAME_PATTERNS, tone), rng);
  const names = new Set<string>();
  for (const pattern of patterns) {
    if (names.size >= count) break;
    if (pattern.text.includes('{mod}') && !modifierRoots.length) continue;
    const name = pattern.text.replace('{root}', pick(product.roots, rng)).replace('{mod}', modifierRoots.length ? pick(modifierRoots, rng) : '');
    names.add(name);
  }
  return [...names];
}

export function profilesForForm(form: ProductForm): { good: ProfileVariant[]; bad: ProfileVariant[] } {
  const collect = (verdict: Verdict) => ALL_PROFILES.filter((family) => family.verdict === verdict)
    .flatMap((family) => family.variants.filter((variant) => variant.forms.includes(form)));
  return { good: collect('good'), bad: collect('bad') };
}

export function familyOfVariant(variantId: string): ProfileFamily | undefined {
  return ALL_PROFILES.find((family) => family.variants.some((variant) => variant.id === variantId));
}

export interface Dossier {
  variantId: string;
  explanation: string;
  cards: FactCard[];
}

/** Picks a verdict-matching variant for the product, avoiding recently used ones, and renders its six cards. */
export function dealDossier(product: ProductWord, verdict: Verdict, complexity: Complexity, rng: Rng, recentVariantIds: readonly string[]): Dossier {
  const pool = profilesForForm(product.form)[verdict];
  const fresh = pool.filter((variant) => !recentVariantIds.includes(variant.id));
  const variant = pick(fresh.length ? fresh : pool, rng);
  const family = familyOfVariant(variant.id)!;
  const cards: FactCard[] = shuffle(variant.cards.map((card, index) => ({
    id: `${variant.id}:${index}`,
    subject: card[0],
    polarity: card[1] === '+' ? 'favorable' as const : 'unfavorable' as const,
    text: fillTokens(cardText(card, complexity), product.form, product.short)
  })), rng);
  return { variantId: variant.id, explanation: family.explain, cards };
}

export function laterLine(verdict: Verdict, tone: Tone, name: string, short: string, rng: Rng): string {
  const line = pick(tonePool(LATER_LINES, tone).filter((item) => item.verdict === verdict), rng);
  // Names like "Sway Bros." already end in a period.
  return line.text.replaceAll('{name}', name).replaceAll('{short}', short).replaceAll('..', '.');
}

export function toneLine(pool: readonly ToneLine[], tone: Tone, rng: Rng): ToneLine {
  return pick(tonePool(pool, tone), rng);
}


export function pitchCueIds(tone: Tone, rng: Rng, count = 4): string[] {
  return shuffle(tonePool(PITCH_CUES, tone), rng).slice(0, count).map((cue) => cue.id);
}
