import { AVATAR_CATALOG, ACCENT_COLORS as PLAYER_ACCENT_COLORS } from './playerCustomization';
export { QUESTION_VALUES } from './types';
import type { GameSettings } from './types';

export const DAILY_DOUBLE_COUNT_BY_LENGTH: Record<GameSettings['gameLength'], number> = {
  quick: 2,
  standard: 4,
  marathon: 6
};

export function settingsForGameLength(gameLength: GameSettings['gameLength']): Pick<GameSettings, 'gameLength' | 'dailyDoubleCount' | 'dailyDoublesEnabled'> {
  const dailyDoubleCount = DAILY_DOUBLE_COUNT_BY_LENGTH[gameLength];
  return { gameLength, dailyDoubleCount, dailyDoublesEnabled: dailyDoubleCount > 0 };
}

export function clampDailyDoubleCount(value: number, packQuestionCount: number): number {
  const max = Math.max(0, Math.trunc(packQuestionCount));
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.trunc(value)));
}

export const DEFAULT_SETTINGS: GameSettings = {
  gameMode: 'classic',
  gameLength: 'standard',
  selectedPackIds: ['disney'],
  mixedPacks: false,
  randomizeCategories: true,
  dailyDoublesEnabled: true,
  dailyDoubleCount: DAILY_DOUBLE_COUNT_BY_LENGTH.standard,
  stealsEnabled: false,
  allowNegativeScores: true,
  timerSeconds: 15,
  freeResponseReadSeconds: 5,
  autoCloseBuzzersAtZero: true,
  lateGameModifiers: true,
  dailyDoubleStacksWithMultiplier: true,
  streaksEnabled: true,
  coldStreakThreshold: 3,
  finalRoundEnabled: true,
  lockRoomOnStart: false,
  allowRepeatBuzzAfterMiss: false,
  allowWagerBeyondScore: true,
  maxWager: 100000,
  localBuzzersEnabled: true,
  controllerBuzzersEnabled: true,
  turnOrderMode: 'join-order',
  turnOrder: []
};

/** Cold Streak is a fixed rule rather than a lobby setting. */
export const COLD_STREAK_THRESHOLD = 3;

export interface GamePreset {
  id: 'casual' | 'fast' | 'competitive' | 'party';
  name: string;
  description: string;
  settings: Partial<GameSettings>;
}

/** Curated one-click setups. Pack selection is intentionally left unchanged. */
export const GAME_PRESETS: GamePreset[] = [
  {
    id: 'casual',
    name: 'Casual',
    description: 'Relaxed timing, standard board, streaks and Final enabled.',
    settings: {
      gameLength: 'standard', timerSeconds: 30, dailyDoublesEnabled: true, dailyDoubleCount: DAILY_DOUBLE_COUNT_BY_LENGTH.standard,
      lateGameModifiers: true, streaksEnabled: true, finalRoundEnabled: true, allowNegativeScores: false,
      dailyDoubleStacksWithMultiplier: false
    }
  },
  {
    id: 'fast',
    name: 'Fast',
    description: 'Short board, tight timer, two Daily Doubles, quick finish.',
    settings: {
      gameLength: 'quick', timerSeconds: 10, dailyDoublesEnabled: true, dailyDoubleCount: DAILY_DOUBLE_COUNT_BY_LENGTH.quick,
      lateGameModifiers: true, streaksEnabled: true, finalRoundEnabled: true, allowNegativeScores: true,
      dailyDoubleStacksWithMultiplier: true
    }
  },
  {
    id: 'competitive',
    name: 'Competitive',
    description: 'Standard board, strict timing, negative scores and full modifiers.',
    settings: {
      gameLength: 'standard', timerSeconds: 15, dailyDoublesEnabled: true, dailyDoubleCount: DAILY_DOUBLE_COUNT_BY_LENGTH.standard,
      lateGameModifiers: true, streaksEnabled: true, finalRoundEnabled: true, allowNegativeScores: true,
      dailyDoubleStacksWithMultiplier: true
    }
  },
  {
    id: 'party',
    name: 'Party',
    description: 'Long game with more specials, streak drama and forgiving scoring.',
    settings: {
      gameLength: 'marathon', timerSeconds: 20, dailyDoublesEnabled: true, dailyDoubleCount: DAILY_DOUBLE_COUNT_BY_LENGTH.marathon,
      lateGameModifiers: true, streaksEnabled: true, finalRoundEnabled: true, allowNegativeScores: false,
      dailyDoubleStacksWithMultiplier: true
    }
  }
];

// Game length changes both category count and board depth so the modes are visibly different.
// Quick: 16 questions. Standard: 25 questions. Marathon: 36 questions and includes the $1000 row.
export const GAME_LENGTH_CONFIG = {
  quick: { categories: 4, rows: 4 },
  standard: { categories: 5, rows: 5 },
  marathon: { categories: 6, rows: 6 }
} as const;

/** Legacy emoji fallbacks remain available for old rooms and compact text-only surfaces. */
export const AVATARS = AVATAR_CATALOG.map((avatar) => avatar.fallback);
export const ACCENT_COLORS = PLAYER_ACCENT_COLORS;
