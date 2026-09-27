import { describe, expect, it } from 'vitest';
import { HAND_SIZE, buildHeadline, businessNames, columnPool, dealHand, emptyBuilder, tonePool } from '../../src/games/deal-or-dud/content/dealer';
import { AUDIENCES, MODIFIERS, PRODUCTS } from '../../src/games/deal-or-dud/content/words';
import { AVATAR_PRESETS, FORECAST_CARDS, NAME_PATTERNS } from '../../src/games/deal-or-dud/content/cues';
import type { ProductForm, Tone } from '../../src/games/deal-or-dud/types';

const TONES: Tone[] = ['clean', 'silly', 'crude'];
const FORMS: ProductForm[] = ['food', 'gadget', 'goods', 'pet', 'service', 'rental', 'digital', 'event'];
const CLEAN_BANNED = /\b(stink|stinky|fart|burp|belch|toot|sweaty?b|sweating|slime|slimy|haunted|ghost|zombie|vampire|blood|dead|kill|toilet|potty|butt|poop|pee|gross|spicy|sexy|drunk|cursed)\w*/i;

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

  it('keeps Clean pools free of crude, gross, or creepy words', () => {
    const texts = [
      ...tonePool(MODIFIERS, 'clean').flatMap((item) => [item.text, item.root ?? '']),
      ...tonePool(PRODUCTS, 'clean').flatMap((item) => [item.text, ...item.roots]),
      ...tonePool(AUDIENCES, 'clean').map((item) => item.text),
      ...tonePool(AVATAR_PRESETS, 'clean').map((item) => item.label),
      ...tonePool(NAME_PATTERNS, 'clean').map((item) => item.text),
      ...tonePool(FORECAST_CARDS, 'clean').flatMap((item) => [item.title, item.question, ...item.clues])
    ];
    expect(texts.filter((text) => CLEAN_BANNED.test(text))).toEqual([]);
  });

  it('offers at least a full hand of twists for every product, in every tone', () => {
    for (const tone of TONES) for (const product of tonePool(PRODUCTS, tone)) {
      expect(columnPool('modifiers', product, tone).length, `${product.id} in ${tone}`).toBeGreaterThanOrEqual(HAND_SIZE * 2);
    }
  });

  it('deals four cards of different kinds, and new ones on a reroll', () => {
    const rng = seeded(5);
    const picks = emptyBuilder();
    picks.hands.products = dealHand('products', picks, 'silly', rng);
    expect(picks.hands.products).toHaveLength(4);
    expect(new Set(picks.hands.products.map((id) => PRODUCTS.find((item) => item.id === id)!.form)).size).toBe(4);
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
  it('builds "twist product for audience" headlines', () => {
    expect(buildHeadline({ product: 'toasters', modifier: 'pirate-themed', audience: 'grandmas' })).toBe('Pirate-themed toasters for grandmas');
    expect(buildHeadline({ product: 'cupcakes', modifier: null, audience: 'astronauts' })).toBe('Cupcakes for astronauts');
    expect(buildHeadline({ product: null, modifier: 'luxury', audience: 'pirates' })).toBe('');
    // A twist that doesn't fit the product is left out rather than breaking the headline.
    expect(buildHeadline({ product: 'homework-apps', modifier: 'edible', audience: null })).toBe('Homework apps');
  });

  it('makes three distinct business names', () => {
    const names = businessNames({ product: 'toasters', modifier: 'luxury' }, 'clean', seeded(7));
    expect(new Set(names).size).toBe(3);
  });
});
