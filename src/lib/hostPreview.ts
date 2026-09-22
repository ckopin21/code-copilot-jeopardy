import type { GamePhase } from '../shared/types';

/** A display-only cache. The laptop server remains the source of truth. */
export interface HostPreview {
  roomCode: string;
  phase: GamePhase;
  connectedPlayers: number;
  totalPlayers: number;
  remainingQuestions: number;
  updatedAt: number;
  gameStartedAt: number | null;
}

export function readHostPreview(roomCode: string): HostPreview | null {
  try {
    const raw = localStorage.getItem(`blue-stage-host-preview-${roomCode}`);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<HostPreview>;
    return value.roomCode === roomCode && typeof value.phase === 'string' &&
      typeof value.totalPlayers === 'number' && typeof value.remainingQuestions === 'number' &&
      typeof value.updatedAt === 'number' ? value as HostPreview : null;
  } catch { return null; }
}

export function hostPhaseLabel(phase: HostPreview['phase']): string {
  switch (phase) {
    case 'lobby': return 'Lobby';
    case 'board': return 'Board';
    case 'question': return 'Question';
    case 'daily-double-wager': return 'Daily Double wager';
    case 'daily-double-question': return 'Daily Double';
    case 'final-category': return 'Final category';
    case 'final-wager': return 'Final wagers';
    case 'final-question': return 'Final question';
    case 'final-review': return 'Final review';
    case 'recap': return 'Final results';
    case 'paused': return 'Paused';
  }
}
