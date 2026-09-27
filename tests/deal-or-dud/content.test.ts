import { describe, expect, it } from 'vitest';
import {
  HAND_SIZE, buildHeadline, businessNames, columnPool, dealHand, dealScorecard, emptyBuilder, explainScorecard, passCount,
  scoreLinesFor, tonePool
} from '../../src/games/deal-or-dud/content/dealer';
import { AUDIENCES, MODIFIERS, PRODUCTS } from '../../src/games/deal-or-dud/content/words';
import { AVATAR_PRESETS, FORECAST_CARDS, LATER_LINES, NAME_PATTERNS, PITCH_CUES } from '../../src/games/deal-or-dud/content/cues';
import { CATEGORIES, CATEGORY_QUESTIONS, SCORE_LINES, fillTokens } from '../../src/games/deal-or-dud/content/scorecard';
import { CATEGORY_IDS, type ProductForm, type Tone } from '../../src/games/deal-or-dud/types';

const TONES: Tone[] = ['clean', 'silly', 'crude'];
const FORMS: ProductForm[] = ['food', 'gadget', 'goods', 'pet', 'service', 'rental', 'digital', 'event'];
const JARGON = /\b(margin|margins|valuation|acquisition|year-over-year|revenue|ebitda|equity|churn|roi|profit margin|cac|ltv|liabilit)/i;
const CLEAN_BANNED = /\b(stink|stinky|fart|burp|belch|toot|sweaty?b|sweating|slime|slimy|haunted|ghost|zombie|vampire|blood|dead|kill|toilet|potty|butt|poop|pee|gross|spicy|sexy|drunk|cursed)\w*/i;

function seeded(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
}

describe('deal-or-dud scorecard lines', () => {
  it('has four fixed checks in a fixed order', () => {
    expect(CATEGORIES.map((category) => category.id)).toEqual([...CATEGORY_IDS]);
  });

  it('keeps every line short, plain and free of leftover tokens', () => {
    const problems: string[] = [];
    for (const line of SCORE_LINES) {
      if (line.text.length > 48) problems.push(`${line.id}: too long for a tile "${line.text}"`);
      if ((line.text.match(/\d[\d,.]*/g) ?? []).length > 1) problems.push(`${line.id}: more than one number`);
      if (JARGON.test(line.text)) problems.push(`${line.id}: jargon`);
      if (!line.tone && CLEAN_BANNED.test(line.text)) problems.push(`${line.id}: not clean`);
      for (const form of line.forms ?? FORMS) if (/[{}]/.test(fillTokens(line.text, form, 'things'))) problems.push(`${line.id}: token left for ${form}`);
    }
    expect(problems).toEqual([]);
  });

  it('has at least three lines for every check, result and product kind, in every tone', () => {
    const thin: string[] = [];
    for (const tone of TONES) for (const form of FORMS) for (const category of CATEGORY_IDS) for (const ok of [true, false]) {
      if (scoreLinesFor(category, ok, form, tone).length < 3) thin.push(`${tone} ${form} ${category} ${ok ? '✅' : '❌'}`);
    }
    expect(thin).toEqual([]);
  });

  it('keeps ids unique', () => {
    for (const pool of [SCORE_LINES, CATEGORY_QUESTIONS, MODIFIERS, PRODUCTS, AUDIENCES, AVATAR_PRESETS, FORECAST_CARDS, LATER_LINES, PITCH_CUES, NAME_PATTERNS]) {
      const ids = pool.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('gives GOOD three or four ✅ and BAD zero to two, at the agreed odds', () => {
    const rng = seeded(11);
    const counts = { good: [0, 0, 0, 0, 0], bad: [0, 0, 0, 0, 0] };
    for (let i = 0; i < 20_000; i += 1) { counts.good[passCount('good', rng)] += 1; counts.bad[passCount('bad', rng)] += 1; }
    expect(counts.good.slice(0, 3)).toEqual([0, 0, 0]);
    expect(counts.good[3] / 20_000).toBeCloseTo(0.7, 1);
    expect(counts.bad.slice(3)).toEqual([0, 0]);
    expect(counts.bad[2] / 20_000).toBeCloseTo(0.5, 1);
    expect(counts.bad[0] / 20_000).toBeCloseTo(0.15, 1);
  });

  it('deals a matching scorecard for every product, with lines that fit the product', () => {
    const rng = seeded(3);
    for (const product of PRODUCTS) {
      for (const verdict of ['good', 'bad'] as const) {
        const card = dealScorecard(product, verdict, product.tone ?? 'clean', rng);
        expect(card.rows.map((row) => row.category)).toEqual([...CATEGORY_IDS]);
        const passed = card.rows.filter((row) => row.ok).length;
        expect(verdict === 'good' ? passed >= 3 : passed <= 2).toBe(true);
        for (const row of card.rows) {
          const source = SCORE_LINES.find((line) => line.id === row.lineId)!;
          expect(source.ok).toBe(row.ok);
          expect(!source.forms || source.forms.includes(product.form)).toBe(true);
          expect(row.text).not.toMatch(/[{}]/);
        }
        expect(card.explanation).toMatch(/\.$/);
      }
    }
  });

  it('explains the result in one plain sentence', () => {
    const row = (category: typeof CATEGORY_IDS[number], ok: boolean) => ({ category, ok, text: '', lineId: '' });
    expect(explainScorecard('good', CATEGORY_IDS.map((id) => row(id, true)))).toBe('All four checks passed. A real winner.');
    expect(explainScorecard('good', [row('works', true), row('demand', true), row('money', false), row('trouble', true)])).toBe('Three of four checks passed. It loses money, but that is fixable.');
    expect(explainScorecard('bad', [row('works', true), row('demand', false), row('money', false), row('trouble', true)])).toBe('Hardly anyone wants it and it loses money. Too much to fix.');
    expect(explainScorecard('bad', CATEGORY_IDS.map((id) => row(id, false)))).toBe('Zero checks passed. A total dud.');
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
      ...tonePool(LATER_LINES, 'clean').map((item) => item.text),
      ...tonePool(PITCH_CUES, 'clean').map((item) => item.text),
      ...tonePool(CATEGORY_QUESTIONS, 'clean').map((item) => item.text),
      ...tonePool(SCORE_LINES, 'clean').map((item) => item.text),
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
      for (const verdict of ['good', 'bad'] as const) expect(tonePool(LATER_LINES, tone).filter((line) => line.verdict === verdict).length).toBeGreaterThanOrEqual(8);
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
