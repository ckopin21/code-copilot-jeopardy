import type { GameSettings } from './types';

export const DEFAULT_SETTINGS: GameSettings = {
  gameLength: 'standard',
  selectedPackIds: ['disney'],
  mixedPacks: false,
  randomizeCategories: true,
  dailyDoublesEnabled: true,
  dailyDoubleCount: 3,
  stealsEnabled: true,
  allowNegativeScores: true,
  timerSeconds: 15,
  autoCloseBuzzersAtZero: true,
  lateGameModifiers: true,
  dailyDoubleStacksWithMultiplier: true,
  streaksEnabled: true,
  coldStreakThreshold: 3,
  finalRoundEnabled: true,
  lockRoomOnStart: true,
  allowRepeatBuzzAfterMiss: false,
  allowWagerBeyondScore: true,
  maxWager: 1000,
  localBuzzersEnabled: true,
  controllerBuzzersEnabled: true
};

export const GAME_LENGTH_CONFIG = {
  quick: { categories: 4, rows: 4 },
  standard: { categories: 5, rows: 6 },
  marathon: { categories: 6, rows: 6 }
} as const;

export const AVATARS = ['🎬', '🚀', '🐭', '🦊', '🧠', '⭐', '🎮', '🧪', '🌙', '🏆'];
export const ACCENT_COLORS = ['#ffd166', '#5eead4', '#93c5fd', '#f9a8d4', '#c4b5fd', '#fb923c', '#86efac'];
