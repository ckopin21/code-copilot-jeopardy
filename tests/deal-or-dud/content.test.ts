import { describe, expect, it } from 'vitest';
import { HAND_SIZE, buildHeadline, columnPool, dealHand, emptyBuilder, tonePool } from '../../src/games/deal-or-dud/content/dealer';
import { AUDIENCES, CONNECTORS, FEATURES, MODIFIERS, PRODUCTS } from '../../src/games/deal-or-dud/content/words';
import { AVATAR_PRESETS, FORECAST_CARDS } from '../../src/games/deal-or-dud/content/cues';
import type { ProductForm, Tone } from '../../src/games/deal-or-dud/types';

const TONES: Tone[] = ['clean', 'silly', 'crude'];
const FORMS: ProductForm[] = ['food', 'gadget', 'goods', 'pet', 'service', 'rental', 'digital', 'event'];
/**
 * The deck can be as crude and absurd as it likes, and jokes about sexuality and dating are fine, but no sex: no sex acts,
 * nudity, porn or body parts in that sense.
 */
const SEX = /\b(sex|having sex|sex toy|nude|naked|stripper|porn|horny|kinky|fetish|erotic|lingerie|nsfw|booty call|boob|nipple|thong|orgy|orgasm|seduc|condom|viagra|onlyfans|hooker|brothel|penis|vagina|dick|cock|pussy|dildo|vibrator|masturbat|cum|hookup|hook up|foreplay|threesome|blowjob|handjob|snatch|squirt|69)\b/i;

function seeded(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
}

describe('deal-or-dud content ids', () => {
  it('keeps ids unique', () => {
    for (const pool of [MODIFIERS, PRODUCTS, AUDIENCES, FEATURES, CONNECTORS, AVATAR_PRESETS, FORECAST_CARDS]) {
      const ids = pool.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('deal-or-dud card builder', () => {
  it('meets the size targets', () => {
    expect(tonePool(PRODUCTS, 'clean').length).toBeGreaterThanOrEqual(60);
    expect(tonePool(MODIFIERS, 'clean').length).toBeGreaterThanOrEqual(35);
    expect(tonePool(AUDIENCES, 'clean').length).toBeGreaterThanOrEqual(35);
    expect(tonePool(FEATURES, 'clean').length).toBeGreaterThanOrEqual(HAND_SIZE * 4);
    for (const tone of TONES) for (const form of FORMS) expect(tonePool(PRODUCTS, tone).filter((product) => product.form === form).length, `${tone} ${form}`).toBeGreaterThanOrEqual(5);
  });

  it('gives every card an emoji', () => {
    for (const item of [...PRODUCTS, ...MODIFIERS, ...AUDIENCES, ...FEATURES]) expect(item.emoji, item.id).toMatch(/\p{Extended_Pictographic}|\p{Regional_Indicator}|[🟠🟢]/u);
  });

  it('keeps sex out of the whole deck, names included', () => {
    const texts = [
      ...MODIFIERS.map((item) => item.text),
      ...PRODUCTS.map((item) => item.text),
      ...AUDIENCES.map((item) => item.text),
      ...FEATURES.map((item) => item.text),
      ...AVATAR_PRESETS.map((item) => item.label),
      ...FORECAST_CARDS.flatMap((item) => [item.title, item.question, ...item.clues])
    ];
    expect(texts.filter((text) => SEX.test(text))).toEqual([]);
  });

  it('writes every feature so it reads after any product, one or many ("with…", not "that explodes")', () => {
    expect(FEATURES.length).toBeGreaterThanOrEqual(40);
    for (const feature of FEATURES) expect(feature.text, feature.id).toMatch(/^(with|plus|now|guaranteed|powered|narrated|delivered|shipped|signed|approved|blessed|sold|assembled|endorsed|covered|wrapped)\b/);
  });

  it('offers at least a full hand of twists for every product, in every tone', () => {
    for (const tone of TONES) for (const product of tonePool(PRODUCTS, tone)) {
      expect(columnPool('modifiers', { product: product.id, modifier: null }, tone).length, `${product.id} in ${tone}`).toBeGreaterThanOrEqual(HAND_SIZE * 2);
    }
  });

  it('offers at least a full hand of products for every twist (the twist is picked first)', () => {
    for (const modifier of MODIFIERS) {
      expect(columnPool('products', { product: null, modifier: modifier.id }, 'crude').length, modifier.id).toBeGreaterThanOrEqual(HAND_SIZE * 2);
    }
  });

  it('deals six cards of different kinds, and new ones on a reroll', () => {
    const rng = seeded(5);
    const picks = emptyBuilder();
    picks.hands.products = dealHand('products', picks, 'silly', rng);
    expect(picks.hands.products).toHaveLength(6);
    expect(new Set(picks.hands.products.map((id) => PRODUCTS.find((item) => item.id === id)!.form)).size).toBe(6);
    const again = dealHand('products', picks, 'silly', rng, ['toasters']);
    expect(again.some((id) => picks.hands.products.includes(id))).toBe(false);
    expect(again).not.toContain('toasters');
  });

  it('never deals a Crude card in a Clean game', () => {
    const rng = seeded(9);
    for (let i = 0; i < 200; i += 1) {
      const picks = emptyBuilder();
      for (const column of ['products', 'audiences'] as const) {
        for (const id of dealHand(column, picks, 'clean', rng)) expect([...PRODUCTS, ...AUDIENCES].find((item) => item.id === id)!.tone ?? 'clean').toBe('clean');
      }
    }
  });

  it('checks the tiebreaker answers are positive whole numbers', () => {
    for (const card of FORECAST_CARDS) expect(Number.isInteger(card.answer) && card.answer > 0).toBe(true);
  });

  it('has enough of each pool for four rounds in every tone', () => {
    for (const tone of TONES) {
      expect(tonePool(FORECAST_CARDS, tone).length).toBeGreaterThanOrEqual(4);
      expect(tonePool(AVATAR_PRESETS, tone).length).toBeGreaterThanOrEqual(12);
    }
  });
});

describe('deal-or-dud headlines', () => {
  it('keeps every product short and general, so it works on its own (the only required card)', () => {
    for (const product of PRODUCTS) expect(product.text.split(' ').length, product.id).toBeLessThanOrEqual(3);
  });

  it('uses written-in steps as typed', () => {
    expect(buildHeadline({ product: 'toasters', modifier: null, audience: null, custom: { modifiers: 'extremely haunted', audiences: 'my cousin Greg' } })).toBe('Extremely haunted toasters for my cousin Greg');
  });

  it('adds the word before the who, a feature, and leaves skipped steps out', () => {
    expect(buildHeadline({ product: 'gas-station-sushi', modifier: 'radioactive', audience: 'the-irs', connector: 'made-by', feature: 'bidet' }))
      .toBe('Radioactive gas station sushi made by the IRS, with a built-in bidet');
    expect(buildHeadline({ product: 'gas-station-sushi', modifier: 'radioactive', audience: 'the-irs', feature: 'bidet', skipped: { audiences: true, modifiers: true } }))
      .toBe('Gas station sushi with a built-in bidet');
    expect(buildHeadline({ product: 'raccoons', modifier: null, audience: 'your-ex', connector: 'nonsense', custom: { features: 'plus a tiny hat' } })).toBe('Raccoons for your ex, plus a tiny hat');
  });

  it('builds "twist product for audience" headlines', () => {
    expect(buildHeadline({ product: 'gas-station-sushi', modifier: 'radioactive', audience: 'the-irs' })).toBe('Radioactive gas station sushi for the IRS');
    expect(buildHeadline({ product: 'raccoons', modifier: null, audience: 'your-ex' })).toBe('Raccoons for your ex');
    expect(buildHeadline({ product: null, modifier: 'cursed', audience: 'pirates' })).toBe('');
    // A twist that doesn't fit the product is left out rather than breaking the headline.
    expect(buildHeadline({ product: 'dating-apps', modifier: 'edible', audience: null })).toBe('Dating apps');
  });
});
