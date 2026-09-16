import { z } from 'zod';
import { QUESTION_VALUES, type QuestionValue } from './types';

export const playerJoinSchema = z.object({
  roomCode: z.string().trim().min(4).max(8),
  name: z.string().trim().min(1).max(24),
  avatar: z.string().trim().min(1).max(8),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/)
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
