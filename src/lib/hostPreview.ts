import type { RoomSnapshot } from '../shared/types';

export const HOST_PREVIEW_KEY = 'blue-stage-host-preview-v1';

export interface HostPreview {
  roomCode: string;
  phase: RoomSnapshot['phase'];
  connectedPlayers: number;
  totalPlayers: number;
  remainingQuestions: number;
  updatedAt: number;
  gameStartedAt: number | null;
}

export function saveHostPreview(room: RoomSnapshot): void {
  const preview: HostPreview = {
    roomCode: room.code,
    phase: room.phase,
    connectedPlayers: room.players.filter((player) => player.connected).length,
    totalPlayers: room.players.length,
    remainingQuestions: room.remainingQuestions,
    updatedAt: Date.now(),
    gameStartedAt: room.gameStartedAt,
  };

  try {
    localStorage.setItem(HOST_PREVIEW_KEY, JSON.stringify(preview));
  } catch {
    // The menu preview is convenience metadata; gameplay must not depend on it.
  }
}

export function readHostPreview(): HostPreview | null {
  try {
    const raw = localStorage.getItem(HOST_PREVIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HostPreview>;
    if (typeof parsed.roomCode !== 'string' || typeof parsed.updatedAt !== 'number' || typeof parsed.phase !== 'string') return null;
    return {
      roomCode: parsed.roomCode,
      phase: parsed.phase as HostPreview['phase'],
      connectedPlayers: typeof parsed.connectedPlayers === 'number' ? parsed.connectedPlayers : 0,
      totalPlayers: typeof parsed.totalPlayers === 'number' ? parsed.totalPlayers : 0,
      remainingQuestions: typeof parsed.remainingQuestions === 'number' ? parsed.remainingQuestions : 0,
      updatedAt: parsed.updatedAt,
      gameStartedAt: typeof parsed.gameStartedAt === 'number' ? parsed.gameStartedAt : null,
    };
  } catch {
    return null;
  }
}

export function clearHostPreview(): void {
  try {
    localStorage.removeItem(HOST_PREVIEW_KEY);
  } catch {
    // Ignore storage failures; the room itself remains authoritative.
  }
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
