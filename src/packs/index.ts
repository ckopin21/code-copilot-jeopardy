import type { GameMode, PackSummary, Question, QuestionPack } from '../shared/types';
import { normalizeQuestionIdentity } from './buildPack';
import { generatedBuiltInPacks } from './generatedRegistry';

const DUPLICATE_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'by', 'did', 'do', 'does', 'for', 'from', 'how', 'in', 'is', 'it',
  'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'were', 'what', 'when', 'where', 'which', 'who', 'whom',
  'whose', 'with'
]);

function contentTokens(text: string): Set<string> {
  return new Set(
    normalizeQuestionIdentity(text)
      .split(' ')
      .filter((token) => token.length > 1 && !DUPLICATE_STOPWORDS.has(token))
  );
}

function answerKeys(question: Question): Set<string> {
  return new Set(
    [...question.acceptedAnswers, ...(question.alternateAnswers ?? [])]
      .map(normalizeQuestionIdentity)
      .filter(Boolean)
  );
}

/** Conservative semantic duplicate guard for reworded clues that target the same answer and fact. */
export function likelyRepeatedFact(left: Question, right: Question): boolean {
  if (left.questionType !== right.questionType && left.questionType !== 'general' && right.questionType !== 'general') return false;

  const leftAnswers = answerKeys(left);
  if (![...answerKeys(right)].some((answer) => leftAnswers.has(answer))) return false;

  const leftTokens = contentTokens(left.text);
  const rightTokens = contentTokens(right.text);
  if (!leftTokens.size || !rightTokens.size) return false;
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  if (shared < 2) return false;
  return shared / Math.min(leftTokens.size, rightTokens.size) >= 0.6;
}

/** Review-only candidates: close wording without the same accepted answer is not a deterministic duplicate. */
export function likelySimilarQuestions(packs: QuestionPack[]): Array<{ left: Question; right: Question }> {
  const questions = packs.flatMap((pack) => pack.questions);
  const pairs: Array<{ left: Question; right: Question }> = [];
  for (let leftIndex = 0; leftIndex < questions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < questions.length; rightIndex += 1) {
      const left = questions[leftIndex];
      const right = questions[rightIndex];
      const leftTokens = contentTokens(left.text);
      const rightTokens = contentTokens(right.text);
      const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
      if (leftTokens.size >= 4 && rightTokens.size >= 4 && shared / Math.min(leftTokens.size, rightTokens.size) >= .9 && !likelyRepeatedFact(left, right)) {
        pairs.push({ left, right });
      }
    }
  }
  return pairs;
}

export function validatePackCatalog(packs: QuestionPack[]): QuestionPack[] {
  const packIds = new Set<string>();
  const questionIds = new Set<string>();
  const factOwners = new Map<string, string>();
  const promptOwners = new Map<string, string>();
  const catalogQuestions: Question[] = [];

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
      catalogQuestions.push(question);
    }
  }

  for (let leftIndex = 0; leftIndex < catalogQuestions.length; leftIndex += 1) {
    const left = catalogQuestions[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < catalogQuestions.length; rightIndex += 1) {
      const right = catalogQuestions[rightIndex];
      if (!likelyRepeatedFact(left, right)) continue;
      throw new Error(`Likely repeated fact across packs: ${left.id} and ${right.id}. Give rewordings the same factKey or replace one clue.`);
    }
  }

  // Similar clues with different accepted answers are legitimate sometimes. Do
  // not reject them; make review visible in CI/test output instead.
  for (const { left, right } of likelySimilarQuestions(packs)) {
    console.warn(`Near-duplicate question review: ${left.id} and ${right.id} have highly similar clue wording.`);
  }

  return packs;
}

export const builtInPacks: QuestionPack[] = validatePackCatalog(generatedBuiltInPacks);
export const packMap = new Map(builtInPacks.map((pack) => [pack.id, pack]));

export function supportedGameModesForPack(pack: Pick<QuestionPack, 'supportedGameModes'>): GameMode[] {
  return pack.supportedGameModes?.length ? [...pack.supportedGameModes] : ['classic'];
}

export function packSupportsGameMode(pack: Pick<QuestionPack, 'supportedGameModes'>, gameMode: GameMode): boolean {
  return supportedGameModesForPack(pack).includes(gameMode);
}

export function packsForGameMode(gameMode: GameMode): QuestionPack[] {
  return builtInPacks.filter((pack) => packSupportsGameMode(pack, gameMode));
}

export function packSummaries(): PackSummary[] {
  return builtInPacks.map(({ id, title, theme, description, questions, difficulty, approximateMinutes, supportedGameModes, accentColor, titleArt }) => ({
    id,
    title,
    theme,
    description,
    questionCount: questions.length,
    difficulty,
    approximateMinutes,
    supportedGameModes: supportedGameModes?.length ? [...supportedGameModes] : ['classic'],
    accentColor,
    titleArt
  }));
}
