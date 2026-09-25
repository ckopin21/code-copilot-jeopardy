import { z } from 'zod';
import { AVATAR_CATALOG } from './playerCustomization';

/** What a phone sends to join any game. The room server validates it before a game sees it. */
export const playerJoinSchema = z.object({
  roomCode: z.string().trim().min(4).max(8),
  name: z.string().trim().min(1).max(24),
  avatar: z.string().trim().min(1).max(8),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  avatarId: z.string().refine((value) => AVATAR_CATALOG.some((item) => item.id === value), 'Unknown avatar').optional(),
  frameStyle: z.enum(['clean', 'halo', 'bracket', 'neon']).optional(),
  buzzerSound: z.enum(['classic', 'laser', 'chime', 'arcade']).optional(),
  scoreEffect: z.enum(['pulse', 'spark', 'wave']).optional(),
  victoryEffect: z.enum(['confetti', 'spotlight', 'stars']).optional()
});

export type PlayerJoinInput = z.infer<typeof playerJoinSchema>;
