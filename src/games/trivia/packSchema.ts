/** Schemas that validate question-pack content at build/test time and on the server. */
import { z } from 'zod';
import { QUESTION_VALUES, type QuestionValue } from './types';

export const questionSchema = z.object({
  id: z.string().trim().min(1),
  packId: z.string().trim().min(1),
  category: z.string().trim().min(1),
  text: z.string().trim().min(3),
  acceptedAnswers: z.array(z.string().trim().min(1)).min(1),
  alternateAnswers: z.array(z.string().trim().min(1)).optional(),
  value: z.number().int().refine((value) => QUESTION_VALUES.includes(value as QuestionValue), 'Unsupported question value'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  questionType: z.enum(['person', 'place', 'time', 'title', 'term', 'number', 'object', 'organization', 'event', 'general']),
  factKey: z.string().trim().min(1),
  explanation: z.string().trim().min(1).optional(),
  dailyDoubleEligible: z.boolean().optional(),
  responseMode: z.enum(['buzz', 'text']).optional(),
  tags: z.array(z.string().trim().min(1))
});

export const packSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1),
  theme: z.string().trim().min(1),
  description: z.string().trim().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']),
  approximateMinutes: z.number().int().positive(),
  supportedGameModes: z.array(z.enum(['classic', 'free-response'])).min(1).refine((modes) => new Set(modes).size === modes.length, 'Duplicate game mode').optional(),
  categoryOrder: z.array(z.string().trim().min(1)).optional(),
  finalQuestionId: z.string().trim().min(1).optional(),
  accentColor: z.string().trim().min(1).optional(),
  titleArt: z.string().trim().min(1).optional(),
  questions: z.array(questionSchema).min(1)
});
