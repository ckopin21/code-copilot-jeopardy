import type { PackSummary, QuestionPack } from '../shared/types';
import { generatedBuiltInPacks } from './generatedRegistry';

function validatePackCatalog(packs: QuestionPack[]): QuestionPack[] {
  const packIds = new Set<string>();
  const questionIds = new Set<string>();

  for (const pack of packs) {
    if (packIds.has(pack.id)) throw new Error(`Duplicate question pack id: ${pack.id}`);
    packIds.add(pack.id);
    if (!pack.questions.length) throw new Error(`${pack.id} has no questions`);
    if (pack.finalQuestionId && !pack.questions.some((question) => question.id === pack.finalQuestionId)) {
      throw new Error(`${pack.id} finalQuestionId does not reference a question in the pack`);
    }

    for (const question of pack.questions) {
      if (question.packId !== pack.id) throw new Error(`${question.id} points to pack ${question.packId}, expected ${pack.id}`);
      if (questionIds.has(question.id)) throw new Error(`Duplicate question id: ${question.id}`);
      questionIds.add(question.id);
    }
  }

  return packs;
}

export const builtInPacks: QuestionPack[] = validatePackCatalog(generatedBuiltInPacks);
export const packMap = new Map(builtInPacks.map((pack) => [pack.id, pack]));

export function packSummaries(): PackSummary[] {
  return builtInPacks.map(({ id, title, theme, description, questions, difficulty, approximateMinutes, accentColor, titleArt }) => ({
    id,
    title,
    theme,
    description,
    questionCount: questions.length,
    difficulty,
    approximateMinutes,
    accentColor,
    titleArt
  }));
}
