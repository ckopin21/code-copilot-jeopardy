import type { GamePhase, RoomState } from '../shared/types';

const ENGINE_STORAGE_KEY = 'blue-stage-p2p-engine-v2';
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export interface HostPreview {
  roomCode: string;
  phase: GamePhase;
  connectedPlayers: number;
  totalPlayers: number;
  remainingQuestions: number;
  updatedAt: number;
  gameStartedAt: number | null;
}

type PersistedRoomRecord = { state?: RoomState };
type PersistedRoomEnvelope = { version?: unknown; rooms?: unknown };

function readRecords(raw: string): PersistedRoomRecord[] {
  const parsed = JSON.parse(raw) as PersistedRoomRecord[] | PersistedRoomEnvelope;
  // Legacy arrays remain readable until the normal persistence cycle upgrades
  // them to the explicit versioned envelope.
  if (Array.isArray(parsed)) return parsed;
  if (parsed?.version === 1 && Array.isArray(parsed.rooms)) return parsed.rooms as PersistedRoomRecord[];
  return [];
}

export function readHostPreview(roomCode: string): HostPreview | null {
  try {
    const raw = localStorage.getItem(ENGINE_STORAGE_KEY);
    if (!raw) return null;
    const records = readRecords(raw);
    const state = records.find((record) => record.state?.code === roomCode)?.state;
    if (!state) return null;

    const activityFromExpiry = Math.max(state.createdAt, state.expiresAt - ROOM_TTL_MS);
    const updatedAt = Math.max(activityFromExpiry, state.gameStartedAt ?? 0, state.gameEndedAt ?? 0);
    return {
      roomCode: state.code,
      phase: state.phase,
      connectedPlayers: state.players.filter((player) => player.connected).length,
      totalPlayers: state.players.length,
      remainingQuestions: state.remainingQuestions,
      updatedAt,
      gameStartedAt: state.gameStartedAt,
    };
  } catch {
    return null;
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
