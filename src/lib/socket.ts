import Peer, { type DataConnection } from 'peerjs';
import QRCode from 'qrcode';
import type { GameSettings, PlayerJoinCredentials, RoomSnapshot } from '../shared/types';
import { QUESTION_VALUES } from '../shared/types';
import { playerJoinSchema } from '../shared/validation';
import { packSummaries } from '../packs';
import { BrowserGameEngine, type RoomRecord } from './browserGameEngine';
import { sanitizeRoomSnapshot } from './snapshotSecurity';
import { authorizeRemoteEvent, type RemoteIdentity } from './remoteAuthorization';
import { randomId } from './ids';
import { finalWagerRules } from './finalWagerRules';
import { claimHostAuthority, hasHostAuthority, hostAuthorityKey, releaseHostAuthority } from './hostTabAuthority';

type Listener = (data: any) => void;
type Identity = RemoteIdentity;
type RequestMessage = { kind: 'request'; requestId: string; event: string; payload: Record<string, unknown> };
type ResponseMessage = { kind: 'response'; requestId: string; ok: boolean; data?: unknown; error?: string };
type EventMessage = { kind: 'event'; event: string; data: unknown };
type WireMessage = RequestMessage | ResponseMessage | EventMessage;
interface PendingRequest { resolve: (value: unknown) => void; reject: (reason: Error) => void; timeoutId: number; }

export interface PlayerConnectionHealth {
  playerId: string;
  connected: boolean;
  ageMs: number | null;
  quality: 'good' | 'fair' | 'stale' | 'offline';
}

const engine = new BrowserGameEngine();
const listeners = new Map<string, Set<Listener>>();
const identities = new Map<DataConnection, Identity>();
const playerConnections = new Map<string, DataConnection>();
const playerLastSeen = new Map<string, number>();
const connections = new Set<DataConnection>();
const pending = new Map<string, PendingRequest>();
let hostPeer: Peer | null = null;
let hostRoomCode = '';
let hostAuthorityId = '';
let clientPeer: Peer | null = null;
let clientConnection: DataConnection | null = null;
let clientRoomCode = '';
let clientSuspended = false;
let reconnectDelayMs = 400;
let reconnectTimer: number | null = null;
let clientConnectPromise: { roomCode: string; promise: Promise<DataConnection> } | null = null;
let authReplay: { event: 'player:reconnect' | 'presentation:join'; payload: Record<string, unknown> } | null = null;

const PLAYER_STALE_MS = 8000;

function currentMode(): string | null { return new URLSearchParams(location.search).get('mode'); }
function baseUrl(): string { const url = new URL('.', location.href); url.search = ''; url.hash = ''; return url.href.replace(/\/$/, ''); }
function hostPeerId(roomCode: string): string { return `blue-stage-trivia-${roomCode.toLowerCase()}`; }
function peerOptions() {
  const custom = (window as typeof window & { BLUE_STAGE_ICE_SERVERS?: RTCIceServer[] }).BLUE_STAGE_ICE_SERVERS;
  return { debug: 0, config: { iceServers: custom?.length ? custom : [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] } };
}
function emitLocal(event: string, data?: unknown): void { for (const listener of listeners.get(event) ?? []) listener(data); }
export const socket = {
  connected: false,
  on(event: string, listener: Listener) { const set = listeners.get(event) ?? new Set<Listener>(); set.add(listener); listeners.set(event, set); },
  off(event: string, listener: Listener) { listeners.get(event)?.delete(listener); }
};
function failMessage(error: unknown): string { return error instanceof Error ? error.message : 'Unknown error'; }
function roomRecord(roomCode: string): RoomRecord | undefined {
  return (engine as unknown as { rooms: Map<string, RoomRecord> }).rooms.get(roomCode.toUpperCase());
}
function presetWager(wager: number, includeZero = false): boolean {
  return (includeZero && wager === 0) || QUESTION_VALUES.includes(wager as (typeof QUESTION_VALUES)[number]);
}
function requiredGameStartedAt(payload: Record<string, unknown>): number {
  const value = Number(payload.gameStartedAt);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Missing or stale game context');
  return value;
}
function requiredQuestionId(payload: Record<string, unknown>): string {
  const value = String(payload.questionId ?? '');
  if (!value) throw new Error('Missing or stale question context');
  return value;
}
function ownsHostAuthority(roomCode = hostRoomCode): boolean {
  const normalized = roomCode.toUpperCase();
  return Boolean(normalized && hostPeer && hostRoomCode === normalized && !hostPeer.destroyed && hostAuthorityId && hasHostAuthority(normalized, hostAuthorityId));
}
function requireHostAuthority(roomCode: string): void {
  if (!ownsHostAuthority(roomCode)) throw new Error('This tab is no longer the active host for this room');
}

function sendEvent(connection: DataConnection, event: string, data: unknown): void {
  if (connection.open) connection.send({ kind: 'event', event, data } satisfies EventMessage);
}
function emitRoom(roomCode: string): void {
  let snapshot: RoomSnapshot;
  try { snapshot = engine.snapshot(roomCode); } catch { return; }
  if (hostRoomCode === roomCode) emitLocal('room:state', sanitizeRoomSnapshot(snapshot, 'host'));
  for (const connection of connections) {
    const identity = identities.get(connection);
    if (!identity || identity.roomCode !== roomCode) continue;
    sendEvent(connection, 'room:state', sanitizeRoomSnapshot(snapshot, identity.role, identity.playerId));
  }
}
function bindIdentity(connection: DataConnection, identity: Identity): void {
  identities.set(connection, identity);
  if (identity.role !== 'player' || !identity.playerId) return;
  const prior = playerConnections.get(identity.playerId);
  playerConnections.set(identity.playerId, connection);
  playerLastSeen.set(identity.playerId, Date.now());
  if (prior && prior !== connection) { identities.delete(prior); try { prior.close(); } catch { /* ignore duplicate close */ } }
}
function handleConnectionClosed(connection: DataConnection): void {
  connections.delete(connection);
  const identity = identities.get(connection);
  identities.delete(connection);
  if (!identity || identity.role !== 'player' || !identity.playerId) return;
  if (playerConnections.get(identity.playerId) !== connection) return;
  playerConnections.delete(identity.playerId);
  playerLastSeen.delete(identity.playerId);
  try { engine.setPlayerConnected(identity.roomCode, identity.playerId, false); emitRoom(identity.roomCode); } catch { /* stale room */ }
}
function closePlayerConnection(playerId: string, event?: 'player:suspended' | 'player:removed'): void {
  const connection = playerConnections.get(playerId);
  playerLastSeen.delete(playerId);
  if (!connection) return;
  if (event) sendEvent(connection, event, { playerId });
  playerConnections.delete(playerId);
  identities.delete(connection);
  window.setTimeout(() => { try { connection.close(); } catch { /* ignore */ } }, event ? 60 : 0);
}

/** Host-only connection freshness. Phones refresh lastSeen on their regular reconnect heartbeat. */
export function getPlayerConnectionHealth(roomCode: string): PlayerConnectionHealth[] {
  let snapshot: RoomSnapshot;
  try { snapshot = engine.snapshot(roomCode); } catch { return []; }
  const now = Date.now();
  return snapshot.players.map((player) => {
    const seen = playerLastSeen.get(player.id);
    const ageMs = seen == null ? null : Math.max(0, now - seen);
    const connection = playerConnections.get(player.id);
    const connected = Boolean(player.connected && connection?.open);
    const quality: PlayerConnectionHealth['quality'] = !connected ? 'offline' : ageMs == null || ageMs > 7000 ? 'stale' : ageMs > 4000 ? 'fair' : 'good';
    return { playerId: player.id, connected, ageMs, quality };
  });
}

/** Sends an immediate controller-test event to every live phone. Returns the player ids reached. */
export function testPlayerControllers(roomCode: string): string[] {
  const reached: string[] = [];
  const sentAt = Date.now();
  for (const [playerId, connection] of playerConnections) {
    const identity = identities.get(connection);
    if (!identity || identity.roomCode !== roomCode.toUpperCase() || !connection.open) continue;
    sendEvent(connection, 'preflight:test', { sentAt, playerId });
    reached.push(playerId);
  }
  return reached;
}

async function dispatchHost(event: string, payload: Record<string, unknown>, connection?: DataConnection): Promise<unknown> {
  const roomCode = String(payload.roomCode ?? '').toUpperCase();
  const hostToken = String(payload.hostToken ?? '');
  switch (event) {
    case 'room:create': throw new Error('Room creation is only available on the host screen');
    case 'host:reconnect': {
      engine.reconnectHost(roomCode, hostToken);
      engine.setHostConnected(roomCode, true);
      return sanitizeRoomSnapshot(engine.snapshot(roomCode), 'host');
    }
    case 'presentation:join': {
      const snapshot = engine.snapshot(roomCode);
      if (connection) bindIdentity(connection, { roomCode: snapshot.code, role: 'presentation' });
      return sanitizeRoomSnapshot(snapshot, 'presentation');
    }
    case 'player:join': {
      if (!connection) throw new Error('Player join requires a phone connection');
      const input = playerJoinSchema.parse(payload);
      const credentials = engine.joinPlayer(input.roomCode.toUpperCase(), input);
      bindIdentity(connection, { roomCode: credentials.roomCode, role: 'player', playerId: credentials.playerId });
      emitRoom(credentials.roomCode);
      return credentials;
    }
    case 'player:reconnect': {
      if (!connection) throw new Error('Player reconnect requires a phone connection');
      const credentials = engine.reconnectPlayer(roomCode, String(payload.playerId ?? ''), String(payload.reconnectToken ?? ''));
      bindIdentity(connection, { roomCode: credentials.roomCode, role: 'player', playerId: credentials.playerId });
      emitRoom(credentials.roomCode);
      return credentials;
    }
    case 'player:heartbeat': return null;
    case 'host:update-settings': {
      const updates = (payload.updates ?? {}) as Partial<GameSettings>;
      return engine.updateSettings(roomCode, hostToken, updates);
    }
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
    case 'host:reveal-answer': return engine.revealAnswer(roomCode, hostToken);
    case 'host:advance-board': return engine.advanceToBoard(roomCode, hostToken);
    case 'host:adjust-score': return engine.adjustScore(roomCode, hostToken, String(payload.playerId ?? ''), Number(payload.delta));
    case 'host:undo-last-score': return engine.undoLastScoreAction(roomCode, hostToken);
    case 'host:rename-player': return engine.renamePlayer(roomCode, hostToken, String(payload.playerId ?? ''), String(payload.name ?? ''));
    case 'host:set-turn-player': return engine.setTurnPlayer(roomCode, hostToken, String(payload.playerId ?? ''));
    case 'host:suspend-player': {
      const playerId = String(payload.playerId ?? '');
      engine.suspendPlayer(roomCode, hostToken, playerId);
      closePlayerConnection(playerId, 'player:suspended');
      return null;
    }
    case 'host:remove-player': {
      const playerId = String(payload.playerId ?? '');
      engine.removePlayer(roomCode, hostToken, playerId);
      closePlayerConnection(playerId, 'player:removed');
      return null;
    }
    case 'host:pause': return engine.pause(roomCode, hostToken);
    case 'host:resume': return engine.resume(roomCode, hostToken);
    case 'host:start-timer': return engine.startTimer(roomCode, hostToken);
    case 'host:stop-timer': return engine.stopTimer(roomCode, hostToken);
    case 'host:begin-final-wagers': return engine.beginFinalWagers(roomCode, hostToken);
    case 'host:open-final-question': return engine.openFinalQuestion(roomCode, hostToken);
    case 'host:begin-final-review': return engine.beginFinalReview(roomCode, hostToken);
    case 'host:resolve-final': return engine.resolveFinalAnswer(roomCode, hostToken, String(payload.playerId ?? ''), typeof payload.correct === 'boolean' ? payload.correct : undefined);
    case 'host:end-game': return engine.endGame(roomCode, hostToken);
    case 'player:buzz': {
      const result = engine.buzz(
        roomCode,
        String(payload.playerId ?? ''),
        String(payload.reconnectToken ?? ''),
        requiredQuestionId(payload),
        requiredGameStartedAt(payload)
      );
      return { accepted: result.accepted, reason: result.reason };
    }
    case 'player:text-response': return engine.submitTextResponse(
      roomCode,
      String(payload.playerId ?? ''),
      String(payload.reconnectToken ?? ''),
      String(payload.answer ?? ''),
      requiredQuestionId(payload),
      requiredGameStartedAt(payload)
    );
    case 'player:daily-double-wager': {
      const playerId = String(payload.playerId ?? '');
      const reconnectToken = String(payload.reconnectToken ?? '');
      const wager = Number(payload.wager);
      const questionId = requiredQuestionId(payload);
      const gameStartedAt = requiredGameStartedAt(payload);
      if (!presetWager(wager)) throw new Error('Choose one of the preset Daily Double wagers');
      engine.reconnectPlayer(roomCode, playerId, reconnectToken);
      const snapshot = engine.snapshot(roomCode);
      if (snapshot.phase !== 'daily-double-wager' || snapshot.currentQuestion?.dailyDoublePlayerId !== playerId) throw new Error('This Daily Double belongs to another player');
      const record = roomRecord(roomCode);
      if (!record) throw new Error('Room not found');
      return engine.setDailyDoubleWager(roomCode, record.hostToken, wager, questionId, gameStartedAt);
    }
    case 'player:final-wager': {
      const playerId = String(payload.playerId ?? '');
      const reconnectToken = String(payload.reconnectToken ?? '');
      const wager = Number(payload.wager);
      const gameStartedAt = requiredGameStartedAt(payload);
      engine.reconnectPlayer(roomCode, playerId, reconnectToken);
      const snapshot = engine.snapshot(roomCode);
      const player = snapshot.players.find((candidate) => candidate.id === playerId);
      if (!player) throw new Error('Player not found');
      const rules = finalWagerRules(snapshot, playerId);
      const allIn = rules.allInAllowed && wager === player.score;
      if (!presetWager(wager, true) && !allIn) throw new Error('Choose an available preset or All In');
      if (wager > rules.maxWager) throw new Error(`Final wager is capped at ${rules.maxWager.toLocaleString()}`);
      engine.submitFinalWager(roomCode, playerId, reconnectToken, wager, gameStartedAt);
      return null;
    }
    case 'player:final-answer': {
      engine.submitFinalAnswer(
        roomCode,
        String(payload.playerId ?? ''),
        String(payload.reconnectToken ?? ''),
        String(payload.answer ?? ''),
        requiredGameStartedAt(payload)
      );
      return null;
    }
    default: throw new Error(`Unsupported game event: ${event}`);
  }
}

async function handleHostRequest(connection: DataConnection, message: RequestMessage): Promise<void> {
  const requestRoomCode = String(message.payload.roomCode ?? '').toUpperCase();
  if (!ownsHostAuthority(requestRoomCode)) {
    if (connection.open) connection.send({ kind: 'response', requestId: message.requestId, ok: false, error: 'Host authority moved to another tab' } satisfies ResponseMessage);
    window.setTimeout(() => { try { connection.close(); } catch { /* stale connection */ } }, 0);
    return;
  }
  const identity = identities.get(connection);
  if (identity?.role === 'player' && identity.playerId) playerLastSeen.set(identity.playerId, Date.now());
  try {
    authorizeRemoteEvent(identity, message.event, message.payload);
    const data = await dispatchHost(message.event, message.payload, connection);
    connection.send({ kind: 'response', requestId: message.requestId, ok: true, data } satisfies ResponseMessage);
    const roomCode = String(message.payload.roomCode ?? '').toUpperCase();
    if (roomCode && message.event !== 'player:heartbeat') emitRoom(roomCode);
  } catch (error) {
    if (connection.open) connection.send({ kind: 'response', requestId: message.requestId, ok: false, error: failMessage(error) } satisfies ResponseMessage);
  }
}
function attachHostConnection(connection: DataConnection): void {
  connections.add(connection);
  connection.on('data', (data) => { const message = data as WireMessage; if (message?.kind === 'request') void handleHostRequest(connection, message); });
  connection.on('close', () => handleConnectionClosed(connection));
  connection.on('error', () => handleConnectionClosed(connection));
}
function createHostPeerOnce(roomCode: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(hostPeerId(roomCode), peerOptions());
    let settled = false;
    const finishError = (error: unknown) => {
      if (settled) return;
      settled = true;
      try { peer.destroy(); } catch { /* ignore */ }
      reject(error instanceof Error ? error : new Error('Could not start host connection'));
    };
    peer.on('open', () => {
      socket.connected = true;
      emitLocal('connect');
      if (settled) {
        if (hostRoomCode === roomCode) emitRoom(roomCode);
        return;
      }
      settled = true;
      const previousPeer = hostPeer;
      const authorityId = randomId('host-authority');
      claimHostAuthority(roomCode, authorityId);
      hostPeer = peer;
      hostRoomCode = roomCode;
      hostAuthorityId = authorityId;
      if (previousPeer && previousPeer !== peer) { try { previousPeer.destroy(); } catch { /* ignore */ } }
      peer.on('connection', attachHostConnection);
      peer.on('disconnected', () => {
        socket.connected = false;
        emitLocal('disconnect');
        const reconnect = () => {
          if (!hostPeer || hostPeer.destroyed || !hostPeer.disconnected) return;
          try { hostPeer.reconnect(); } catch { window.setTimeout(reconnect, 1000); }
        };
        window.setTimeout(reconnect, 500);
      });
      peer.on('close', () => {
        releaseHostAuthority(roomCode, authorityId);
        if (hostPeer !== peer) return;
        hostPeer = null;
        hostAuthorityId = '';
        socket.connected = false;
        emitLocal('disconnect');
      });
      peer.on('error', () => { if (peer.disconnected && !peer.destroyed) { try { peer.reconnect(); } catch { /* next event retries */ } } });
      resolve();
    });
    peer.on('error', finishError);
    window.setTimeout(() => finishError(new Error('Timed out starting the host connection')), 8000);
  });
}
async function startHostPeer(roomCode: string, retryUnavailable: boolean): Promise<void> {
  if (hostPeer && hostRoomCode === roomCode && !hostPeer.destroyed) {
    if (ownsHostAuthority(roomCode)) {
      if (hostPeer.disconnected) { try { hostPeer.reconnect(); } catch { /* keep existing connections */ } }
      socket.connected = !hostPeer.disconnected;
      return;
    }
    const stalePeer = hostPeer;
    hostPeer = null;
    hostAuthorityId = '';
    socket.connected = false;
    try { stalePeer.destroy(); } catch { /* stale peer */ }
  }
  let lastError: Error | null = null;
  const attempts = retryUnavailable ? 12 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { await createHostPeerOnce(roomCode); return; }
    catch (error) {
      lastError = error instanceof Error ? error : new Error('Could not start host connection');
      if (!retryUnavailable) break;
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
  }
  throw lastError ?? new Error('Could not start host connection');
}
function attachClientConnection(connection: DataConnection): void {
  connection.on('data', (data) => {
    const message = data as WireMessage;
    if (message?.kind === 'response') {
      const request = pending.get(message.requestId);
      if (!request) return;
      pending.delete(message.requestId);
      window.clearTimeout(request.timeoutId);
      if (message.ok) request.resolve(message.data); else request.reject(new Error(message.error ?? 'Request failed'));
      return;
    }
    if (message?.kind === 'event') {
      if (message.event === 'player:suspended') clientSuspended = true;
      if (message.event === 'player:removed') {
        clientSuspended = true;
        authReplay = null;
      }
      socket.connected = message.event !== 'player:suspended' && message.event !== 'player:removed';
      emitLocal(message.event, message.data);
    }
  });
  const closed = () => {
    if (clientConnection !== connection) return;
    clientConnection = null;
    socket.connected = false;
    emitLocal('disconnect');
    for (const [requestId, request] of pending) {
      pending.delete(requestId);
      window.clearTimeout(request.timeoutId);
      request.reject(new Error('Connection interrupted'));
    }
    scheduleClientReconnect();
  };
  connection.on('close', closed);
  connection.on('error', closed);
}
function createClientPeer(): Promise<Peer> {
  if (clientPeer && !clientPeer.destroyed) {
    if (clientPeer.open) return Promise.resolve(clientPeer);
    try { clientPeer.destroy(); } catch { /* recreate a clean signaling peer */ }
    clientPeer = null;
  }
  return new Promise((resolve, reject) => {
    const peer = new Peer(peerOptions());
    clientPeer = peer;
    let settled = false;
    peer.on('open', () => {
      if (clientConnection?.open) socket.connected = true;
      if (!settled) { settled = true; resolve(peer); }
    });
    peer.on('disconnected', () => {
      if (!clientConnection?.open) socket.connected = false;
      try { peer.reconnect(); } catch { if (!clientConnection?.open) scheduleClientReconnect(); }
    });
    peer.on('error', (error) => {
      if (!settled) { settled = true; reject(error instanceof Error ? error : new Error('Could not connect to signaling')); }
      else if (clientRoomCode && !clientConnection?.open) scheduleClientReconnect();
    });
    peer.on('close', () => {
      if (!clientConnection?.open) socket.connected = false;
      if (clientRoomCode && !clientConnection?.open) scheduleClientReconnect();
    });
    window.setTimeout(() => { if (!settled) { settled = true; reject(new Error('Timed out connecting to signaling')); } }, 8000);
  });
}
function dropClientConnection(connection: DataConnection): void {
  if (clientConnection !== connection) return;
  clientConnection = null;
  socket.connected = false;
  emitLocal('disconnect');
  try { connection.close(); } catch { /* ignore stale close */ }
  scheduleClientReconnect();
}
function sendRequestOn(connection: DataConnection, event: string, payload: Record<string, unknown>, timeoutMs = 8000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!connection.open) { reject(new Error('Host connection is not open')); return; }
    const requestId = randomId('request');
    const timeoutId = window.setTimeout(() => {
      pending.delete(requestId);
      reject(new Error('Host did not respond'));
      dropClientConnection(connection);
    }, timeoutMs);
    pending.set(requestId, { resolve, reject, timeoutId });
    connection.send({ kind: 'request', requestId, event, payload } satisfies RequestMessage);
  });
}
async function openConnectionToHost(targetRoom: string): Promise<DataConnection> {
  if (clientConnection && !clientConnection.open) {
    const staleConnection = clientConnection;
    clientConnection = null;
    try { staleConnection.close(); } catch { /* already closed */ }
  }
  if (clientConnection?.open && clientRoomCode === targetRoom) return clientConnection;
  if (clientConnection?.open && clientRoomCode && clientRoomCode !== targetRoom) {
    try { clientConnection.close(); } catch { /* ignore */ }
    clientConnection = null;
    authReplay = null;
  }
  clientRoomCode = targetRoom;
  const peer = await createClientPeer();
  return await new Promise<DataConnection>((resolve, reject) => {
    const connection = peer.connect(hostPeerId(targetRoom), { reliable: true, serialization: 'json' });
    let settled = false;
    attachClientConnection(connection);
    connection.on('open', () => {
      if (settled) return;
      if (clientSuspended) {
        settled = true;
        try { connection.close(); } catch { /* ignore */ }
        reject(new Error('Connection is paused'));
        return;
      }
      settled = true;
      clientConnection = connection;
      socket.connected = true;
      reconnectDelayMs = 400;
      emitLocal('connect');
      const finish = async () => {
        if (authReplay) {
          try {
            await sendRequestOn(connection, authReplay.event, authReplay.payload, 6000);
          } catch (error) {
            dropClientConnection(connection);
            reject(error instanceof Error ? error : new Error('Could not restore session'));
            return;
          }
        }
        resolve(connection);
      };
      void finish();
    });
    connection.on('error', (error) => { if (settled) return; settled = true; reject(error instanceof Error ? error : new Error('Could not connect to host')); });
    window.setTimeout(() => {
      if (settled) return;
      settled = true;
      try { connection.close(); } catch { /* ignore */ }
      reject(new Error('Could not find that game. Confirm the host page is open.'));
    }, 6500);
  });
}
async function connectToHost(roomCode: string): Promise<DataConnection> {
  if (clientSuspended) throw new Error('Connection is paused');
  const targetRoom = roomCode.toUpperCase();
  if (clientConnection?.open && clientRoomCode === targetRoom) return clientConnection;
  if (clientConnectPromise?.roomCode === targetRoom) return clientConnectPromise.promise;
  const promise = openConnectionToHost(targetRoom).finally(() => {
    if (clientConnectPromise?.promise === promise) clientConnectPromise = null;
  });
  clientConnectPromise = { roomCode: targetRoom, promise };
  return promise;
}
function scheduleClientReconnect(): void {
  if (clientSuspended || !clientRoomCode || reconnectTimer !== null || clientConnection?.open) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    void connectToHost(clientRoomCode).catch(() => {
      reconnectDelayMs = Math.min(5000, Math.round(reconnectDelayMs * 1.7));
      scheduleClientReconnect();
    });
  }, reconnectDelayMs);
}
async function clientRequest(event: string, payload: Record<string, unknown>): Promise<unknown> {
  const roomCode = String(payload.roomCode ?? clientRoomCode).toUpperCase();
  if (!roomCode) throw new Error('Enter a room code');
  const connection = await connectToHost(roomCode);
  const result = await sendRequestOn(connection, event, payload);
  if (event === 'player:join' || event === 'player:reconnect') {
    const credentials = result as PlayerJoinCredentials;
    authReplay = { event: 'player:reconnect', payload: { roomCode: credentials.roomCode, playerId: credentials.playerId, reconnectToken: credentials.reconnectToken } };
  } else if (event === 'presentation:join') {
    authReplay = { event: 'presentation:join', payload: { roomCode } };
  }
  return result;
}
export function suspendClientSession(): void {
  clientSuspended = true;
  clientConnectPromise = null;
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const connection = clientConnection;
  clientConnection = null;
  socket.connected = false;
  emitLocal('disconnect');
  for (const [requestId, request] of pending) {
    pending.delete(requestId);
    window.clearTimeout(request.timeoutId);
    request.reject(new Error('Connection closed'));
  }
  try { connection?.close(); } catch { /* already closed */ }
}
export function resumeClientSession(): void {
  clientSuspended = false;
  reconnectDelayMs = 400;
}
async function createHostRoom(payload: Record<string, unknown>): Promise<unknown> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const settings = (payload.settings ?? {}) as Partial<GameSettings>;
    const credentials = engine.createRoom(String(payload.baseUrl ?? baseUrl()), settings);
    try {
      await startHostPeer(credentials.roomCode, false);
      engine.setHostConnected(credentials.roomCode, true);
      emitRoom(credentials.roomCode);
      return credentials;
    } catch {
      engine.deleteRoom(credentials.roomCode);
    }
  }
  throw new Error('Could not reserve a multiplayer room. Try again.');
}
async function hostRequest(event: string, payload: Record<string, unknown>): Promise<unknown> {
  if (event === 'room:create') return createHostRoom(payload);
  const roomCode = String(payload.roomCode ?? '').toUpperCase();
  if (event === 'host:reconnect') {
    await startHostPeer(roomCode, true);
    requireHostAuthority(roomCode);
  } else if (event.startsWith('host:')) {
    requireHostAuthority(roomCode);
  }
  const result = await dispatchHost(event, payload);
  if (roomCode) emitRoom(roomCode);
  return result;
}
export async function emitAck<T = unknown>(event: string, payload: unknown): Promise<T> {
  const body = (payload ?? {}) as Record<string, unknown>;
  const result = currentMode() === 'host' ? await hostRequest(event, body) : await clientRequest(event, body);
  return result as T;
}
function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}
function installHistoryBaseGuard(): void {
  const original = history.replaceState.bind(history);
  history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
    if (typeof url === 'string' && url.startsWith('/?mode=')) {
      const current = new URL(location.href);
      return original(data, unused, `${current.pathname}${url.slice(1)}`);
    }
    return original(data, unused, url);
  }) as History['replaceState'];
}
function installVirtualApi(): void {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === 'string' ? new URL(input, location.href) : input instanceof URL ? input : new URL(input.url, location.href);
    if (requestUrl.pathname === '/api/packs' || requestUrl.pathname.endsWith('/api/packs')) return jsonResponse(packSummaries());
    if (requestUrl.pathname === '/api/network' || requestUrl.pathname.endsWith('/api/network')) return jsonResponse({ baseUrl: baseUrl(), p2p: true });
    if (requestUrl.pathname === '/api/qr' || requestUrl.pathname.endsWith('/api/qr')) {
      const value = requestUrl.searchParams.get('value');
      if (!value) return jsonResponse({ error: 'A valid URL is required' }, 400);
      try {
        const dataUrl = await QRCode.toDataURL(value, { margin: 1, width: 320 });
        return jsonResponse({ dataUrl });
      } catch {
        return jsonResponse({ error: 'Could not generate QR code' }, 500);
      }
    }
    return nativeFetch(input, init);
  };
}
installHistoryBaseGuard();
installVirtualApi();
window.addEventListener('online', () => { if (currentMode() !== 'host' && clientRoomCode) scheduleClientReconnect(); });
window.addEventListener('storage', (event) => {
  if (!hostRoomCode || !hostAuthorityId || event.key !== hostAuthorityKey(hostRoomCode) || ownsHostAuthority(hostRoomCode)) return;
  const stalePeer = hostPeer;
  hostPeer = null;
  hostAuthorityId = '';
  socket.connected = false;
  emitLocal('disconnect');
  for (const connection of connections) {
    try { connection.close(); } catch { /* stale connection */ }
  }
  try { stalePeer?.destroy(); } catch { /* stale peer */ }
});
window.setInterval(() => {
  if (currentMode() !== 'host' || !hostRoomCode || !ownsHostAuthority(hostRoomCode)) return;
  for (const changedRoom of engine.tick()) {
    if (changedRoom === hostRoomCode) emitRoom(changedRoom);
  }
}, 250);
window.setInterval(() => {
  if (currentMode() !== 'host' || !hostRoomCode || !ownsHostAuthority(hostRoomCode)) return;
  const now = Date.now();
  for (const [playerId, connection] of playerConnections) {
    const identity = identities.get(connection);
    if (!identity || identity.roomCode !== hostRoomCode) continue;
    if (now - (playerLastSeen.get(playerId) ?? now) <= PLAYER_STALE_MS) continue;
    playerConnections.delete(playerId);
    playerLastSeen.delete(playerId);
    identities.delete(connection);
    try { connection.close(); } catch { /* already stale */ }
    try { engine.setPlayerConnected(identity.roomCode, playerId, false); } catch { /* stale room */ }
  }
  emitRoom(hostRoomCode);
}, 2000);
window.setInterval(() => {
  if (currentMode() === 'host' && hostRoomCode && ownsHostAuthority(hostRoomCode)) emitRoom(hostRoomCode);
}, 1500);
