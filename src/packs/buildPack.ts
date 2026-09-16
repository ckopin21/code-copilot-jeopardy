import type { Difficulty, Question, QuestionPack, QuestionValue } from '../shared/types';
import { QUESTION_VALUES } from '../shared/types';

type QA = [question: string, answer: string | string[], explanation?: string, tags?: string[]];
export type CategoryData = { name: string; questions: QA[] };

export function buildPack(
  meta: Omit<QuestionPack, 'questions'>,
  categories: CategoryData[]
): QuestionPack {
  const questions: Question[] = [];
  categories.forEach((category, categoryIndex) => {
    if (category.questions.length !== QUESTION_VALUES.length) {
      throw new Error(`${meta.id}/${category.name} must contain exactly ${QUESTION_VALUES.length} questions`);
    }
    category.questions.forEach(([text, answers, explanation, tags], index) => {
      const value = QUESTION_VALUES[index] as QuestionValue;
      const difficulty: Exclude<Difficulty, 'mixed'> = index < 2 ? 'easy' : index < 4 ? 'medium' : 'hard';
      const acceptedAnswers = Array.isArray(answers) ? answers : [answers];
      questions.push({
        id: `${meta.id}-${categoryIndex + 1}-${index + 1}`,
        packId: meta.id,
        category: category.name,
        text,
        acceptedAnswers,
        value,
        difficulty,
        explanation,
        dailyDoubleEligible: true,
        tags: tags ?? []
      });
    });
  });
  return { ...meta, questions };
}
