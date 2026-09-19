import { z } from 'zod';
import { QUESTION_VALUES, type AutoGradeConfidence, type QuestionValue } from './types';
import { AVATAR_CATALOG, BUZZER_SOUNDS, FRAME_STYLES, PLAYER_TITLES, SCORE_EFFECTS, VICTORY_EFFECTS } from './playerCustomization';

export const playerJoinSchema = z.object({
  roomCode: z.string().trim().min(4).max(8),
  name: z.string().trim().min(1).max(24),
  avatar: z.string().trim().min(1).max(8),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  avatarId: z.string().refine((value) => AVATAR_CATALOG.some((item) => item.id === value), 'Unknown avatar').optional(),
  frameStyle: z.string().refine((value) => FRAME_STYLES.some((item) => item.id === value), 'Unknown frame').optional(),
  title: z.string().refine((value) => PLAYER_TITLES.some((item) => item.id === value), 'Unknown title').optional(),
  buzzerSound: z.string().refine((value) => BUZZER_SOUNDS.some((item) => item.id === value), 'Unknown buzzer').optional(),
  scoreEffect: z.string().refine((value) => SCORE_EFFECTS.some((item) => item.id === value), 'Unknown score effect').optional(),
  victoryEffect: z.string().refine((value) => VICTORY_EFFECTS.some((item) => item.id === value), 'Unknown victory effect').optional()
});

export const questionSchema = z.object({
  id: z.string().min(1),
  packId: z.string().min(1),
  category: z.string().min(1),
  text: z.string().min(3),
  acceptedAnswers: z.array(z.string().min(1)).min(1),
  alternateAnswers: z.array(z.string().min(1)).optional(),
  value: z.number().int().refine((value) => QUESTION_VALUES.includes(value as QuestionValue), 'Unsupported question value'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  explanation: z.string().optional(),
  dailyDoubleEligible: z.boolean().optional(),
  responseMode: z.enum(['buzz', 'text']).optional(),
  tags: z.array(z.string()).default([])
});

export const packSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(80),
  theme: z.string().min(1).max(80),
  description: z.string().min(1).max(300),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']),
  approximateMinutes: z.number().int().min(5).max(180),
  questions: z.array(questionSchema).min(12)
});

export const buzzSchema = z.object({ roomCode: z.string(), playerId: z.string(), reconnectToken: z.string() });
export const finalSubmissionSchema = z.object({
  roomCode: z.string(),
  playerId: z.string(),
  reconnectToken: z.string(),
  value: z.union([z.number().int().min(0), z.string().max(200)])
});

export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function answerMatches(input: string, accepted: string[]): boolean {
  const normalized = normalizeAnswer(input);
  return accepted.some((candidate) => normalizeAnswer(candidate) === normalized);
}

function editDistance(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const above = previous[column];
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + cost);
      diagonal = above;
    }
  }
  return previous[b.length];
}

export function autoGradeAnswer(input: string, accepted: string[]): { correct: boolean; confidence: AutoGradeConfidence; matchedAnswer?: string } {
  const normalizedInput = normalizeAnswer(input);
  if (!normalizedInput) return { correct: false, confidence: 'high' };

  for (const candidate of accepted) {
    const normalizedCandidate = normalizeAnswer(candidate);
    if (normalizedInput === normalizedCandidate) return { correct: true, confidence: 'high', matchedAnswer: candidate };
  }

  let best: { candidate: string; ratio: number } | null = null;
  for (const candidate of accepted) {
    const normalizedCandidate = normalizeAnswer(candidate);
    const length = Math.max(normalizedInput.length, normalizedCandidate.length);
    if (!length) continue;
    const ratio = editDistance(normalizedInput, normalizedCandidate) / length;
    if (!best || ratio < best.ratio) best = { candidate, ratio };
  }

  if (best && best.ratio <= 0.12) return { correct: true, confidence: 'medium', matchedAnswer: best.candidate };
  return { correct: false, confidence: best && best.ratio <= 0.24 ? 'medium' : 'high' };
}
