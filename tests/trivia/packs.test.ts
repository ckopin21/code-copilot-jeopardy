import { describe, expect, it } from 'vitest';
import { buildPack, category, difficultyForValue, normalizeQuestionIdentity, question } from '../../src/games/trivia/packs/buildPack';
import { builtInPacks, likelyRepeatedFact, likelySimilarQuestions, validatePackCatalog } from '../../src/games/trivia/packs';
import { QUESTION_VALUES } from '../../src/games/trivia/types';

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
    expect(likelySimilarQuestions([leftPack, rightPack])).toEqual([expect.objectContaining({ left, right: reworded })]);
    expect(() => validatePackCatalog([leftPack, rightPack])).not.toThrow();
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

  it('rejects malformed authoring input with the pack/category/value location', () => {
    expect(() => buildPack(meta, [category('Broken', {
      100: question('Valid?', 'Yes'), 200: question('Valid 2?', 'Two'), 300: question('Valid 3?', 'Three'),
      400: question('Valid 4?', 'Four'), 500: question('Valid 5?', 'Five'), 1000: question('Valid 6?', 'Six'), 700: question('Unsupported?', 'No')
    } as never)])).toThrow(/Broken.*unsupported value/i);
    const normalizedAlternatives = buildPack(meta, [category('Answers', {
      100: question('Same answer?', ['Yes', ' yes! ']), 200: question('Two?', 'Two'), 300: question('Three?', 'Three'),
      400: question('Four?', 'Four'), 500: question('Five?', 'Five'), 1000: question('Six?', 'Six')
    })]);
    expect(normalizedAlternatives.questions[0].acceptedAnswers).toHaveLength(1);
  });

  it('reports close but non-identical clues for review without blocking legitimate related questions', () => {
    const template = builtInPacks[0].questions[0];
    const left = { ...template, id: 'review-left', packId: 'review', text: 'Which planet is known as the red planet in our solar system?', acceptedAnswers: ['Mars'], factKey: 'mars-red' };
    const right = { ...template, id: 'review-right', packId: 'review', text: 'Which planet is known as the red planet in the solar system?', acceptedAnswers: ['Earth'], factKey: 'earth-red' };
    const reviewPack = { ...builtInPacks[0], id: 'review', finalQuestionId: undefined, questions: [left, right] };
    expect(likelySimilarQuestions([reviewPack])).toEqual([expect.objectContaining({ left, right })]);
    expect(() => validatePackCatalog([reviewPack])).not.toThrow();
  });

  it('reports built-in near duplicates with both locations and clue text for editorial review', () => {
    for (const { left, right } of likelySimilarQuestions(builtInPacks)) {
      console.warn(`Near-duplicate review: ${left.packId}/${left.category}/${left.value} (${left.id}) "${left.text}" -> ${right.packId}/${right.category}/${right.value} (${right.id}) "${right.text}"`);
    }
  });

  it('rejects malformed pack metadata and compiled question fields at their location', () => {
    expect(() => buildPack({ ...meta, supportedGameModes: ['invalid'] as never }, [completeCategory()])).toThrow(/test-pack supportedGameModes/);
    expect(() => buildPack({ ...meta, categoryOrder: ['Absent'] }, [completeCategory()])).toThrow(/test-pack categoryOrder/);
    expect(() => buildPack(meta, [category('Broken', {
      ...completeCategory().questions,
      400: question('Broken response?', 'Answer', { responseMode: 'invalid' as never })
    } as never)])).toThrow(/test-pack\/Broken\/400.*responseMode/);
    const pack = buildPack(meta, [completeCategory()]);
    const malformed = { ...pack, questions: [{ ...pack.questions[0], value: 700 as never }] };
    expect(() => validatePackCatalog([malformed])).toThrow(/test-pack\/Category\/700.*value/);
  });

  it('rejects normalized punctuation, case, and spacing duplicates across packs', () => {
    const first = buildPack(meta, [completeCategory()]);
    const repeated = buildPack({ ...meta, id: 'other-pack' }, [completeCategory()]);
    repeated.questions[0] = {
      ...repeated.questions[0],
      text: '  QUESTION100!!! ',
      factKey: 'unique-key'
    };
    expect(() => validatePackCatalog([first, repeated])).toThrow(/Repeated question text.*test-pack-1-1.*other-pack-1-1/);
  });

  it('normalizes fact keys even when a compiled pack bypasses the builder', () => {
    const first = buildPack(meta, [completeCategory()]);
    const second = buildPack({ ...meta, id: 'other-pack' }, [category('Other', {
      100: question('Distinct clue one?', 'One'), 200: question('Distinct clue two?', 'Two'),
      300: question('Distinct clue three?', 'Three'), 400: question('Distinct clue four?', 'Four'),
      500: question('Distinct clue five?', 'Five'), 1000: question('Distinct clue six?', 'Six')
    })]);
    second.questions[0].factKey = '  QUESTION, 100!!! ';
    expect(() => validatePackCatalog([first, second])).toThrow(/Repeated fact.*test-pack-1-1.*other-pack-1-1/);
  });
});
