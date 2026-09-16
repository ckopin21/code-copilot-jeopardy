import { describe, expect, it } from 'vitest';
import { buildPack, category, question } from '../src/packs/buildPack';
import { builtInPacks } from '../src/packs';
import { QUESTION_VALUES } from '../src/shared/types';

const meta = {
  id: 'test-pack',
  title: 'Test Pack',
  theme: 'Testing',
  description: 'Pack builder tests.',
  difficulty: 'mixed' as const,
  approximateMinutes: 10
};

function completeCategory(name = 'Category') {
  return category(name, {
    100: question('Question 100?', 'A100'),
    200: question('Question 200?', 'A200'),
    300: question('Question 300?', 'A300'),
    400: question('Question 400?', 'A400', { responseMode: 'text' }),
    500: question('Question 500?', 'A500', { dailyDoubleEligible: false }),
    1000: question('Question 1000?', ['A1000', 'Alternate'])
  });
}

describe('question pack catalog', () => {
  it('loads every built-in pack with globally unique ids', () => {
    expect(builtInPacks.length).toBeGreaterThanOrEqual(3);
    expect(new Set(builtInPacks.map((pack) => pack.id)).size).toBe(builtInPacks.length);
    const questionIds = builtInPacks.flatMap((pack) => pack.questions.map((question) => question.id));
    expect(new Set(questionIds).size).toBe(questionIds.length);
  });

  it('maps explicit point values without relying on array position', () => {
    const pack = buildPack(meta, [completeCategory()]);
    expect(pack.questions.map((item) => item.value)).toEqual([...QUESTION_VALUES]);
    expect(pack.questions.find((item) => item.value === 400)?.responseMode).toBe('text');
    expect(pack.questions.find((item) => item.value === 500)?.dailyDoubleEligible).toBe(false);
    expect(pack.questions.find((item) => item.value === 1000)?.acceptedAnswers).toEqual(['A1000', 'Alternate']);
  });

  it('rejects duplicate category names before a game can start', () => {
    expect(() => buildPack(meta, [completeCategory('Same'), completeCategory('Same')])).toThrow(/duplicate category/i);
  });
});
