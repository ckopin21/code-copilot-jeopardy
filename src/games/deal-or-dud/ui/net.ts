// Connection hooks for Deal or Dud screens. All rules live on the server; these only send intents and hold the latest snapshot.
import { useCallback, useEffect, useState } from 'react';
import { emitAck, socket } from '../../../platform/net/socket';
import { activeStorageNamespace } from '../../../platform/session/activeGame';
import { readActiveHostCredentials, writeHostCredentials, clearHostCredentials } from '../../../platform/session/hostCredentials';
import type { HostRoomCredentials, PlayerJoinCredentials } from '../../../platform/rooms/types';
import type { DealSnapshot } from '../types';
import { GAME_ID } from '../types';

/** Server clock minus this device's clock, refreshed with every snapshot. One room per tab, so one value is enough. */
let serverOffset = 0;
function accept(data: DealSnapshot): DealSnapshot {
  serverOffset = data.serverNow - Date.now();
  return data;
}

export function useSnapshot(): [DealSnapshot | null, (value: DealSnapshot | null) => void] {
  const [room, setRoomState] = useState<DealSnapshot | null>(null);
  const setRoom = useCallback((value: DealSnapshot | null) => setRoomState(value ? accept(value) : null), []);
  useEffect(() => {
    const onState = (data: DealSnapshot) => { if (data?.game === GAME_ID) setRoom(data); };
    socket.on('room:state', onState);
    return () => socket.off('room:state', onState);
  }, [setRoom]);
  return [room, setRoom];
}

/** Difference between the server clock and this device, so countdowns agree across screens. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useServerOffset(_room: DealSnapshot | null): number {
  return serverOffset;
}

export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Seconds left on a server deadline, frozen while paused. */
export function secondsLeft(room: DealSnapshot | null, endsAt: number | null | undefined, remainingMs: number | undefined, now: number, offset: number): number {
  if (!room) return 0;
  if (endsAt == null) return Math.ceil((remainingMs ?? 0) / 1000);
  const reference = room.paused && room.pausedAt ? room.pausedAt : now + offset;
  return Math.max(0, Math.ceil((endsAt - reference) / 1000));
}

export function useClockSeconds(room: DealSnapshot | null): number {
  const now = useNow();
  const offset = useServerOffset(room);
  return secondsLeft(room, room?.clock?.endsAt, room?.clock?.remainingMs, now, offset);
}

export function useDeadlineSeconds(room: DealSnapshot | null, endsAt: number | null | undefined): number {
  const now = useNow();
  const offset = useServerOffset(room);
  return secondsLeft(room, endsAt, 0, now, offset);
}

// ---------- Host ----------
export function useHostRoom() {
  const [room, setRoom] = useSnapshot();
  const [credentials, setCredentials] = useState<HostRoomCredentials | null>(() => {
    const saved = readActiveHostCredentials();
    return saved && saved.joinUrl.includes(`game=${GAME_ID}`) ? saved : null;
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const onCredentials = (data: HostRoomCredentials) => {
      if (!data?.joinUrl?.includes(`game=${GAME_ID}`)) return;
      writeHostCredentials(data);
      setCredentials(data);
    };
    socket.on('host:credentials', onCredentials);
    return () => socket.off('host:credentials', onCredentials);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (credentials) {
          const snapshot = await emitAck<DealSnapshot>('host:reconnect', { roomCode: credentials.roomCode, hostToken: credentials.hostToken });
          if (!cancelled) setRoom(snapshot);
        } else {
          const created = await emitAck<HostRoomCredentials>('room:create', { game: GAME_ID, settings: {} });
          writeHostCredentials(created);
          if (!cancelled) setCredentials(created);
        }
      } catch (caught) {
        if (credentials) { clearHostCredentials(credentials); if (!cancelled) setCredentials(null); }
        else if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not create a room');
      }
    })();
    return () => { cancelled = true; };
    // Re-run only when the room identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials?.roomCode, credentials?.hostToken]);

  const send = useCallback(async (event: string, payload: Record<string, unknown> = {}) => {
    if (!credentials) return;
    setError('');
    try { await emitAck(event, { roomCode: credentials.roomCode, hostToken: credentials.hostToken, ...payload }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Request failed'); }
  }, [credentials]);

  return { room, credentials, send, error, setError };
}

// ---------- Presentation ----------
export function usePresentationRoom(roomCode: string, token: string) {
  const [room, setRoom] = useSnapshot();
  const [error, setError] = useState('');
  useEffect(() => {
    emitAck<DealSnapshot>('presentation:join', { roomCode, presentationToken: token })
      .then(setRoom)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'This display link no longer works'));
  }, [roomCode, token, setRoom]);
  return { room, error };
}

// ---------- Player ----------
const playerKey = () => `${activeStorageNamespace()}-player`;

export function readPlayerCredentials(): PlayerJoinCredentials | null {
  try {
    const value = JSON.parse(localStorage.getItem(playerKey()) ?? 'null') as PlayerJoinCredentials | null;
    return value && typeof value.playerId === 'string' && typeof value.reconnectToken === 'string' ? value : null;
  } catch { return null; }
}
function writePlayerCredentials(value: PlayerJoinCredentials | null): void {
  try {
    if (value) localStorage.setItem(playerKey(), JSON.stringify(value));
    else localStorage.removeItem(playerKey());
  } catch { /* storage can be unavailable in private browsing */ }
}

export function usePlayerRoom(urlRoomCode: string) {
  const [room, setRoom] = useSnapshot();
  const [credentials, setCredentials] = useState<PlayerJoinCredentials | null>(() => {
    const saved = readPlayerCredentials();
    return saved && (!urlRoomCode || saved.roomCode === urlRoomCode.toUpperCase()) ? saved : null;
  });
  const [error, setError] = useState('');
  const [removed, setRemoved] = useState(false);
  const [left, setLeft] = useState(false);

  const [reconnectError, setReconnectError] = useState('');
  const [reconnectTry, setReconnectTry] = useState(0);
  useEffect(() => {
    if (!credentials) return;
    setReconnectError('');
    emitAck('player:reconnect', credentials).catch((caught) => {
      const message = caught instanceof Error ? caught.message : '';
      // Forget the seat only when the server says it is gone. Network trouble keeps it for a retry.
      if (/authorization failed|not found|expired/i.test(message)) { writePlayerCredentials(null); setCredentials(null); }
      else setReconnectError(message || 'Could not reach the game');
    });
  }, [credentials, reconnectTry]);
  const retryReconnect = useCallback(() => setReconnectTry((value) => value + 1), []);

  useEffect(() => {
    const onRemoved = () => { writePlayerCredentials(null); setCredentials(null); setRoom(null); setRemoved(true); };
    socket.on('player:removed', onRemoved);
    return () => socket.off('player:removed', onRemoved);
  }, [setRoom]);

  // Heartbeats keep the Host's connection health accurate.
  useEffect(() => {
    if (!credentials) return;
    const id = window.setInterval(() => { emitAck('player:heartbeat', credentials).catch(() => undefined); }, 5_000);
    return () => window.clearInterval(id);
  }, [credentials]);

  /** Joins a new seat, or with `seatCode` takes back an existing one. */
  const join = useCallback(async (roomCode: string, name: string, seatCode?: string): Promise<PlayerJoinCredentials> => {
    const result = await emitAck<PlayerJoinCredentials>('player:join', { roomCode: roomCode.toUpperCase(), name, avatar: '🦈', accent: '#1f6fb2', avatarId: 'shark', ...(seatCode ? { seatCode } : {}) });
    writePlayerCredentials(result);
    setCredentials(result);
    setRemoved(false);
    setLeft(false);
    return result;
  }, []);

  const send = useCallback(async (event: string, payload: Record<string, unknown> = {}, as?: PlayerJoinCredentials): Promise<boolean> => {
    const identity = as ?? credentials;
    if (!identity) return false;
    setError('');
    try { await emitAck(event, { ...identity, ...payload }); return true; }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Request failed'); return false; }
  }, [credentials]);

  const leave = useCallback(() => { writePlayerCredentials(null); setCredentials(null); setRoom(null); }, [setRoom]);
  /** Gives up the seat for good (the server frees it), then shows the join screen. */
  const leaveForGood = useCallback(async () => {
    if (!(await send('player:leave'))) return;
    leave();
    setLeft(true);
  }, [send, leave]);

  return { room, credentials, join, send, error, setError, removed, left, leave, leaveForGood, reconnectError, retryReconnect };
}

/** Which game a room code belongs to, for the shared join-by-code screen. */
export async function lookupRoomGame(roomCode: string): Promise<string | null> {
  try { return (await emitAck<{ game: string }>('room:lookup', { roomCode })).game; }
  catch { return null; }
}
