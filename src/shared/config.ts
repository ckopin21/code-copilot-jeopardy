export { QUESTION_VALUES } from './types';
import type { GameSettings } from './types';

export const DEFAULT_SETTINGS: GameSettings = {
  gameLength: 'standard',
  selectedPackIds: ['disney'],
  mixedPacks: false,
  randomizeCategories: true,
  dailyDoublesEnabled: true,
  dailyDoubleCount: 3,
  stealsEnabled: false,
  allowNegativeScores: true,
  timerSeconds: 15,
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
  controllerBuzzersEnabled: true
};

// Normal boards use the first five values ($100-$500). $1000 remains a preset wager; Final also supports a player's positive-score All In value.
export const GAME_LENGTH_CONFIG = {
  quick: { categories: 4, rows: 5 },
  standard: { categories: 5, rows: 5 },
  marathon: { categories: 6, rows: 5 }
} as const;

export const AVATARS = ['🎬', '🚀', '🐭', '🦊', '🧠', '⭐', '🎮', '🧪', '🌙', '🏆'];
export const ACCENT_COLORS = ['#ffd166', '#5eead4', '#93c5fd', '#f9a8d4', '#c4b5fd', '#fb923c', '#86efac'];
