import type { CurrentQuestionState, GameSettings, TimerState } from '../types';

export function freeResponseReadingTimer(
  question: CurrentQuestionState | null | undefined,
  settings: Pick<GameSettings, 'gameMode' | 'freeResponseReadSeconds'>,
  serverNow: number
): TimerState | null {
  if (settings.gameMode !== 'free-response' || question?.responseMode !== 'text' || !question.responseOpensAt) return null;
  const durationMs = Math.max(0, Math.round(settings.freeResponseReadSeconds * 1000));
  if (!durationMs) return null;
  return {
    running: true,
    durationMs,
    endsAt: question.responseOpensAt,
    remainingMs: Math.max(0, Math.min(durationMs, question.responseOpensAt - serverNow))
  };
}
