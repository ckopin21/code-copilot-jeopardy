import type { Difficulty, Question, QuestionPack, QuestionType, QuestionValue, ResponseMode } from '../shared/types';
import { QUESTION_VALUES } from '../shared/types';

export type QA = [question: string, answer: string | string[], explanation?: string, tags?: string[], responseMode?: ResponseMode];

export interface QuestionSeed {
  text: string;
  answers: string | string[];
  explanation?: string;
  tags?: string[];
  responseMode?: ResponseMode;
  dailyDoubleEligible?: boolean;
  questionType?: QuestionType;
  /** Stable semantic identity. Rewordings of the same fact must share the same factKey. */
  factKey?: string;
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

export function normalizeQuestionIdentity(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function inferQuestionType(text: string): QuestionType {
  const normalized = normalizeQuestionIdentity(text);
  if (/^(who|whose)\b/.test(normalized)) return 'person';
  if (/\b(what year|which year|what decade|when did|when was|when is)\b/.test(normalized)) return 'time';
  if (/\b(capital|country|city|state|continent|ocean|river|mountain|island|where|located|border|peninsula)\b/.test(normalized)) return 'place';
  if (/\b(which|what) (film|movie|song|album|book|novel|play|show|series|game|title)\b/.test(normalized)) return 'title';
  if (/\b(how many|how much|what number|what percentage|what fraction|how far|how long)\b/.test(normalized)) return 'number';
  if (/\b(team|league|company|organization|agency|university|school)\b/.test(normalized)) return 'organization';
  if (/\b(war|battle|tournament|festival|event|revolution|election)\b/.test(normalized)) return 'event';
  if (/\b(term|word|phrase|called|means|meaning|name for|abbreviation|acronym)\b/.test(normalized)) return 'term';
  if (/\b(tool|instrument|device|object|item|piece|equipment)\b/.test(normalized)) return 'object';
  return 'general';
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

export function difficultyForValue(value: QuestionValue): Exclude<Difficulty, 'mixed'> {
  if (value <= 200) return 'easy';
  if (value <= 400) return 'medium';
  return 'hard';
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
  const factKeys = new Set<string>();
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
      const tags = seed.tags ?? [];
      const questionType = seed.questionType ?? inferQuestionType(text);
      const factKey = normalizeQuestionIdentity(seed.factKey ?? text);
      if (factKeys.has(factKey)) throw new Error(`${meta.id} repeats the same fact: ${text}`);
      factKeys.add(factKey);

      questions.push({
        id: `${meta.id}-${categoryIndex + 1}-${index + 1}`,
        packId: meta.id,
        category: categoryName,
        text,
        acceptedAnswers,
        value,
        difficulty: difficultyForValue(value),
        questionType,
        factKey,
        explanation: seed.explanation,
        dailyDoubleEligible: seed.dailyDoubleEligible ?? true,
        responseMode: seed.responseMode ?? (tags.includes('free-response') || tags.includes('typed') ? 'text' : 'buzz'),
        tags
      });
    });
  });

  return { ...meta, questions };
}
