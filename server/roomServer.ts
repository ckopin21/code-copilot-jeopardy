import type { Server as HttpServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { Server, type Socket } from 'socket.io';
import type { BaseRoomSnapshot, RoomEngine, RoomRole, ServerGame } from '../src/platform/rooms/types';
import { playerJoinSchema } from '../src/platform/players/playerJoin';
import { SERVER_GAMES } from './games';
import { createFileRoomStorage } from './storage';

export type GameRequest = { requestId: string; event: string; payload: Record<string, unknown> };
export type GameReply = { requestId: string; ok: boolean; data?: unknown; error?: string };
// Games are stored heterogeneously; each game's own module keeps its precise types.
export type AnyServerGame = ServerGame<any, any>;
type Identity = { gameId: string; roomCode: string; role: RoomRole; playerId?: string; token: string };
type JournalEntry = { fingerprint: string; createdAt: number; result: Promise<GameReply> };
type Runtime = { game: AnyServerGame; engine: RoomEngine };

export interface RoomServerOptions {
  httpServer: HttpServer;
  /** Games to host. Defaults to every game in server/games.ts; the first is the default for `room:create`. */
  games?: readonly AnyServerGame[];
  /** Shared storage for every game (tests). Defaults to one file per game under `.data/`. */
  storage?: Storage;
  /** Advertised address for join links. Defaults to the first private IPv4 LAN address. */
  baseUrl?: string | (() => string);
}

export interface RoomServer {
  io: Server;
  /** The engine for a game, e.g. `server.engine<TriviaEngine>('trivia')`. Defaults to the first game. */
  engine<Engine extends RoomEngine = RoomEngine>(gameId?: string): Engine;
  /** GET routes contributed by games, keyed by path. */
  httpRoutes: ReadonlyMap<string, () => unknown>;
  baseUrl(): string;
  getPlayerConnectionHealth(roomCode: string): PlayerConnectionHealth[];
  getPresentationConnectionCount(roomCode: string): number;
  close(): Promise<void>;
}

export interface PlayerConnectionHealth {
  playerId: string;
  connected: boolean;
  ageMs: number | null;
  quality: 'good' | 'fair' | 'stale' | 'offline';
}

/** Requests that never change room state, so they skip snapshots and broadcasts. */
const READ_ONLY_EVENTS = new Set(['player:heartbeat', 'host:get-player-health', 'host:get-presentation-count', 'host:test-controllers']);
const PLAYER_STALE_MS = 30_000;
const HEALTH_FAIR_MS = 7_000;
const HEALTH_STALE_MS = 15_000;
const JOURNAL_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_JOURNAL_PER_SESSION = 128;

function privateIPv4(address: string): boolean {
  return /^10\./.test(address) || /^192\.168\./.test(address) || /^172\.(1[6-9]|2\d|3[01])\./.test(address);
}

export function discoverLanBaseUrl(port: number): string {
  const candidates = Object.entries(networkInterfaces()).flatMap(([name, addresses]) =>
    (addresses ?? []).filter((address) => address.family === 'IPv4' && !address.internal)
      .map((address) => ({ name, address: address.address }))
  );
  const preferred = candidates.find((candidate) => privateIPv4(candidate.address) && /wi-?fi|wireless|wlan/i.test(candidate.name))
    ?? candidates.find((candidate) => privateIPv4(candidate.address))
    ?? candidates[0];
  return `http://${preferred?.address ?? '127.0.0.1'}:${port}`;
}

function cleanCode(value: unknown): string { return String(value ?? '').trim().toUpperCase(); }
function failure(error: unknown): string { return error instanceof Error ? error.message : 'Request failed'; }
function keyForPlayer(roomCode: string, playerId: string): string { return `${roomCode}:${playerId}`; }
function roomChannel(roomCode: string): string { return `room:${roomCode}`; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }

export function createRoomServer(options: RoomServerOptions): RoomServer {
  const games = options.games ?? SERVER_GAMES;
  if (!games.length) throw new Error('At least one game must be registered');
  const io = new Server(options.httpServer);
  const runtimes = new Map<string, Runtime>();
  const identities = new Map<string, Identity>();
  const hostOwners = new Map<string, string>();
  const playerOwners = new Map<string, string>();
  const playerLastSeen = new Map<string, number>();
  const journals = new Map<string, Map<string, JournalEntry>>();
  let changeCounter = 0;

  for (const game of games) {
    if (runtimes.has(game.id)) throw new Error(`Duplicate game id: ${game.id}`);
    const storage = options.storage ?? createFileRoomStorage(join(process.cwd(), '.data', game.storageFile));
    const engine: RoomEngine = game.createEngine(storage, {
      // Room codes are unique across every game so a code alone finds its room.
      isRoomCodeTaken: (code) => [...runtimes.values()].some((runtime) => runtime.game !== game && runtime.engine.hasRoom(code))
    });
    runtimes.set(game.id, { game, engine });
    engine.onPersistenceChange = () => {
      for (const [roomCode, socketId] of hostOwners) {
        if (engine.hasRoom(roomCode)) sendPersistenceStatus(getSocket(socketId), engine);
      }
    };
  }
  const defaultGameId = games[0].id;

  const httpRoutes = new Map<string, () => unknown>();
  for (const game of games) {
    for (const [path, handler] of Object.entries(game.httpRoutes ?? {})) {
      if (httpRoutes.has(path)) throw new Error(`Two games registered the route ${path}`);
      httpRoutes.set(path, handler);
    }
  }

  const baseUrl = () => {
    if (typeof options.baseUrl === 'function') return options.baseUrl().replace(/\/$/, '');
    if (options.baseUrl) return options.baseUrl.replace(/\/$/, '');
    const address = options.httpServer.address();
    return discoverLanBaseUrl(address && typeof address !== 'string' ? address.port : 3000);
  };

  function runtimeForGame(gameId: string): Runtime {
    const runtime = runtimes.get(gameId);
    if (!runtime) throw new Error(`Unknown game: ${gameId}`);
    return runtime;
  }
  function runtimeForRoom(roomCode: string): Runtime {
    for (const runtime of runtimes.values()) if (runtime.engine.hasRoom(roomCode)) return runtime;
    throw new Error('Room not found or expired');
  }
  function runtimeForRoomOrNull(roomCode: string): Runtime | null {
    try { return runtimeForRoom(roomCode); } catch { return null; }
  }
  function getSocket(id: string | undefined): Socket | undefined { return id ? io.sockets.sockets.get(id) : undefined; }
  function sendPersistenceStatus(socket: Socket | undefined, engine: RoomEngine): void {
    socket?.emit('server:persistence', { ok: engine.persistenceOk });
  }
  function snapshotOrNull(roomCode: string): BaseRoomSnapshot | null {
    try { return runtimeForRoom(roomCode).engine.snapshot(roomCode); } catch { return null; }
  }

  function getPresentationConnectionCount(roomCode: string): number {
    const code = cleanCode(roomCode);
    let count = 0;
    for (const [socketId, identity] of identities) {
      if (identity.role === 'presentation' && identity.roomCode === code && getSocket(socketId)?.connected) count += 1;
    }
    return count;
  }
  function sendPresentationStatus(roomCode: string): void {
    const code = cleanCode(roomCode);
    getSocket(hostOwners.get(code))?.emit('presentation:status', { roomCode: code, connectedCount: getPresentationConnectionCount(code) });
  }
  function getPlayerConnectionHealth(roomCode: string): PlayerConnectionHealth[] {
    const snapshot = snapshotOrNull(cleanCode(roomCode));
    if (!snapshot) return [];
    const now = Date.now();
    return snapshot.players.map((player) => {
      const key = keyForPlayer(snapshot.code, player.id);
      const seen = playerLastSeen.get(key);
      const ageMs = seen == null ? null : Math.max(0, now - seen);
      const connected = Boolean(player.connected && getSocket(playerOwners.get(key))?.connected);
      const quality: PlayerConnectionHealth['quality'] = !connected ? 'offline' : ageMs == null || ageMs > HEALTH_STALE_MS ? 'stale' : ageMs > HEALTH_FAIR_MS ? 'fair' : 'good';
      return { playerId: player.id, connected, ageMs, quality };
    });
  }

  function emitRoom(roomCode: string): void {
    const code = cleanCode(roomCode);
    const runtime = runtimeForRoomOrNull(code);
    if (!runtime) return;
    const snapshot = runtime.engine.snapshot(code);
    for (const [socketId, identity] of identities) {
      if (identity.roomCode !== code) continue;
      const socket = getSocket(socketId);
      if (!socket?.connected) continue;
      if (identity.role === 'host' && hostOwners.get(code) !== socketId) continue;
      if (identity.role === 'player' && playerOwners.get(keyForPlayer(code, identity.playerId ?? '')) !== socketId) continue;
      socket.emit('room:state', runtime.game.sanitize(snapshot, identity.role, identity.playerId));
    }
  }
  function notifyStateChange(roomCode: string, before: BaseRoomSnapshot | null, after: BaseRoomSnapshot | null, changeId: string): void {
    const runtime = runtimeForRoomOrNull(roomCode);
    runtime?.game.onStateChange?.({
      roomCode, before, after, changeId,
      emitToRoom: (event: string, data: unknown) => { io.to(roomChannel(roomCode)).emit(event, data); }
    });
  }

  function unbind(socket: Socket, markDisconnected: boolean): void {
    const identity = identities.get(socket.id);
    if (!identity) return;
    identities.delete(socket.id);
    socket.leave(roomChannel(identity.roomCode));
    const engine = runtimes.get(identity.gameId)?.engine;
    if (identity.role === 'host' && hostOwners.get(identity.roomCode) === socket.id) {
      hostOwners.delete(identity.roomCode);
      if (markDisconnected && engine) {
        try { engine.setHostConnected(identity.roomCode, false); emitRoom(identity.roomCode); } catch { /* expired room */ }
      }
    }
    if (identity.role === 'player' && identity.playerId) {
      const key = keyForPlayer(identity.roomCode, identity.playerId);
      if (playerOwners.get(key) === socket.id) {
        playerOwners.delete(key);
        playerLastSeen.delete(key);
        if (markDisconnected && engine) {
          try { engine.setPlayerConnected(identity.roomCode, identity.playerId, false); emitRoom(identity.roomCode); } catch { /* expired room */ }
        }
      }
    }
    if (identity.role === 'presentation') sendPresentationStatus(identity.roomCode);
  }
  function bind(socket: Socket, identity: Identity): void {
    const oldIdentity = identities.get(socket.id);
    if (oldIdentity) unbind(socket, oldIdentity.roomCode !== identity.roomCode || oldIdentity.role !== identity.role);
    const previousId = identity.role === 'host' ? hostOwners.get(identity.roomCode)
      : identity.role === 'player' && identity.playerId ? playerOwners.get(keyForPlayer(identity.roomCode, identity.playerId)) : undefined;
    identities.set(socket.id, identity);
    socket.join(roomChannel(identity.roomCode));
    if (identity.role === 'host') {
      hostOwners.set(identity.roomCode, socket.id);
      sendPersistenceStatus(socket, runtimeForGame(identity.gameId).engine);
    }
    if (identity.role === 'player' && identity.playerId) {
      const key = keyForPlayer(identity.roomCode, identity.playerId);
      playerOwners.set(key, socket.id);
      playerLastSeen.set(key, Date.now());
    }
    if (previousId && previousId !== socket.id) {
      const previous = getSocket(previousId);
      if (previous) { unbind(previous, false); previous.disconnect(true); }
    }
    if (identity.role === 'presentation') sendPresentationStatus(identity.roomCode);
  }
  function requireIdentity(socket: Socket, event: string, payload: Record<string, unknown>): Identity {
    const identity = identities.get(socket.id);
    if (!identity) throw new Error('Session is not authenticated');
    const roomCode = cleanCode(payload.roomCode);
    if (!roomCode || roomCode !== identity.roomCode) throw new Error('Session does not match this room');
    if (event.startsWith('host:')) {
      if (identity.role !== 'host' || hostOwners.get(roomCode) !== socket.id || String(payload.hostToken ?? '') !== identity.token) {
        throw new Error('Host authority is no longer active');
      }
    } else if (event.startsWith('player:')) {
      if (identity.role !== 'player' || !identity.playerId || playerOwners.get(keyForPlayer(roomCode, identity.playerId)) !== socket.id ||
        String(payload.playerId ?? '') !== identity.playerId || String(payload.reconnectToken ?? '') !== identity.token) {
        throw new Error('Player session is no longer active');
      }
      playerLastSeen.set(keyForPlayer(roomCode, identity.playerId), Date.now());
    } else {
      throw new Error('Unsupported game event');
    }
    return identity;
  }
  function dropPlayer(roomCode: string, playerId: string, event: 'player:suspended' | 'player:removed'): void {
    const current = getSocket(playerOwners.get(keyForPlayer(roomCode, playerId)));
    if (!current) return;
    current.emit(event, { playerId });
    unbind(current, false);
    // Let the status event reach the phone before revoking the socket.
    setTimeout(() => current.disconnect(true), 60).unref();
  }
  function testPlayerControllers(roomCode: string): string[] {
    const reached: string[] = [];
    const sentAt = Date.now();
    for (const socketId of playerOwners.values()) {
      const identity = identities.get(socketId);
      const socket = getSocket(socketId);
      if (!identity || identity.roomCode !== roomCode || !identity.playerId || !socket?.connected) continue;
      socket.emit('preflight:test', { sentAt, playerId: identity.playerId });
      reached.push(identity.playerId);
    }
    return reached;
  }

  function dispatch(socket: Socket, event: string, payload: Record<string, unknown>): unknown {
    const roomCode = cleanCode(payload.roomCode);
    const hostToken = String(payload.hostToken ?? '');

    // Session-establishing events.
    if (event === 'room:create') {
      const existing = identities.get(socket.id);
      if (existing) {
        if (existing.role === 'host' && hostOwners.get(existing.roomCode) === socket.id) {
          return runtimeForGame(existing.gameId).engine.hostCredentials(existing.roomCode, existing.token, baseUrl());
        }
        throw new Error('Create a room from a fresh Host session');
      }
      const gameId = typeof payload.game === 'string' ? payload.game : defaultGameId;
      const { engine } = runtimeForGame(gameId);
      const credentials = engine.createRoom(baseUrl(), payload.settings ?? {});
      bind(socket, { gameId, roomCode: credentials.roomCode, role: 'host', token: credentials.hostToken });
      return credentials;
    }
    if (event === 'host:reconnect') {
      // A valid Host token may replace a socket that is still waiting for its
      // transport timeout. The prior socket loses ownership in bind().
      const { game, engine } = runtimeForRoom(roomCode);
      engine.reconnectHost(roomCode, hostToken);
      bind(socket, { gameId: game.id, roomCode, role: 'host', token: hostToken });
      socket.emit('host:credentials', engine.hostCredentials(roomCode, hostToken, baseUrl()));
      return game.sanitize(engine.snapshot(roomCode), 'host');
    }
    if (event === 'player:join') {
      if (identities.has(socket.id)) throw new Error('This socket already has a session');
      const input = playerJoinSchema.parse(payload);
      const joinCode = input.roomCode.toUpperCase();
      const { game, engine } = runtimeForRoom(joinCode);
      const credentials = engine.joinPlayer(joinCode, input);
      bind(socket, { gameId: game.id, roomCode: credentials.roomCode, role: 'player', playerId: credentials.playerId, token: credentials.reconnectToken });
      return credentials;
    }
    if (event === 'player:reconnect') {
      const playerId = String(payload.playerId ?? '');
      const token = String(payload.reconnectToken ?? '');
      const current = identities.get(socket.id);
      if (current && (current.role !== 'player' || current.roomCode !== roomCode || current.playerId !== playerId)) {
        throw new Error('This socket already has a different session');
      }
      const { game, engine } = runtimeForRoom(roomCode);
      const credentials = engine.reconnectPlayer(roomCode, playerId, token);
      bind(socket, { gameId: game.id, roomCode, role: 'player', playerId, token });
      return credentials;
    }
    if (event === 'presentation:join') {
      const token = String(payload.presentationToken ?? '');
      const current = identities.get(socket.id);
      if (current && (current.role !== 'presentation' || current.roomCode !== roomCode)) {
        throw new Error('This socket already has a different session');
      }
      const { game, engine } = runtimeForRoom(roomCode);
      const snapshot = engine.presentationSnapshot(roomCode, token);
      bind(socket, { gameId: game.id, roomCode, role: 'presentation', token });
      return game.sanitize(snapshot, 'presentation');
    }

    const identity = requireIdentity(socket, event, payload);
    const { game, engine } = runtimeForGame(identity.gameId);

    // Platform actions every game gets.
    switch (event) {
      case 'player:heartbeat': return null;
      case 'host:get-player-health': return getPlayerConnectionHealth(roomCode);
      case 'host:get-presentation-count': return getPresentationConnectionCount(roomCode);
      case 'host:test-controllers': return testPlayerControllers(roomCode);
      case 'host:rotate-presentation-capability': {
        const presentationToken = engine.rotatePresentationCapability(roomCode, hostToken);
        for (const [socketId, session] of identities) {
          if (session.roomCode === roomCode && session.role === 'presentation') {
            const display = getSocket(socketId);
            if (display) { unbind(display, false); display.disconnect(true); }
          }
        }
        sendPresentationStatus(roomCode);
        return { presentationToken };
      }
      case 'host:suspend-player': {
        const playerId = String(payload.playerId ?? '');
        engine.suspendPlayer(roomCode, hostToken, playerId);
        dropPlayer(roomCode, playerId, 'player:suspended');
        return null;
      }
      case 'host:remove-player': {
        const playerId = String(payload.playerId ?? '');
        engine.removePlayer(roomCode, hostToken, playerId);
        dropPlayer(roomCode, playerId, 'player:removed');
        return null;
      }
    }

    // Game actions.
    if (identity.role === 'host') {
      const action = game.hostActions[event];
      if (action) return action({ engine, roomCode, hostToken, payload });
    } else if (identity.role === 'player') {
      const action = game.playerActions[event];
      if (action) return action({ engine, roomCode, playerId: identity.playerId!, reconnectToken: identity.token, payload });
    }
    throw new Error(`Unsupported game event: ${event}`);
  }

  function journalKey(socket: Socket, request: GameRequest): string {
    if (request.event === 'room:create' || request.event === 'player:join') return `initial:${request.event}`;
    const identity = identities.get(socket.id);
    if (!identity) return `unbound:${socket.id}`;
    return `${identity.roomCode}:${identity.role}:${identity.playerId ?? identity.token}`;
  }
  async function replayInitial(socket: Socket, request: GameRequest, reply: GameReply): Promise<void> {
    if (!reply.ok || identities.has(socket.id) || !isRecord(reply.data)) return;
    const roomCode = cleanCode(reply.data.roomCode);
    const runtime = runtimeForRoomOrNull(roomCode);
    if (!runtime) return;
    if (request.event === 'room:create') {
      const hostToken = String(reply.data.hostToken);
      runtime.engine.reconnectHost(roomCode, hostToken);
      bind(socket, { gameId: runtime.game.id, roomCode, role: 'host', token: hostToken });
      emitRoom(roomCode);
    } else if (request.event === 'player:join') {
      const playerId = String(reply.data.playerId);
      const reconnectToken = String(reply.data.reconnectToken);
      runtime.engine.reconnectPlayer(roomCode, playerId, reconnectToken);
      bind(socket, { gameId: runtime.game.id, roomCode, role: 'player', playerId, token: reconnectToken });
      emitRoom(roomCode);
    }
  }
  async function runRequest(socket: Socket, request: GameRequest): Promise<GameReply> {
    const roomCode = cleanCode(request.payload.roomCode);
    const readOnly = READ_ONLY_EVENTS.has(request.event);
    const before = roomCode && !readOnly ? snapshotOrNull(roomCode) : null;
    try {
      const data = await dispatch(socket, request.event, request.payload);
      const changedRoom = roomCode || (isRecord(data) ? cleanCode(data.roomCode) : '');
      if (changedRoom && !readOnly) {
        notifyStateChange(changedRoom, before, snapshotOrNull(changedRoom), request.requestId);
        emitRoom(changedRoom);
      }
      return { requestId: request.requestId, ok: true, data };
    } catch (error) {
      return { requestId: request.requestId, ok: false, error: failure(error) };
    }
  }
  async function handleRequest(socket: Socket, input: unknown): Promise<GameReply> {
    if (!isRecord(input) || typeof input.requestId !== 'string' || input.requestId.length < 1 || input.requestId.length > 128 ||
      typeof input.event !== 'string' || input.event.length < 1 || input.event.length > 80 || !isRecord(input.payload)) {
      return { requestId: isRecord(input) && typeof input.requestId === 'string' ? input.requestId.slice(0, 128) : '', ok: false, error: 'Malformed game request' };
    }
    const request = input as GameRequest;
    const key = journalKey(socket, request);
    const fingerprint = JSON.stringify([request.event, request.payload]);
    const entries = journals.get(key) ?? new Map<string, JournalEntry>();
    journals.set(key, entries);
    const prior = entries.get(request.requestId);
    if (prior) {
      if (prior.fingerprint !== fingerprint) return { requestId: request.requestId, ok: false, error: 'Request ID was already used for another action' };
      const result = await prior.result;
      if (key.startsWith('initial:')) await replayInitial(socket, request, result);
      return result;
    }
    const work = runRequest(socket, request);
    entries.set(request.requestId, { fingerprint, createdAt: Date.now(), result: work });
    while (entries.size > MAX_JOURNAL_PER_SESSION) entries.delete(entries.keys().next().value!);
    return work;
  }

  io.on('connection', (socket) => {
    socket.on('game:request', (input: unknown, acknowledge?: (reply: GameReply) => void) => {
      void handleRequest(socket, input)
        .catch((error): GameReply => ({
          requestId: isRecord(input) && typeof input.requestId === 'string' ? input.requestId.slice(0, 128) : '',
          ok: false,
          error: failure(error)
        }))
        .then((reply) => {
          if (typeof acknowledge === 'function') {
            try { acknowledge(reply); } catch { /* abandoned acknowledgement */ }
          }
        });
    });
    socket.on('disconnect', () => unbind(socket, true));
  });

  const tickTimer = setInterval(() => {
    for (const { engine } of runtimes.values()) {
      try {
        const before = new Map<string, BaseRoomSnapshot>();
        for (const identity of identities.values()) {
          if (before.has(identity.roomCode) || !engine.hasRoom(identity.roomCode)) continue;
          before.set(identity.roomCode, engine.snapshot(identity.roomCode));
        }
        for (const code of engine.tick()) {
          notifyStateChange(code, before.get(code) ?? null, snapshotOrNull(code), `tick-${++changeCounter}`);
          emitRoom(code);
        }
      } catch { /* one expired or malformed room must not stop timer maintenance */ }
    }
  }, 250);
  tickTimer.unref();
  const staleTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, seen] of playerLastSeen) {
      if (now - seen <= PLAYER_STALE_MS) continue;
      const socket = getSocket(playerOwners.get(key));
      if (socket) { unbind(socket, true); socket.disconnect(true); }
      else playerLastSeen.delete(key);
    }
    for (const [key, entries] of journals) {
      for (const [requestId, entry] of entries) if (now - entry.createdAt > JOURNAL_TTL_MS) entries.delete(requestId);
      if (!entries.size) journals.delete(key);
    }
  }, 2000);
  staleTimer.unref();

  return {
    io,
    engine: <Engine extends RoomEngine = RoomEngine>(gameId = defaultGameId) => runtimeForGame(gameId).engine as Engine,
    httpRoutes,
    baseUrl, getPlayerConnectionHealth, getPresentationConnectionCount,
    async close() {
      clearInterval(tickTimer);
      clearInterval(staleTimer);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    }
  };
}
