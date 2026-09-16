import type { PackSummary, QuestionPack } from '../shared/types';
import { normalizeQuestionIdentity } from './buildPack';
import { generatedBuiltInPacks } from './generatedRegistry';

function validatePackCatalog(packs: QuestionPack[]): QuestionPack[] {
  const packIds = new Set<string>();
  const questionIds = new Set<string>();
  const factOwners = new Map<string, string>();
  const promptOwners = new Map<string, string>();

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
      if (!question.questionType) throw new Error(`${question.id} is missing questionType metadata`);
      if (!question.factKey) throw new Error(`${question.id} is missing factKey metadata`);

      const promptKey = normalizeQuestionIdentity(question.text);
      const promptOwner = promptOwners.get(promptKey);
      if (promptOwner) throw new Error(`Repeated question text across packs: ${promptOwner} and ${question.id}`);
      promptOwners.set(promptKey, question.id);

      const factOwner = factOwners.get(question.factKey);
      if (factOwner) throw new Error(`Repeated fact across packs: ${factOwner} and ${question.id}. Reworded versions of a fact must share a factKey.`);
      factOwners.set(question.factKey, question.id);
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
