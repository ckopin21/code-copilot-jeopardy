import { io, type Socket } from 'socket.io-client';
import type { HostRoomCredentials, PlayerJoinCredentials, RoomSnapshot } from '../shared/types';
import { randomId } from './ids';

type Listener = (data: any) => void;
type Request = { requestId: string; event: string; payload: Record<string, unknown> };
type Reply = { requestId: string; ok: boolean; data?: unknown; error?: string };
type Replay = { event: 'host:reconnect' | 'player:reconnect' | 'presentation:join'; payload: Record<string, unknown> };

export interface PlayerConnectionHealth {
  playerId: string;
  connected: boolean;
  ageMs: number | null;
  quality: 'good' | 'fair' | 'stale' | 'offline';
}

export type NetworkDiagnosticKind =
  | 'connected' | 'disconnected' | 'connect-error' | 'reconnect-started'
  | 'identity-restored' | 'identity-rejected' | 'request-timeout';

/** Operational diagnostics never include room credentials or request payloads. */
export interface NetworkDiagnosticEvent {
  at: number;
  kind: NetworkDiagnosticKind;
  role: 'host' | 'client';
  detail?: string;
}

export interface SocketRuntime {
  socket: { connected: boolean; on(event: string, listener: Listener): void; off(event: string, listener: Listener): void };
  emitAck<T = unknown>(event: string, payload: unknown): Promise<T>;
  suspendClientSession(): void;
  resumeClientSession(forceHostPause?: boolean, forceTransportReset?: boolean): void;
  getPlayerConnectionHealth(roomCode: string): PlayerConnectionHealth[];
  getNetworkDiagnostics(): readonly NetworkDiagnosticEvent[];
  getPresentationConnectionCount(roomCode: string): number;
  testPlayerControllers(roomCode: string): string[];
  destroy(): void;
}

export interface SocketRuntimeOptions {
  url?: string;
  autoConnect?: boolean;
}

const REQUEST_TIMEOUT_MS = 8_000;
const CONNECT_TIMEOUT_MS = 10_000;
const EVENT_NAMES = ['room:state', 'room:score', 'host:credentials', 'presentation:status', 'player:suspended', 'player:removed', 'preflight:test'] as const;

export function createSocketRuntime(options: SocketRuntimeOptions = {}): SocketRuntime {
  const browser = typeof window !== 'undefined';
  const transport: Socket = io(options.url ?? (browser ? window.location.origin : 'http://127.0.0.1:3000'), {
    autoConnect: options.autoConnect ?? browser,
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 400,
    reconnectionDelayMax: 5_000,
    timeout: CONNECT_TIMEOUT_MS
  });
  const listeners = new Map<string, Set<Listener>>();
  const socket = {
    connected: false,
    on(event: string, listener: Listener) {
      const set = listeners.get(event) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(event, set);
    },
    off(event: string, listener: Listener) { listeners.get(event)?.delete(listener); }
  };
  const diagnostics: NetworkDiagnosticEvent[] = [];
  const role = () => browser && new URLSearchParams(window.location.search).get('mode') === 'host' ? 'host' as const : 'client' as const;
  let replay: Replay | null = null;
  let suspended = false;
  let hostPaused = false;
  let destroyed = false;
  let restoring: Promise<void> = Promise.resolve();
  let lastRoom: RoomSnapshot | null = null;
  let presentationCount = 0;
  let health: PlayerConnectionHealth[] = [];
  let lastHealthRequestAt = 0;
  const inFlight = new Map<string, Promise<unknown>>();

  function emitLocal(event: string, data?: unknown): void {
    for (const listener of listeners.get(event) ?? []) listener(data);
  }

  function record(kind: NetworkDiagnosticKind, detail?: string): void {
    diagnostics.push({ at: Date.now(), kind, role: role(), detail });
    if (diagnostics.length > 200) diagnostics.shift();
    emitLocal('network:diagnostic', diagnostics[diagnostics.length - 1]);
  }

  function waitForConnection(): Promise<void> {
    if (destroyed) return Promise.reject(new Error('Connection closed'));
    if (suspended) return Promise.reject(new Error('Connection is paused'));
    if (transport.connected) return Promise.resolve();
    transport.connect();
    return new Promise((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => { cleanup(); reject(new Error('Could not connect to the laptop game server. Check Wi-Fi and the server window.')); }, CONNECT_TIMEOUT_MS);
      const connected = () => { cleanup(); resolve(); };
      const cleanup = () => { globalThis.clearTimeout(timeout); transport.off('connect', connected); };
      transport.on('connect', connected);
      if (transport.connected) connected();
    });
  }

  async function sendOnce(request: Request): Promise<unknown> {
    await waitForConnection();
    return new Promise((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        record('request-timeout', request.event);
        reject(new Error('The game server did not respond'));
      }, REQUEST_TIMEOUT_MS);
      transport.emit('game:request', request, (reply: Reply) => {
        globalThis.clearTimeout(timeout);
        if (!reply || reply.requestId !== request.requestId) {
          reject(new Error('Invalid game server acknowledgement'));
          return;
        }
        if (reply.ok) resolve(reply.data);
        else reject(new Error(reply.error ?? 'Request failed'));
      });
    });
  }

  async function request(event: string, payload: Record<string, unknown>, waitForReplay = true): Promise<unknown> {
    if (waitForReplay) await restoring;
    const envelope: Request = { requestId: randomId('request'), event, payload };
    try {
      return await sendOnce(envelope);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!/did not respond|could not connect/i.test(message) || suspended || destroyed) throw error;
      if (waitForReplay) await restoring;
      return sendOnce(envelope);
    }
  }

  function updateReplay(event: string, payload: Record<string, unknown>, result: unknown): void {
    if (event === 'room:create') {
      const credentials = result as HostRoomCredentials;
      replay = { event: 'host:reconnect', payload: { roomCode: credentials.roomCode, hostToken: credentials.hostToken } };
    } else if (event === 'host:reconnect') {
      replay = { event, payload: { roomCode: payload.roomCode, hostToken: payload.hostToken } };
    } else if (event === 'player:join' || event === 'player:reconnect') {
      const credentials = result as PlayerJoinCredentials;
      replay = { event: 'player:reconnect', payload: { roomCode: credentials.roomCode, playerId: credentials.playerId, reconnectToken: credentials.reconnectToken } };
    } else if (event === 'presentation:join') {
      replay = { event, payload: { roomCode: payload.roomCode, presentationToken: payload.presentationToken } };
    }
  }

  transport.on('connect', () => {
    if (destroyed || suspended) return;
    record('connected');
    restoring = (async () => {
      if (replay) {
        record('reconnect-started');
        try {
          await request(replay.event, replay.payload, false);
          record('identity-restored');
        } catch {
          record('identity-rejected');
          return;
        }
      }
      socket.connected = true;
      emitLocal('connect');
    })();
  });
  transport.on('disconnect', () => {
    socket.connected = false;
    record('disconnected');
    emitLocal('disconnect');
  });
  transport.on('connect_error', () => record('connect-error'));

  for (const event of EVENT_NAMES) {
    transport.on(event, (data: unknown) => {
      if (event === 'room:state') {
        lastRoom = data as RoomSnapshot;
        if (browser && role() === 'host') {
          try {
            window.localStorage.setItem(`blue-stage-host-preview-${lastRoom.code}`, JSON.stringify({
              roomCode: lastRoom.code,
              phase: lastRoom.phase,
              connectedPlayers: lastRoom.players.filter((player) => player.connected).length,
              totalPlayers: lastRoom.players.length,
              remainingQuestions: lastRoom.remainingQuestions,
              updatedAt: Date.now(),
              gameStartedAt: lastRoom.gameStartedAt
            }));
          } catch { /* a private browsing storage failure must not break gameplay */ }
        }
        health = lastRoom.players.map((player) => ({
          playerId: player.id,
          connected: player.connected,
          ageMs: player.connected ? 0 : null,
          quality: player.connected ? 'good' : 'offline'
        }));
      } else if (event === 'presentation:status') {
        presentationCount = Number((data as { connectedCount?: number })?.connectedCount ?? 0);
      } else if (event === 'player:suspended') {
        hostPaused = true;
        suspended = true;
        socket.connected = false;
        transport.disconnect();
      } else if (event === 'player:removed') {
        replay = null;
        suspended = true;
        socket.connected = false;
        transport.disconnect();
      }
      emitLocal(event, data);
    });
  }

  async function emitAck<T = unknown>(event: string, payload: unknown): Promise<T> {
    if (event.startsWith('host:') || event === 'room:create') {
      suspended = false;
      if (!transport.connected) transport.connect();
    }
    const body = (payload ?? {}) as Record<string, unknown>;
    const key = event === 'room:create' ? `${event}:${JSON.stringify(body)}` : '';
    if (key && inFlight.has(key)) return inFlight.get(key) as Promise<T>;
    const work = request(event, body, !['room:create', 'host:reconnect', 'player:join', 'player:reconnect', 'presentation:join'].includes(event))
      .then((result) => { updateReplay(event, body, result); return result; })
      .finally(() => { if (key) inFlight.delete(key); });
    if (key) inFlight.set(key, work);
    return work as Promise<T>;
  }

  function suspendClientSession(): void {
    suspended = true;
    socket.connected = false;
    transport.disconnect();
  }

  function resumeClientSession(forceHostPause = false, forceTransportReset = false): void {
    if (hostPaused && !forceHostPause) return;
    if (forceHostPause) hostPaused = false;
    suspended = false;
    if (forceTransportReset) transport.disconnect();
    transport.connect();
  }

  function getPlayerConnectionHealth(roomCode: string): PlayerConnectionHealth[] {
    if (lastRoom?.code !== roomCode.toUpperCase()) return [];
    const hostToken = replay?.event === 'host:reconnect' ? replay.payload.hostToken : undefined;
    const now = Date.now();
    if (hostToken && now - lastHealthRequestAt >= 1_000) {
      lastHealthRequestAt = now;
      void request('host:get-player-health', { roomCode, hostToken })
        .then((result) => { if (Array.isArray(result)) health = result as PlayerConnectionHealth[]; })
        .catch(() => {});
    }
    return health.slice();
  }

  function testPlayerControllers(roomCode: string): string[] {
    const reached = lastRoom?.code === roomCode.toUpperCase()
      ? lastRoom.players.filter((player) => player.connected).map((player) => player.id)
      : [];
    const hostToken = replay?.event === 'host:reconnect' ? replay.payload.hostToken : undefined;
    if (hostToken) void request('host:test-controllers', { roomCode, hostToken }).catch(() => {});
    return reached;
  }

  return {
    socket,
    emitAck,
    suspendClientSession,
    resumeClientSession,
    getPlayerConnectionHealth,
    getNetworkDiagnostics: () => diagnostics.slice(),
    getPresentationConnectionCount: (roomCode) => lastRoom?.code === roomCode.toUpperCase() ? presentationCount : 0,
    testPlayerControllers,
    destroy() {
      destroyed = true;
      suspended = true;
      replay = null;
      transport.removeAllListeners();
      transport.disconnect();
      listeners.clear();
      socket.connected = false;
    }
  };
}

const defaultRuntime = createSocketRuntime();
export const socket = defaultRuntime.socket;
export const emitAck = defaultRuntime.emitAck;
export const suspendClientSession = defaultRuntime.suspendClientSession;
export const resumeClientSession = defaultRuntime.resumeClientSession;
export const getPlayerConnectionHealth = defaultRuntime.getPlayerConnectionHealth;
export const getPresentationConnectionCount = defaultRuntime.getPresentationConnectionCount;
export const testPlayerControllers = defaultRuntime.testPlayerControllers;
