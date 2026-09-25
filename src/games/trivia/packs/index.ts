import type { GameMode, PackSummary, Question, QuestionPack } from '../types';
import { packSchema } from '../packSchema';
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
  return repeatedFactByTokens(left, right, contentTokens(left.text), contentTokens(right.text), answerKeys(left), answerKeys(right));
}

function repeatedFactByTokens(
  left: Question, right: Question,
  leftTokens: Set<string>, rightTokens: Set<string>,
  leftAnswers: Set<string>, rightAnswers: Set<string>
): boolean {
  if (left.questionType !== right.questionType && left.questionType !== 'general' && right.questionType !== 'general') return false;
  if (![...rightAnswers].some((answer) => leftAnswers.has(answer))) return false;
  if (!leftTokens.size || !rightTokens.size) return false;
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  if (shared < 2) return false;
  return shared / Math.min(leftTokens.size, rightTokens.size) >= 0.6;
}

/** Review-only candidates. Shared answers plus subject overlap are suggestive, not proof of the same fact. */
export function likelySimilarQuestions(packs: QuestionPack[]): Array<{ left: Question; right: Question }> {
  const questions = packs.flatMap((pack) => pack.questions).map((question) => ({
    question,
    tokens: contentTokens(question.text),
    answers: answerKeys(question)
  }));
  const pairs: Array<{ left: Question; right: Question }> = [];
  for (let leftIndex = 0; leftIndex < questions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < questions.length; rightIndex += 1) {
      const left = questions[leftIndex];
      const right = questions[rightIndex];
      if (repeatedFactByTokens(left.question, right.question, left.tokens, right.tokens, left.answers, right.answers)) {
        pairs.push({ left: left.question, right: right.question });
        continue;
      }
      const shared = [...left.tokens].filter((token) => right.tokens.has(token)).length;
      if (left.tokens.size >= 4 && right.tokens.size >= 4 && shared >= 4 && shared / Math.min(left.tokens.size, right.tokens.size) >= .9) {
        pairs.push({ left: left.question, right: right.question });
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

  for (const pack of packs) {
    const parsed = packSchema.safeParse(pack);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const questionIndex = issue.path[0] === 'questions' && typeof issue.path[1] === 'number' ? issue.path[1] : undefined;
      const question = questionIndex === undefined ? undefined : pack.questions?.[questionIndex];
      const location = question ? `${pack.id}/${question.category}/${question.value} (${question.id})` : pack.id;
      throw new Error(`Malformed question content at ${location}: ${issue.path.join('.')} ${issue.message}`);
    }
    if (packIds.has(pack.id)) throw new Error(`Duplicate question pack id: ${pack.id}`);
    packIds.add(pack.id);
    if (!pack.questions.length) throw new Error(`${pack.id} has no questions`);
    if (pack.finalQuestionId && !pack.questions.some((question) => question.id === pack.finalQuestionId)) {
      throw new Error(`${pack.id} finalQuestionId does not reference a question in the pack`);
    }
    const categories = new Set(pack.questions.map((question) => normalizeQuestionIdentity(question.category)));
    if (pack.categoryOrder && (new Set(pack.categoryOrder.map(normalizeQuestionIdentity)).size !== pack.categoryOrder.length ||
      pack.categoryOrder.some((name) => !categories.has(normalizeQuestionIdentity(name))))) {
      throw new Error(`${pack.id} categoryOrder contains a duplicate or unknown category`);
    }

    for (const question of pack.questions) {
      if (question.packId !== pack.id) throw new Error(`${question.id} points to pack ${question.packId}, expected ${pack.id}`);
      if (questionIds.has(question.id)) throw new Error(`Duplicate question id: ${question.id}`);
      questionIds.add(question.id);
      // Ignore separators as well as case and punctuation: "what's" and "whats"
      // or "ice cream" and "icecream" are formatting variants for this guard.
      const promptKey = normalizeQuestionIdentity(question.text).replaceAll(' ', '');
      if (!promptKey) throw new Error(`${pack.id}/${question.category}/${question.value} (${question.id}) has no searchable question text`);
      const promptOwner = promptOwners.get(promptKey);
      if (promptOwner) throw new Error(`Repeated question text across packs: ${promptOwner} and ${question.id}`);
      promptOwners.set(promptKey, question.id);

      const factKey = normalizeQuestionIdentity(question.factKey);
      if (!factKey) throw new Error(`${pack.id}/${question.category}/${question.value} (${question.id}) has no searchable factKey`);
      const factOwner = factOwners.get(factKey);
      if (factOwner) throw new Error(`Repeated fact across packs: ${factOwner} and ${question.id}. Reworded versions of a fact must share a factKey.`);
      factOwners.set(factKey, question.id);
    }
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
