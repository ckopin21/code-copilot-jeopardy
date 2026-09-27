// Checks a typed room key against the server as the player types, so a Join button can stay greyed out until the
// key belongs to a running game.
import { useEffect, useState } from 'react';
import { emitAck } from './socket';

export type RoomLookup =
  | { status: 'short' }
  | { status: 'checking' }
  | { status: 'found'; game: string }
  | { status: 'missing' };

/** Room keys are four characters. */
export const ROOM_KEY_LENGTH = 4;

export function useRoomLookup(code: string): RoomLookup {
  const key = code.trim().toUpperCase();
  const [result, setResult] = useState<{ key: string; lookup: RoomLookup }>({ key: '', lookup: { status: 'short' } });
  useEffect(() => {
    if (key.length < ROOM_KEY_LENGTH) return;
    let cancelled = false;
    // A short pause so fast typing sends one lookup, not one per letter.
    const id = window.setTimeout(() => {
      emitAck<{ game: string }>('room:lookup', { roomCode: key })
        .then(({ game }) => { if (!cancelled) setResult({ key, lookup: { status: 'found', game } }); })
        .catch(() => { if (!cancelled) setResult({ key, lookup: { status: 'missing' } }); });
    }, 200);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [key]);
  if (key.length < ROOM_KEY_LENGTH) return { status: 'short' };
  return result.key === key ? result.lookup : { status: 'checking' };
}
