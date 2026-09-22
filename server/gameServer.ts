import type { Server as HttpServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { Server, type Socket } from 'socket.io';
import type { GameSettings, HostRoomCredentials, PlayerJoinCredentials, RoomSnapshot } from '../src/shared/types';
import { QUESTION_VALUES } from '../src/shared/types';
import { playerJoinSchema } from '../src/shared/validation';
import { BrowserGameEngine } from '../src/lib/browserGameEngine';
import { sanitizeRoomSnapshot } from '../src/lib/snapshotSecurity';
import { finalWagerRules } from '../src/lib/finalWagerRules';
import { createFileRoomStorage } from './storage';

export type GameRequest = { requestId: string; event: string; payload: Record<string, unknown> };
export type GameReply = { requestId: string; ok: boolean; data?: unknown; error?: string };
export type ScoreEvent = {
  roomCode: string;
  playerId: string;
  delta: number;
  previousScore: number;
  nextScore: number;
  questionId: string | null;
  actionId: string;
};
type Role = 'host' | 'player' | 'presentation';
type Identity = { roomCode: string; role: Role; playerId?: string; token: string };
type JournalEntry = { fingerprint: string; createdAt: number; result: Promise<GameReply> };

export interface GameServerOptions {
  httpServer: HttpServer;
  storage?: Storage;
  engine?: BrowserGameEngine;
  /** Advertised address for join links. Defaults to the first private IPv4 LAN address. */
  baseUrl?: string | (() => string);
}

export interface GameServer {
  io: Server;
  engine: BrowserGameEngine;
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
function presetWager(wager: number, includeZero = false): boolean {
  return (includeZero && wager === 0) || QUESTION_VALUES.includes(wager as (typeof QUESTION_VALUES)[number]);
}
function gameStartedAt(payload: Record<string, unknown>): number {
  const value = Number(payload.gameStartedAt);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Missing or stale game context');
  return value;
}
function questionId(payload: Record<string, unknown>): string {
  const value = String(payload.questionId ?? '');
  if (!value) throw new Error('Missing or stale question context');
  return value;
}

export function createGameServer(options: GameServerOptions): GameServer {
  const io = new Server(options.httpServer);
  const storage = options.storage ?? createFileRoomStorage(join(process.cwd(), '.data', 'rooms.json'));
  const engine = options.engine ?? new BrowserGameEngine(undefined, undefined, storage);
  const identities = new Map<string, Identity>();
  const hostOwners = new Map<string, string>();
  const playerOwners = new Map<string, string>();
  const playerLastSeen = new Map<string, number>();
  const journals = new Map<string, Map<string, JournalEntry>>();
  let timerAction = 0;

  const baseUrl = () => {
    if (typeof options.baseUrl === 'function') return options.baseUrl().replace(/\/$/, '');
    if (options.baseUrl) return options.baseUrl.replace(/\/$/, '');
    const address = options.httpServer.address();
    return discoverLanBaseUrl(address && typeof address !== 'string' ? address.port : 3000);
  };

  function getSocket(id: string | undefined): Socket | undefined { return id ? io.sockets.sockets.get(id) : undefined; }
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
    const current = getSocket(hostOwners.get(code));
    current?.emit('presentation:status', { roomCode: code, connectedCount: getPresentationConnectionCount(code) });
  }
  function getPlayerConnectionHealth(roomCode: string): PlayerConnectionHealth[] {
    let snapshot: RoomSnapshot;
    try { snapshot = engine.snapshot(roomCode); } catch { return []; }
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
    let snapshot: RoomSnapshot;
    try { snapshot = engine.snapshot(code); } catch { return; }
    for (const [socketId, identity] of identities) {
      if (identity.roomCode !== code) continue;
      const socket = getSocket(socketId);
      if (!socket?.connected) continue;
      if (identity.role === 'host' && hostOwners.get(code) !== socketId) continue;
      if (identity.role === 'player' && playerOwners.get(keyForPlayer(code, identity.playerId ?? '')) !== socketId) continue;
      socket.emit('room:state', sanitizeRoomSnapshot(snapshot, identity.role, identity.playerId));
    }
  }
  function emitScoreDiff(roomCode: string, before: RoomSnapshot | null, after: RoomSnapshot | null, requestId: string): void {
    if (!before || !after || after.phase === 'lobby') return;
    for (const player of after.players) {
      const previous = before.players.find((candidate) => candidate.id === player.id);
      if (!previous || previous.score === player.score) continue;
      const score: ScoreEvent = {
        roomCode: after.code,
        playerId: player.id,
        delta: player.score - previous.score,
        previousScore: previous.score,
        nextScore: player.score,
        questionId: after.currentQuestion?.questionId ?? before.currentQuestion?.questionId ?? null,
        actionId: `${requestId}:${player.id}`
      };
      io.to(roomChannel(roomCode)).emit('room:score', score);
    }
  }
  function snapshotOrNull(roomCode: string): RoomSnapshot | null {
    try { return engine.snapshot(roomCode); } catch { return null; }
  }
  function unbind(socket: Socket, markDisconnected: boolean): void {
    const identity = identities.get(socket.id);
    if (!identity) return;
    identities.delete(socket.id);
    socket.leave(roomChannel(identity.roomCode));
    if (identity.role === 'host' && hostOwners.get(identity.roomCode) === socket.id) {
      hostOwners.delete(identity.roomCode);
      if (markDisconnected) {
        try { engine.setHostConnected(identity.roomCode, false); emitRoom(identity.roomCode); } catch { /* expired room */ }
      }
    }
    if (identity.role === 'player' && identity.playerId) {
      const key = keyForPlayer(identity.roomCode, identity.playerId);
      if (playerOwners.get(key) === socket.id) {
        playerOwners.delete(key);
        playerLastSeen.delete(key);
        if (markDisconnected) {
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
    if (identity.role === 'host') hostOwners.set(identity.roomCode, socket.id);
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
    if (event === 'room:create') {
      const existing = identities.get(socket.id);
      if (existing) {
        if (existing.role === 'host' && hostOwners.get(existing.roomCode) === socket.id) {
          return engine.hostCredentials(existing.roomCode, existing.token, baseUrl());
        }
        throw new Error('Create a room from a fresh Host session');
      }
      const credentials = engine.createRoom(baseUrl(), (payload.settings ?? {}) as Partial<GameSettings>);
      bind(socket, { roomCode: credentials.roomCode, role: 'host', token: credentials.hostToken });
      return credentials;
    }
    if (event === 'host:reconnect') {
      // A valid Host token may replace a socket that is still waiting for its
      // transport timeout. The prior socket loses ownership in bind().
      engine.reconnectHost(roomCode, hostToken);
      bind(socket, { roomCode, role: 'host', token: hostToken });
      socket.emit('host:credentials', engine.hostCredentials(roomCode, hostToken, baseUrl()));
      return sanitizeRoomSnapshot(engine.snapshot(roomCode), 'host');
    }
    if (event === 'player:join') {
      if (identities.has(socket.id)) throw new Error('This socket already has a session');
      const input = playerJoinSchema.parse(payload);
      const credentials = engine.joinPlayer(input.roomCode.toUpperCase(), input);
      bind(socket, { roomCode: credentials.roomCode, role: 'player', playerId: credentials.playerId, token: credentials.reconnectToken });
      return credentials;
    }
    if (event === 'player:reconnect') {
      const playerId = String(payload.playerId ?? '');
      const token = String(payload.reconnectToken ?? '');
      const current = identities.get(socket.id);
      if (current && (current.role !== 'player' || current.roomCode !== roomCode || current.playerId !== playerId)) {
        throw new Error('This socket already has a different session');
      }
      const credentials = engine.reconnectPlayer(roomCode, playerId, token);
      bind(socket, { roomCode, role: 'player', playerId, token });
      return credentials;
    }
    if (event === 'presentation:join') {
      const token = String(payload.presentationToken ?? '');
      const current = identities.get(socket.id);
      if (current && (current.role !== 'presentation' || current.roomCode !== roomCode)) {
        throw new Error('This socket already has a different session');
      }
      const snapshot = engine.presentationSnapshot(roomCode, token);
      bind(socket, { roomCode, role: 'presentation', token });
      return sanitizeRoomSnapshot(snapshot, 'presentation');
    }

    const identity = requireIdentity(socket, event, payload);
    if (identity.role === 'presentation') throw new Error('Presentation connections are read-only');
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
      case 'host:update-settings': return engine.updateSettings(roomCode, hostToken, (payload.updates ?? {}) as Partial<GameSettings>);
      case 'host:start-game': return engine.startGame(roomCode, hostToken);
      case 'host:reset-game': return engine.resetGame(roomCode, hostToken);
      case 'host:select-question': return engine.selectQuestion(roomCode, hostToken, String(payload.questionId ?? ''), payload.dailyDoublePlayerId ? String(payload.dailyDoublePlayerId) : undefined);
      case 'host:cancel-question': return engine.cancelQuestion(roomCode, hostToken);
      case 'host:daily-double-wager': {
        const wager = Number(payload.wager);
        if (!presetWager(wager)) throw new Error('Choose one of the preset Daily Double wagers');
        return engine.setDailyDoubleWager(roomCode, hostToken, wager);
      }
      case 'host:open-buzzers': return engine.openBuzzers(roomCode, hostToken);
      case 'host:close-buzzers': return engine.closeBuzzers(roomCode, hostToken);
      case 'host:local-buzz': return engine.localBuzz(roomCode, hostToken, String(payload.playerId ?? ''));
      case 'host:resolve-answer': return engine.resolveAnswer(roomCode, hostToken, String(payload.playerId ?? ''), Boolean(payload.correct));
      case 'host:resolve-text': return engine.resolveTextResponse(roomCode, hostToken, String(payload.playerId ?? ''), Boolean(payload.correct));
      case 'host:confirm-text-grades': return engine.confirmTextResponses(roomCode, hostToken);
      case 'host:reveal-answer': return engine.revealAnswer(roomCode, hostToken);
      case 'host:advance-board': return engine.advanceToBoard(roomCode, hostToken);
      case 'host:adjust-score': return engine.adjustScore(roomCode, hostToken, String(payload.playerId ?? ''), Number(payload.delta));
      case 'host:undo-last-score': return engine.undoLastScoreAction(roomCode, hostToken);
      case 'host:rename-player': return engine.renamePlayer(roomCode, hostToken, String(payload.playerId ?? ''), String(payload.name ?? ''));
      case 'host:set-turn-player': return engine.setTurnPlayer(roomCode, hostToken, String(payload.playerId ?? ''));
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
      case 'host:pause': return engine.pause(roomCode, hostToken);
      case 'host:resume': return engine.resume(roomCode, hostToken);
      case 'host:start-timer': return engine.startTimer(roomCode, hostToken);
      case 'host:stop-timer': return engine.stopTimer(roomCode, hostToken);
      case 'host:begin-final-wagers': return engine.beginFinalWagers(roomCode, hostToken);
      case 'host:open-final-question': return engine.openFinalQuestion(roomCode, hostToken);
      case 'host:begin-final-review': return engine.beginFinalReview(roomCode, hostToken, payload.forceClose === true);
      case 'host:resolve-final': return engine.resolveFinalAnswer(roomCode, hostToken, String(payload.playerId ?? ''), typeof payload.correct === 'boolean' ? payload.correct : undefined);
      case 'host:end-game': return engine.endGame(roomCode, hostToken);
      case 'player:buzz': {
        const result = engine.buzz(roomCode, identity.playerId!, identity.token, questionId(payload), gameStartedAt(payload));
        return { accepted: result.accepted, reason: result.reason };
      }
      case 'player:text-response': return engine.submitTextResponse(roomCode, identity.playerId!, identity.token, String(payload.answer ?? ''), questionId(payload), gameStartedAt(payload));
      case 'player:daily-double-wager': {
        const wager = Number(payload.wager);
        if (!presetWager(wager)) throw new Error('Choose one of the preset Daily Double wagers');
        return engine.submitDailyDoubleWager(roomCode, identity.playerId!, identity.token, wager, questionId(payload), gameStartedAt(payload));
      }
      case 'player:final-wager': {
        const wager = Number(payload.wager);
        const started = gameStartedAt(payload);
        const snapshot = engine.snapshot(roomCode);
        const player = snapshot.players.find((candidate) => candidate.id === identity.playerId);
        if (!player) throw new Error('Player not found');
        const rules = finalWagerRules(snapshot, identity.playerId!);
        const allIn = rules.allInAllowed && wager === player.score;
        if (!presetWager(wager, true) && !allIn) throw new Error('Choose an available preset or All In');
        if (wager > rules.maxWager) throw new Error(`Final wager is capped at ${rules.maxWager.toLocaleString()}`);
        engine.submitFinalWager(roomCode, identity.playerId!, identity.token, wager, started);
        return null;
      }
      case 'player:final-answer':
        engine.submitFinalAnswer(roomCode, identity.playerId!, identity.token, String(payload.answer ?? ''), gameStartedAt(payload));
        return null;
      default: throw new Error(`Unsupported game event: ${event}`);
    }
  }

  function journalKey(socket: Socket, request: GameRequest): string {
    if (request.event === 'room:create' || request.event === 'player:join') return `initial:${request.event}`;
    const identity = identities.get(socket.id);
    if (!identity) return `unbound:${socket.id}`;
    return `${identity.roomCode}:${identity.role}:${identity.playerId ?? identity.token}`;
  }
  async function replayInitial(socket: Socket, request: GameRequest, reply: GameReply): Promise<void> {
    if (!reply.ok || identities.has(socket.id)) return;
    if (request.event === 'room:create') {
      const credentials = reply.data as HostRoomCredentials;
      engine.reconnectHost(credentials.roomCode, credentials.hostToken);
      bind(socket, { roomCode: credentials.roomCode, role: 'host', token: credentials.hostToken });
      emitRoom(credentials.roomCode);
    } else if (request.event === 'player:join') {
      const credentials = reply.data as PlayerJoinCredentials;
      engine.reconnectPlayer(credentials.roomCode, credentials.playerId, credentials.reconnectToken);
      bind(socket, { roomCode: credentials.roomCode, role: 'player', playerId: credentials.playerId, token: credentials.reconnectToken });
      emitRoom(credentials.roomCode);
    }
  }
  async function runRequest(socket: Socket, request: GameRequest): Promise<GameReply> {
    const roomCode = cleanCode(request.payload.roomCode);
    const before = roomCode ? snapshotOrNull(roomCode) : null;
    try {
      const data = await dispatch(socket, request.event, request.payload);
      const changedRoom = roomCode || (isRecord(data) ? cleanCode(data.roomCode) : '');
      if (changedRoom && request.event !== 'player:heartbeat') {
        const after = snapshotOrNull(changedRoom);
        if (request.event !== 'host:reset-game') emitScoreDiff(changedRoom, before, after, request.requestId);
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
    try {
      const before = new Map<string, RoomSnapshot>();
      for (const identity of identities.values()) if (!before.has(identity.roomCode)) {
        const snapshot = snapshotOrNull(identity.roomCode);
        if (snapshot) before.set(identity.roomCode, snapshot);
      }
      for (const code of engine.tick()) {
        const after = snapshotOrNull(code);
        emitScoreDiff(code, before.get(code) ?? null, after, `tick-${++timerAction}`);
        emitRoom(code);
      }
    } catch { /* one expired or malformed room must not stop timer maintenance */ }
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
    io, engine, baseUrl, getPlayerConnectionHealth, getPresentationConnectionCount,
    async close() {
      clearInterval(tickTimer);
      clearInterval(staleTimer);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    }
  };
}
