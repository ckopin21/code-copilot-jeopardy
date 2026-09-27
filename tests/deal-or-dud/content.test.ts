import { describe, expect, it } from 'vitest';
import { HAND_SIZE, buildHeadline, businessNames, columnPool, dealHand, emptyBuilder, tonePool } from '../../src/games/deal-or-dud/content/dealer';
import { AUDIENCES, MODIFIERS, PRODUCTS } from '../../src/games/deal-or-dud/content/words';
import { AVATAR_PRESETS, FORECAST_CARDS, NAME_PATTERNS } from '../../src/games/deal-or-dud/content/cues';
import type { ProductForm, Tone } from '../../src/games/deal-or-dud/types';

const TONES: Tone[] = ['clean', 'silly', 'crude'];
const FORMS: ProductForm[] = ['food', 'gadget', 'goods', 'pet', 'service', 'rental', 'digital', 'event'];
/** The deck can be as absurd as it likes, but never sexual. */
const SEXUAL = /\b(sex|sexy|sexual|nude|naked|strip|stripper|porn|horny|kinky|fetish|erotic|lingerie|nsfw|booty|boob|thong|orgy|seduc|lust|condom|viagra|onlyfans|hooker|brothel|bedroom)\w*/i;

function seeded(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
}

describe('deal-or-dud content ids', () => {
  it('keeps ids unique', () => {
    for (const pool of [MODIFIERS, PRODUCTS, AUDIENCES, AVATAR_PRESETS, FORECAST_CARDS, NAME_PATTERNS]) {
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
    for (const tone of TONES) for (const form of FORMS) expect(tonePool(PRODUCTS, tone).filter((product) => product.form === form).length, `${tone} ${form}`).toBeGreaterThanOrEqual(5);
  });

  it('gives every card an emoji', () => {
    for (const item of [...PRODUCTS, ...MODIFIERS, ...AUDIENCES]) expect(item.emoji, item.id).toMatch(/\p{Extended_Pictographic}|\p{Regional_Indicator}|[🟠🟢]/u);
  });

  it('keeps the whole deck, names included, free of anything sexual', () => {
    const texts = [
      ...MODIFIERS.flatMap((item) => [item.text, item.root ?? '']),
      ...PRODUCTS.flatMap((item) => [item.text, item.short, ...item.roots]),
      ...AUDIENCES.map((item) => item.text),
      ...AVATAR_PRESETS.map((item) => item.label),
      ...NAME_PATTERNS.map((item) => item.text),
      ...FORECAST_CARDS.flatMap((item) => [item.title, item.question, ...item.clues])
    ];
    expect(texts.filter((text) => SEXUAL.test(text))).toEqual([]);
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
    const again = dealHand('products', picks, 'silly', rng, ['snitch-toasters']);
    expect(again.some((id) => picks.hands.products.includes(id))).toBe(false);
    expect(again).not.toContain('snitch-toasters');
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
  it('uses written-in steps as typed, and any twist fits a written-in product', () => {
    expect(buildHeadline({ product: null, modifier: 'edible', audience: 'the-irs', custom: { products: 'flying hot tubs' } })).toBe('Edible flying hot tubs for the IRS');
    expect(buildHeadline({ product: 'wifi-stealers', modifier: null, audience: null, custom: { modifiers: 'extremely haunted', audiences: 'my cousin Greg' } })).toBe('Extremely haunted apps that steal wifi passwords for my cousin Greg');
    expect(businessNames({ product: null, modifier: null, custom: { products: 'flying hot tubs' } }, 'crude', seeded(3)).some((name) => name.includes('Flying'))).toBe(true);
  });

  it('builds "twist product for audience" headlines', () => {
    expect(buildHeadline({ product: 'gas-station-sushi', modifier: 'radioactive', audience: 'the-irs' })).toBe('Radioactive gas station sushi for the IRS');
    expect(buildHeadline({ product: 'raccoon-butlers', modifier: null, audience: 'your-ex' })).toBe('Raccoon butlers for your ex');
    expect(buildHeadline({ product: null, modifier: 'cursed', audience: 'pirates' })).toBe('');
    // A twist that doesn't fit the product is left out rather than breaking the headline.
    expect(buildHeadline({ product: 'wifi-stealers', modifier: 'edible', audience: null })).toBe('Apps that steal wifi passwords');
  });

  it('makes three distinct business names', () => {
    const names = businessNames({ product: 'snitch-toasters', modifier: 'radioactive' }, 'crude', seeded(7));
    expect(new Set(names).size).toBe(3);
  });
});
