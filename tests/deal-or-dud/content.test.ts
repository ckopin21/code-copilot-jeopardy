import { describe, expect, it } from 'vitest';
import { ALL_PROFILES, businessNames, buildHeadline, compatibleProducts, dealDossier, optionAllowed, profilesForForm, tonePool } from '../../src/games/deal-or-dud/content/dealer';
import { AUDIENCES, MODIFIERS, PRODUCTS } from '../../src/games/deal-or-dud/content/words';
import { AVATAR_PRESETS, FORECAST_CARDS, LATER_LINES, NAME_PATTERNS, PITCH_CUES, SHARK_QUESTIONS } from '../../src/games/deal-or-dud/content/cues';
import { SUBJECTS } from '../../src/games/deal-or-dud/content/subjects';
import { cardText, fillTokens } from '../../src/games/deal-or-dud/content/profileTypes';
import type { BuilderPicks, Complexity, ProductForm, Tone } from '../../src/games/deal-or-dud/types';

const COMPLEXITIES: Complexity[] = ['simple', 'standard', 'challenge'];
const TONES: Tone[] = ['clean', 'silly', 'crude'];
const FORMS: ProductForm[] = ['food', 'gadget', 'goods', 'pet', 'service', 'rental', 'digital', 'event'];
const JARGON = /\b(margin|margins|valuation|acquisition|year-over-year|revenue|ebitda|equity|churn|roi|profit margin|cac|ltv|liabilit)/i;
const CLEAN_BANNED = /\b(stink|stinky|fart|burp|belch|toot|sweaty?b|sweating|slime|slimy|haunted|ghost|zombie|vampire|blood|dead|kill|toilet|potty|butt|poop|pee|gross|spicy|sexy|drunk)\w*/i;
const empty = (): BuilderPicks => ({ modifiers: [], products: [], audiences: [], mainProduct: null, suppliedProduct: null });

function numberGroups(text: string): number {
  return (text.match(/\d[\d,.]*/g) ?? []).length;
}

describe('deal-or-dud profiles', () => {
  it('has at least 20 GOOD and 20 BAD families', () => {
    expect(ALL_PROFILES.filter((family) => family.verdict === 'good').length).toBeGreaterThanOrEqual(20);
    expect(ALL_PROFILES.filter((family) => family.verdict === 'bad').length).toBeGreaterThanOrEqual(20);
  });

  it('gives every variant three favorable and three unfavorable cards on distinct, fitting subjects', () => {
    const problems: string[] = [];
    const ids = new Set<string>();
    for (const family of ALL_PROFILES) {
      if (!family.explain.endsWith('.')) problems.push(`${family.id}: explanation must be a sentence`);
      for (const variant of family.variants) {
        if (ids.has(variant.id)) problems.push(`${variant.id}: duplicate id`);
        ids.add(variant.id);
        const plus = variant.cards.filter((card) => card[1] === '+').length;
        if (plus !== 3) problems.push(`${variant.id}: ${plus} favorable cards`);
        const subjects = variant.cards.map((card) => card[0]);
        if (new Set(subjects).size !== 6) problems.push(`${variant.id}: repeated subject ${subjects.filter((s, i) => subjects.indexOf(s) !== i).join(',')}`);
        for (const card of variant.cards) {
          const subject = SUBJECTS.find((item) => item.id === card[0]);
          if (!subject) { problems.push(`${variant.id}: unknown subject ${card[0]}`); continue; }
          const misfit = variant.forms.filter((form) => !subject.forms.includes(form));
          if (misfit.length) problems.push(`${variant.id}: ${card[0]} does not suit ${misfit.join(',')}`);
          for (const complexity of COMPLEXITIES) {
            const text = cardText(card, complexity);
            if (numberGroups(text) > 1) problems.push(`${variant.id}: more than one number in "${text}"`);
            if (text.length > 95) problems.push(`${variant.id}: too long "${text}"`);
            if (JARGON.test(text)) problems.push(`${variant.id}: jargon in "${text}"`);
            if (CLEAN_BANNED.test(text)) problems.push(`${variant.id}: facts must be clean "${text}"`);
            for (const form of variant.forms) {
              if (/[{}]/.test(fillTokens(text, form, 'things'))) problems.push(`${variant.id}: unresolved token "${text}"`);
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('gives every family at least two variants', () => {
    expect(ALL_PROFILES.filter((family) => family.variants.length < 2).map((family) => family.id)).toEqual([]);
  });

  it('offers several GOOD and BAD variants for every product form', () => {
    for (const form of FORMS) {
      const { good, bad } = profilesForForm(form);
      expect.soft(good.length, `${form} good`).toBeGreaterThanOrEqual(6);
      expect.soft(bad.length, `${form} bad`).toBeGreaterThanOrEqual(6);
    }
  });

  it('renders a dossier for every product with no leftover tokens', () => {
    let seed = 1;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const product of PRODUCTS) {
      for (const verdict of ['good', 'bad'] as const) {
        const dossier = dealDossier(product, verdict, 'standard', rng, []);
        expect(dossier.cards).toHaveLength(6);
        for (const card of dossier.cards) expect(card.text).not.toMatch(/[{}]/);
      }
    }
  });
});

describe('deal-or-dud word pools', () => {
  it('meets the size targets', () => {
    expect(MODIFIERS.length).toBeGreaterThanOrEqual(40);
    expect(PRODUCTS.length).toBeGreaterThanOrEqual(80);
    expect(AUDIENCES.length).toBeGreaterThanOrEqual(40);
    expect(tonePool(PRODUCTS, 'clean').length).toBeGreaterThanOrEqual(60);
    expect(tonePool(MODIFIERS, 'clean').length).toBeGreaterThanOrEqual(30);
    expect(tonePool(AUDIENCES, 'clean').length).toBeGreaterThanOrEqual(30);
  });

  it('keeps ids unique', () => {
    for (const pool of [MODIFIERS, PRODUCTS, AUDIENCES, AVATAR_PRESETS, FORECAST_CARDS, LATER_LINES, PITCH_CUES, SHARK_QUESTIONS, NAME_PATTERNS]) {
      const ids = pool.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('keeps Clean pools free of crude, gross, or creepy words', () => {
    const texts = [
      ...tonePool(MODIFIERS, 'clean').map((item) => item.text),
      ...tonePool(PRODUCTS, 'clean').map((item) => item.text),
      ...tonePool(AUDIENCES, 'clean').map((item) => item.text),
      ...tonePool(AVATAR_PRESETS, 'clean').map((item) => item.label),
      ...tonePool(LATER_LINES, 'clean').map((item) => item.text),
      ...tonePool(PITCH_CUES, 'clean').map((item) => item.text),
      ...tonePool(SHARK_QUESTIONS, 'clean').map((item) => item.text),
      ...tonePool(NAME_PATTERNS, 'clean').map((item) => item.text),
      ...tonePool(FORECAST_CARDS, 'clean').flatMap((item) => [item.title, item.question, ...item.clues])
    ];
    expect(texts.filter((text) => CLEAN_BANNED.test(text))).toEqual([]);
    const cleanRoots = tonePool(PRODUCTS, 'clean').flatMap((item) => item.roots).concat(tonePool(MODIFIERS, 'clean').map((item) => item.root ?? ''));
    expect(cleanRoots.filter((text) => CLEAN_BANNED.test(text))).toEqual([]);
  });

  it('lets every modifier produce a product in every tone it appears in', () => {
    for (const tone of TONES) {
      for (const modifier of tonePool(MODIFIERS, tone)) {
        expect(compatibleProducts([modifier.id], tone).length, `${modifier.id} in ${tone}`).toBeGreaterThan(0);
      }
    }
  });

  it('has enough of each pool for four rounds in every tone', () => {
    for (const tone of TONES) {
      expect(tonePool(FORECAST_CARDS, tone).length).toBeGreaterThanOrEqual(4);
      expect(tonePool(AVATAR_PRESETS, tone).length).toBeGreaterThanOrEqual(12);
      for (const verdict of ['good', 'bad'] as const) expect(tonePool(LATER_LINES, tone).filter((line) => line.verdict === verdict).length).toBeGreaterThanOrEqual(8);
    }
  });

  it('checks the tiebreaker answers are positive whole numbers', () => {
    for (const card of FORECAST_CARDS) expect(Number.isInteger(card.answer) && card.answer > 0).toBe(true);
  });
});

describe('deal-or-dud headlines', () => {
  it('builds natural headlines', () => {
    const picks = { ...empty(), modifiers: ['edible', 'haunted'], suppliedProduct: 'cookies' };
    expect(buildHeadline(picks)).toBe('Haunted edible cookies');
    expect(buildHeadline({ ...picks, audiences: ['retired-magicians'] })).toBe('Haunted edible cookies for retired magicians');
    expect(buildHeadline({ ...picks, audiences: ['retired-magicians', 'pirates'] })).toBe('Haunted edible cookies for retired magicians and pirates');
    expect(buildHeadline({ ...empty(), products: ['alarm-clocks', 'cookies'], mainProduct: 'cookies' })).toBe('Cookies');
  });

  it('blocks modifiers that do not fit the chosen product', () => {
    const picks = { ...empty(), products: ['homework-apps'] };
    expect(optionAllowed('modifiers', 'edible', picks, 'silly')).toBe(false);
    expect(optionAllowed('modifiers', 'self-aware', picks, 'silly')).toBe(true);
    expect(optionAllowed('modifiers', 'haunted', empty(), 'clean')).toBe(false);
  });

  it('makes three distinct business names', () => {
    let seed = 7;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const names = businessNames({ ...empty(), products: ['toasters'], modifiers: ['luxury'] }, 'clean', rng);
    expect(new Set(names).size).toBe(3);
  });
});
