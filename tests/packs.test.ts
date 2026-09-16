import { describe, expect, it } from 'vitest';
import { buildPack, category, difficultyForValue, normalizeQuestionIdentity, question } from '../src/packs/buildPack';
import { builtInPacks, likelyRepeatedFact, validatePackCatalog } from '../src/packs';
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
  it('loads the expanded built-in catalog with globally unique ids', () => {
    expect(builtInPacks.length).toBeGreaterThanOrEqual(7);
    expect(new Set(builtInPacks.map((pack) => pack.id)).size).toBe(builtInPacks.length);
    const questionIds = builtInPacks.flatMap((pack) => pack.questions.map((item) => item.id));
    expect(new Set(questionIds).size).toBe(questionIds.length);
  });

  it('tracks question type and rejects repeated facts or prompt text across packs', () => {
    const questions = builtInPacks.flatMap((pack) => pack.questions);
    const factKeys = questions.map((item) => item.factKey);
    const promptKeys = questions.map((item) => normalizeQuestionIdentity(item.text));
    expect(questions.every((item) => Boolean(item.questionType && item.factKey))).toBe(true);
    expect(new Set(factKeys).size).toBe(factKeys.length);
    expect(new Set(promptKeys).size).toBe(promptKeys.length);
  });

  it('detects and rejects likely duplicate facts even when the wording changes', () => {
    const template = builtInPacks[0].questions[0];
    const left = {
      ...template,
      id: 'left-fact',
      packId: 'left-pack',
      text: 'Who wrote the science-fiction novel Dune?',
      acceptedAnswers: ['Frank Herbert'],
      questionType: 'person' as const,
      factKey: 'left-wording'
    };
    const reworded = {
      ...template,
      id: 'right-fact',
      packId: 'right-pack',
      text: 'Which author wrote the novel Dune?',
      acceptedAnswers: ['Frank Herbert'],
      questionType: 'person' as const,
      factKey: 'right-wording'
    };
    const differentFact = {
      ...reworded,
      id: 'different-fact',
      text: 'Which author was born in Tacoma, Washington?'
    };
    expect(likelyRepeatedFact(left, reworded)).toBe(true);
    expect(likelyRepeatedFact(left, differentFact)).toBe(false);

    const leftPack = { ...builtInPacks[0], id: 'left-pack', finalQuestionId: undefined, questions: [left] };
    const rightPack = { ...builtInPacks[1], id: 'right-pack', finalQuestionId: undefined, questions: [reworded] };
    expect(() => validatePackCatalog([leftPack, rightPack])).toThrow(/likely repeated fact/i);
  });

  it('scales difficulty consistently with clue value', () => {
    for (const pack of builtInPacks) {
      for (const item of pack.questions) expect(item.difficulty).toBe(difficultyForValue(item.value));
    }
    expect(difficultyForValue(100)).toBe('easy');
    expect(difficultyForValue(200)).toBe('easy');
    expect(difficultyForValue(300)).toBe('medium');
    expect(difficultyForValue(400)).toBe('medium');
    expect(difficultyForValue(500)).toBe('hard');
    expect(difficultyForValue(1000)).toBe('hard');
  });

  it('maps explicit point values without relying on array position', () => {
    const pack = buildPack(meta, [completeCategory()]);
    expect(pack.questions.map((item) => item.value)).toEqual([...QUESTION_VALUES]);
    expect(pack.questions.find((item) => item.value === 400)?.responseMode).toBe('text');
    expect(pack.questions.find((item) => item.value === 500)?.dailyDoubleEligible).toBe(false);
    expect(pack.questions.find((item) => item.value === 1000)?.acceptedAnswers).toEqual(['A1000', 'Alternate']);
  });

  it('rejects duplicate category names and duplicate facts before a game can start', () => {
    expect(() => buildPack(meta, [completeCategory('Same'), completeCategory('Same')])).toThrow(/duplicate category/i);
    const repeated = category('Repeated', {
      100: question('Same fact?', 'One', { factKey: 'same-fact' }),
      200: question('Reworded same fact?', 'One', { factKey: 'same-fact' }),
      300: question('Different 300?', 'A'),
      400: question('Different 400?', 'B'),
      500: question('Different 500?', 'C'),
      1000: question('Different 1000?', 'D')
    });
    expect(() => buildPack(meta, [repeated])).toThrow(/repeats the same fact/i);
  });
});
