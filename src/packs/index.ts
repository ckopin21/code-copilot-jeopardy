import type { PackSummary, QuestionPack } from '../shared/types';
import { disneyPack } from './disney';
import { moviesTvPack } from './moviesTv';
import { scienceNaturePack } from './scienceNature';

export const builtInPacks: QuestionPack[] = [disneyPack, moviesTvPack, scienceNaturePack];

export const packMap = new Map(builtInPacks.map((pack) => [pack.id, pack]));

export function packSummaries(): PackSummary[] {
  return builtInPacks.map(({ id, title, theme, description, questions, difficulty, approximateMinutes }) => ({
    id,
    title,
    theme,
    description,
    questionCount: questions.length,
    difficulty,
    approximateMinutes
  }));
}
