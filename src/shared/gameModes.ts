import type { GameMode, GameSettings, Question, ResponseMode } from './types';

export interface GameModeDefinition {
  id: GameMode;
  name: string;
  description: string;
  questionBadge: string;
  questionResponse: 'question-default' | 'simultaneous-text';
  dailyDoubles: boolean;
  buzzerControls: boolean;
  penalizeTurnOwnerOnTypedTimeout: boolean;
}

export const GAME_MODES: readonly GameModeDefinition[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Buzz in on standard clues. The player on turn chooses the next question.',
    questionBadge: 'FREE RESPONSE',
    questionResponse: 'question-default',
    dailyDoubles: true,
    buzzerControls: true,
    penalizeTurnOwnerOnTypedTimeout: true
  },
  {
    id: 'free-response',
    name: 'Free Response',
    description: 'Everyone answers every standard clue at the same time. The player on turn only chooses the next question.',
    questionBadge: 'ALL PLAY',
    questionResponse: 'simultaneous-text',
    dailyDoubles: false,
    buzzerControls: false,
    penalizeTurnOwnerOnTypedTimeout: false
  }
] as const;

const GAME_MODE_MAP = new Map<GameMode, GameModeDefinition>(GAME_MODES.map((mode) => [mode.id, mode]));

export function isGameMode(value: unknown): value is GameMode {
  return value === 'classic' || value === 'free-response';
}

export function gameModeDefinition(mode: GameMode | undefined): GameModeDefinition {
  return GAME_MODE_MAP.get(mode ?? 'classic') ?? GAME_MODE_MAP.get('classic')!;
}

export function gameModeAllowsDailyDoubles(settings: Pick<GameSettings, 'gameMode'>): boolean {
  return gameModeDefinition(settings.gameMode).dailyDoubles;
}

export function gameModePenalizesTypedTimeout(settings: Pick<GameSettings, 'gameMode'>): boolean {
  return gameModeDefinition(settings.gameMode).penalizeTurnOwnerOnTypedTimeout;
}

export function responseModeForGameMode(
  settings: Pick<GameSettings, 'gameMode'>,
  question: Pick<Question, 'responseMode'>,
  isDailyDouble = false
): ResponseMode {
  if (isDailyDouble) return 'buzz';
  const mode = gameModeDefinition(settings.gameMode);
  return mode.questionResponse === 'simultaneous-text' ? 'text' : (question.responseMode ?? 'buzz');
}
