import Peer, { type DataConnection } from 'peerjs';
import QRCode from 'qrcode';
import type { GameSettings, PlayerJoinCredentials, RoomSnapshot, TextResponseState } from '../shared/types';
import { playerJoinSchema } from '../shared/validation';
import { packSummaries } from '../packs';
import { BrowserGameEngine } from './browserGameEngine';

type Listener = (data: any) => void;
type Identity = { roomCode: string; role: 'host' | 'player' | 'presentation'; playerId?: string };
type RequestMessage = { kind: 'request'; requestId: string; event: string; payload: Record<string, unknown> };
type ResponseMessage = { kind: 'response'; requestId: string; ok: boolean; data?: unknown; error?: string };
type EventMessage = { kind: 'event'; event: string; data: unknown };
type WireMessage = RequestMessage | ResponseMessage | EventMessage;
interface PendingRequest { resolve: (value: unknown) => void; reject: (reason: Error) => void; timeoutId: number; }

const engine = new BrowserGameEngine();
const listeners = new Map<string, Set<Listener>>();
const identities = new Map<DataConnection, Identity>();
const playerConnections = new Map<string, DataConnection>();
const connections = new Set<DataConnection>();
const pending = new Map<string, PendingRequest>();
let hostPeer: Peer | null = null;
let hostRoomCode = '';
let clientPeer: Peer | null = null;
let clientConnection: DataConnection | null = null;
let clientRoomCode = '';
let reconnectDelayMs = 400;
let reconnectTimer: number | null = null;
let authReplay: { event: 'player:reconnect' | 'presentation:join'; payload: Record<string, unknown> } | null = null;

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

function hiddenResponse(response: TextResponseState): TextResponseState {
  return { ...response, answer: '', autoCorrect: false, autoConfidence: 'low', resolvedCorrect: null };
}

function safeSnapshot(snapshot: RoomSnapshot, role: Identity['role'], playerId?: string): RoomSnapshot {
  const copy = structuredClone(snapshot);
  const revealFinal = copy.phase === 'final-review' || copy.phase === 'recap';

  copy.players = copy.players.map((player) => {
    const own = role === 'player' && player.id === playerId;
    if (revealFinal || own) return player;
    return { ...player, finalWager: null, finalAnswer: null };
  });

  if (copy.currentQuestion) {
    if (!copy.currentQuestion.answerRevealed) copy.currentQuestion.acceptedAnswers = undefined;
    const responses = copy.currentQuestion.textResponses;
    if (responses && !copy.currentQuestion.answerRevealed) {
      copy.currentQuestion.textResponses = Object.fromEntries(Object.entries(responses).map(([id, response]) => {
        const own = role === 'player' && id === playerId;
        return [id, own ? response : hiddenResponse(response)];
      }));
    }
  }

  if (copy.phase === 'daily-double-wager' && role !== 'host' && copy.currentQuestion) copy.currentQuestion.text = '';
  if (copy.finalRound && !revealFinal) copy.finalRound.acceptedAnswers = [];
  return copy;
}

function sendEvent(connection: DataConnection, event: string, data: unknown): void {
  if (connection.open) connection.send({ kind: 'event', event, data } satisfies EventMessage);
}
function emitRoom(roomCode: string): void {
  let snapshot: RoomSnapshot;
  try { snapshot = engine.snapshot(roomCode); } catch { return; }
  if (hostRoomCode === roomCode) emitLocal('room:state', safeSnapshot(snapshot, 'host'));
  for (const connection of connections) {
    const identity = identities.get(connection);
    if (!identity || identity.roomCode !== roomCode) continue;
    sendEvent(connection, 'room:state', safeSnapshot(snapshot, identity.role, identity.playerId));
  }
}
function bindIdentity(connection: DataConnection, identity: Identity): void {
  identities.set(connection, identity);
  if (identity.role !== 'player' || !identity.playerId) return;
  const prior = playerConnections.get(identity.playerId);
  playerConnections.set(identity.playerId, connection);
  if (prior && prior !== connection) { identities.delete(prior); try { prior.close(); } catch { /* ignore duplicate close */ } }
}
function handleConnectionClosed(connection: DataConnection): void {
  connections.delete(connection);
  const identity = identities.get(connection);
  identities.delete(connection);
  if (!identity || identity.role !== 'player' || !identity.playerId) return;
  if (playerConnections.get(identity.playerId) !== connection) return;
  playerConnections.delete(identity.playerId);
  try { engine.setPlayerConnected(identity.roomCode, identity.playerId, false); emitRoom(identity.roomCode); } catch { /* stale room */ }
}

async function dispatchHost(event: string, payload: Record<string, unknown>, connection?: DataConnection): Promise<unknown> {
  const roomCode = String(payload.roomCode ?? '').toUpperCase();
  const hostToken = String(payload.hostToken ?? '');
  switch (event) {
    case 'room:create': throw new Error('Room creation is only available on the host screen');
    case 'host:reconnect': return safeSnapshot(engine.reconnectHost(roomCode, hostToken), 'host');
    case 'presentation:join': {
      const snapshot = engine.snapshot(roomCode);
      if (connection) bindIdentity(connection, { roomCode: snapshot.code, role: 'presentation' });
      return safeSnapshot(snapshot, 'presentation');
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
    case 'host:update-settings': return engine.updateSettings(roomCode, hostToken, (payload.updates ?? {}) as Partial<GameSettings>);
    case 'host:start-game': return engine.startGame(roomCode, hostToken);
    case 'host:reset-game': return engine.resetGame(roomCode, hostToken);
    case 'host:select-question': return engine.selectQuestion(roomCode, hostToken, String(payload.questionId ?? ''), payload.dailyDoublePlayerId ? String(payload.dailyDoublePlayerId) : undefined);
    case 'host:cancel-question': return engine.cancelQuestion(roomCode, hostToken);
    case 'host:daily-double-wager': return engine.setDailyDoubleWager(roomCode, hostToken, Number(payload.wager));
    case 'host:open-buzzers': return engine.openBuzzers(roomCode, hostToken);
    case 'host:close-buzzers': return engine.closeBuzzers(roomCode, hostToken);
    case 'host:local-buzz': return engine.localBuzz(roomCode, hostToken, String(payload.playerId ?? ''));
    case 'host:resolve-answer': return engine.resolveAnswer(roomCode, hostToken, String(payload.playerId ?? ''), Boolean(payload.correct));
    case 'host:resolve-text': return engine.resolveTextResponse(roomCode, hostToken, String(payload.playerId ?? ''), Boolean(payload.correct));
    case 'host:reveal-answer': return engine.revealAnswer(roomCode, hostToken);
    case 'host:advance-board': return engine.advanceToBoard(roomCode, hostToken);
    case 'host:adjust-score': return engine.adjustScore(roomCode, hostToken, String(payload.playerId ?? ''), Number(payload.delta));
    case 'host:remove-player': {
      const playerId = String(payload.playerId ?? '');
      engine.removePlayer(roomCode, hostToken, playerId);
      const playerConnection = playerConnections.get(playerId);
      if (playerConnection) {
        playerConnections.delete(playerId);
        identities.delete(playerConnection);
        try { playerConnection.close(); } catch { /* ignore */ }
      }
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
      const result = engine.buzz(roomCode, String(payload.playerId ?? ''), String(payload.reconnectToken ?? ''));
      return { accepted: result.accepted, reason: result.reason };
    }
    case 'player:text-response': return engine.submitTextResponse(roomCode, String(payload.playerId ?? ''), String(payload.reconnectToken ?? ''), String(payload.answer ?? ''));
    case 'player:final-wager': engine.submitFinalWager(roomCode, String(payload.playerId ?? ''), String(payload.reconnectToken ?? ''), Number(payload.wager)); return null;
    case 'player:final-answer': engine.submitFinalAnswer(roomCode, String(payload.playerId ?? ''), String(payload.reconnectToken ?? ''), String(payload.answer ?? '')); return null;
    default: throw new Error(`Unsupported game event: ${event}`);
  }
}

async function handleHostRequest(connection: DataConnection, message: RequestMessage): Promise<void> {
  try {
    const data = await dispatchHost(message.event, message.payload, connection);
    connection.send({ kind: 'response', requestId: message.requestId, ok: true, data } satisfies ResponseMessage);
    const roomCode = String(message.payload.roomCode ?? '').toUpperCase();
    if (roomCode) emitRoom(roomCode);
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
      if (settled) return;
      settled = true;
      if (hostPeer && hostPeer !== peer) { try { hostPeer.destroy(); } catch { /* ignore */ } }
      hostPeer = peer;
      hostRoomCode = roomCode;
      socket.connected = true;
      peer.on('connection', attachHostConnection);
      peer.on('disconnected', () => {
        socket.connected = false;
        const reconnect = () => {
          if (!hostPeer || hostPeer.destroyed || !hostPeer.disconnected) return;
          try { hostPeer.reconnect(); } catch { window.setTimeout(reconnect, 1000); }
        };
        window.setTimeout(reconnect, 500);
      });
      peer.on('close', () => { socket.connected = false; });
      peer.on('error', () => { if (peer.disconnected && !peer.destroyed) { try { peer.reconnect(); } catch { /* next event retries */ } } });
      resolve();
    });
    peer.on('error', finishError);
    window.setTimeout(() => finishError(new Error('Timed out starting the host connection')), 8000);
  });
}
async function startHostPeer(roomCode: string, retryUnavailable: boolean): Promise<void> {
  if (hostPeer && hostRoomCode === roomCode && !hostPeer.destroyed) {
    if (hostPeer.disconnected) { try { hostPeer.reconnect(); } catch { /* keep existing connections */ } }
    socket.connected = !hostPeer.disconnected;
    return;
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
    if (message?.kind === 'event') emitLocal(message.event, message.data);
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
    if (clientPeer.open || clientPeer.disconnected) return Promise.resolve(clientPeer);
  }
  return new Promise((resolve, reject) => {
    const peer = new Peer(peerOptions());
    clientPeer = peer;
    let settled = false;
    peer.on('open', () => { if (!settled) { settled = true; resolve(peer); } });
    peer.on('disconnected', () => { socket.connected = false; try { peer.reconnect(); } catch { scheduleClientReconnect(); } });
    peer.on('error', (error) => { if (!settled) { settled = true; reject(error instanceof Error ? error : new Error('Could not connect to signaling')); } else if (clientRoomCode) scheduleClientReconnect(); });
    peer.on('close', () => { socket.connected = false; if (clientRoomCode) scheduleClientReconnect(); });
    window.setTimeout(() => { if (!settled) { settled = true; reject(new Error('Timed out connecting to signaling')); } }, 8000);
  });
}
function sendRequestOn(connection: DataConnection, event: string, payload: Record<string, unknown>, timeoutMs = 8000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!connection.open) { reject(new Error('Host connection is not open')); return; }
    const requestId = crypto.randomUUID();
    const timeoutId = window.setTimeout(() => { pending.delete(requestId); reject(new Error('Host did not respond')); }, timeoutMs);
    pending.set(requestId, { resolve, reject, timeoutId });
    connection.send({ kind: 'request', requestId, event, payload } satisfies RequestMessage);
  });
}
async function connectToHost(roomCode: string): Promise<DataConnection> {
  const targetRoom = roomCode.toUpperCase();
  if (clientConnection?.open && clientRoomCode === targetRoom) return clientConnection;
  if (clientConnection?.open && clientRoomCode && clientRoomCode !== targetRoom) {
    try { clientConnection.close(); } catch { /* ignore */ }
    clientConnection = null;
    authReplay = null;
  }
  clientRoomCode = targetRoom;
  const peer = await createClientPeer();
  return await new Promise<DataConnection>((resolve, reject) => {
    const connection = peer.connect(hostPeerId(roomCode), { reliable: true, serialization: 'json' });
    let settled = false;
    attachClientConnection(connection);
    connection.on('open', () => {
      if (settled) return;
      settled = true;
      clientConnection = connection;
      socket.connected = true;
      reconnectDelayMs = 400;
      emitLocal('connect');
      const finish = async () => {
        if (authReplay) {
          try { await sendRequestOn(connection, authReplay.event, authReplay.payload, 6000); } catch { /* explicit action can surface auth failure */ }
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
function scheduleClientReconnect(): void {
  if (!clientRoomCode || reconnectTimer !== null) return;
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
async function createHostRoom(payload: Record<string, unknown>): Promise<unknown> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const credentials = engine.createRoom(String(payload.baseUrl ?? baseUrl()), (payload.settings ?? {}) as Partial<GameSettings>);
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
  if (event === 'host:reconnect') await startHostPeer(roomCode, true);
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
window.setInterval(() => {
  if (currentMode() !== 'host' || !hostRoomCode) return;
  for (const changedRoom of engine.tick()) if (changedRoom === hostRoomCode) emitRoom(changedRoom);
}, 250);
