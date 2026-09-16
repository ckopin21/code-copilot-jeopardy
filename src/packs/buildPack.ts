import type { Difficulty, Question, QuestionPack, QuestionValue, ResponseMode } from '../shared/types';
import { QUESTION_VALUES } from '../shared/types';

export type QA = [question: string, answer: string | string[], explanation?: string, tags?: string[], responseMode?: ResponseMode];

export interface QuestionSeed {
  text: string;
  answers: string | string[];
  explanation?: string;
  tags?: string[];
  responseMode?: ResponseMode;
  dailyDoubleEligible?: boolean;
}

export type ValueMappedQuestions = Record<QuestionValue, QuestionSeed>;
export type CategoryData = { name: string; questions: QA[] | ValueMappedQuestions };

export function question(
  text: string,
  answers: string | string[],
  options: Omit<QuestionSeed, 'text' | 'answers'> = {}
): QuestionSeed {
  return { text, answers, ...options };
}

export function category(name: string, questions: ValueMappedQuestions): CategoryData {
  return { name, questions };
}

function assertNonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} cannot be empty`);
  return trimmed;
}

function normalizeSeed(categoryData: CategoryData, index: number): QuestionSeed {
  const value = QUESTION_VALUES[index] as QuestionValue;
  if (Array.isArray(categoryData.questions)) {
    const tuple = categoryData.questions[index];
    if (!tuple) throw new Error(`${categoryData.name} is missing the ${value}-point question`);
    const [text, answers, explanation, tags, responseMode] = tuple;
    return { text, answers, explanation, tags, responseMode, dailyDoubleEligible: true };
  }
  const seed = categoryData.questions[value];
  if (!seed) throw new Error(`${categoryData.name} is missing the ${value}-point question`);
  return seed;
}

export function buildPack(
  meta: Omit<QuestionPack, 'questions'>,
  categories: CategoryData[]
): QuestionPack {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.id)) throw new Error(`Invalid pack id: ${meta.id}`);
  assertNonEmpty(meta.title, `${meta.id} title`);
  assertNonEmpty(meta.theme, `${meta.id} theme`);
  assertNonEmpty(meta.description, `${meta.id} description`);
  if (!categories.length) throw new Error(`${meta.id} must contain at least one category`);

  const categoryNames = new Set<string>();
  const questions: Question[] = [];

  categories.forEach((categoryData, categoryIndex) => {
    const categoryName = assertNonEmpty(categoryData.name, `${meta.id} category name`);
    const categoryKey = categoryName.toLocaleLowerCase();
    if (categoryNames.has(categoryKey)) throw new Error(`${meta.id} contains duplicate category: ${categoryName}`);
    categoryNames.add(categoryKey);

    if (Array.isArray(categoryData.questions) && categoryData.questions.length !== QUESTION_VALUES.length) {
      throw new Error(`${meta.id}/${categoryName} must contain exactly ${QUESTION_VALUES.length} questions`);
    }

    QUESTION_VALUES.forEach((value, index) => {
      const seed = normalizeSeed(categoryData, index);
      const text = assertNonEmpty(seed.text, `${meta.id}/${categoryName}/${value} question`);
      const acceptedAnswers = (Array.isArray(seed.answers) ? seed.answers : [seed.answers])
        .map((answer) => assertNonEmpty(answer, `${meta.id}/${categoryName}/${value} answer`));
      const difficulty: Exclude<Difficulty, 'mixed'> = index < 2 ? 'easy' : index < 4 ? 'medium' : 'hard';
      const tags = seed.tags ?? [];

      questions.push({
        id: `${meta.id}-${categoryIndex + 1}-${index + 1}`,
        packId: meta.id,
        category: categoryName,
        text,
        acceptedAnswers,
        value,
        difficulty,
        explanation: seed.explanation,
        dailyDoubleEligible: seed.dailyDoubleEligible ?? true,
        responseMode: seed.responseMode ?? (tags.includes('free-response') || tags.includes('typed') ? 'text' : 'buzz'),
        tags
      });
    });
  });

  return { ...meta, questions };
}
