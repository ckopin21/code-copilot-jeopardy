import { createServer, type Server as HttpServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createGameServer, type GameReply, type GameServer, type ScoreEvent } from '../server/gameServer';
import { createSocketRuntime, type SocketRuntime } from '../src/lib/socket';
import type { HostRoomCredentials, PlayerJoinCredentials, RoomSnapshot } from '../src/shared/types';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

let sequence = 0;
let server: HttpServer | null = null;
let game: GameServer | null = null;
let url = '';
const clients: Socket[] = [];
const runtimes: SocketRuntime[] = [];

function runtime(): SocketRuntime {
  const client = createSocketRuntime({ url, autoConnect: false });
  runtimes.push(client);
  return client;
}

async function resume(runtimeClient: SocketRuntime): Promise<void> {
  const connected = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { runtimeClient.socket.off('connect', onConnect); reject(new Error('Application identity did not restore')); }, 5000);
    const onConnect = () => { clearTimeout(timeout); runtimeClient.socket.off('connect', onConnect); resolve(); };
    runtimeClient.socket.on('connect', onConnect);
  });
  runtimeClient.resumeClientSession();
  await connected;
}

async function start(): Promise<void> {
  server = createServer();
  game = createGameServer({ httpServer: server, storage: new MemoryStorage() });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test HTTP server has no TCP address');
  url = `http://127.0.0.1:${address.port}`;
}

async function connect(): Promise<Socket> {
  const socket = io(url, { transports: ['websocket'], reconnection: false, forceNew: true, autoConnect: false });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket.IO client did not connect')), 5000);
    socket.once('connect', () => { clearTimeout(timeout); resolve(); });
    socket.once('connect_error', (error) => { clearTimeout(timeout); reject(error); });
    socket.connect();
  });
  return socket;
}

async function request<T>(socket: Socket, event: string, payload: Record<string, unknown>, requestId = `test-${++sequence}`): Promise<T> {
  const reply = await new Promise<GameReply>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${event} did not acknowledge`)), 5000);
    socket.emit('game:request', { requestId, event, payload }, (result: GameReply) => {
      clearTimeout(timeout);
      resolve(result);
    });
  });
  if (!reply.ok) throw new Error(`${event}: ${reply.error}`);
  return reply.data as T;
}

async function rejection(socket: Socket, event: string, payload: Record<string, unknown>, requestId = `test-${++sequence}`): Promise<string> {
  const reply = await new Promise<GameReply>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${event} did not acknowledge`)), 5000);
    socket.emit('game:request', { requestId, event, payload }, (result: GameReply) => {
      clearTimeout(timeout);
      resolve(result);
    });
  });
  expect(reply.ok).toBe(false);
  return reply.error ?? '';
}

function hostPayload(host: HostRoomCredentials, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { roomCode: host.roomCode, hostToken: host.hostToken, ...extra };
}

function playerPayload(player: PlayerJoinCredentials, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { roomCode: player.roomCode, playerId: player.playerId, reconnectToken: player.reconnectToken, ...extra };
}

async function join(socket: Socket, roomCode: string, name: string): Promise<PlayerJoinCredentials> {
  return request(socket, 'player:join', { roomCode, name, avatar: '🚀', accent: '#93c5fd' });
}

function presentationToken(host: HostRoomCredentials): string {
  const token = new URL(host.presentationUrl).searchParams.get('display');
  if (!token) throw new Error('Host credentials did not include a presentation capability');
  return token;
}

afterEach(async () => {
  for (const client of runtimes.splice(0)) client.destroy();
  for (const client of clients.splice(0)) client.disconnect();
  await game?.close();
  if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
  game = null;
  server = null;
});

describe('LAN Socket.IO game server', () => {
  it('uses the production socket adapter for Host, two phones, Presentation, scoring, and identity replay', async () => {
    await start();
    const hostClient = runtime();
    const oneClient = runtime();
    const twoClient = runtime();
    const displayClient = runtime();
    const roomOptions = { settings: { dailyDoublesEnabled: false, finalRoundEnabled: false, timerSeconds: null } };
    const [host, sameHost] = await Promise.all([
      hostClient.emitAck<HostRoomCredentials>('room:create', roomOptions),
      hostClient.emitAck<HostRoomCredentials>('room:create', roomOptions)
    ]);
    expect(sameHost.roomCode).toBe(host.roomCode);
    const one = await oneClient.emitAck<PlayerJoinCredentials>('player:join', { roomCode: host.roomCode, name: 'One', avatar: '🚀', accent: '#93c5fd' });
    const two = await twoClient.emitAck<PlayerJoinCredentials>('player:join', { roomCode: host.roomCode, name: 'Two', avatar: '🚀', accent: '#93c5fd' });
    await displayClient.emitAck('presentation:join', { roomCode: host.roomCode, presentationToken: presentationToken(host) });
    const scoreEvents: ScoreEvent[] = [];
    displayClient.socket.on('room:score', (event: ScoreEvent) => scoreEvents.push(event));
    const scoreReceived = new Promise<ScoreEvent>((resolve) => displayClient.socket.on('room:score', resolve));

    await hostClient.emitAck('host:start-game', hostPayload(host));
    const tile = game!.engine.snapshot(host.roomCode).board!.questions[0];
    await hostClient.emitAck('host:select-question', hostPayload(host, { questionId: tile.questionId }));
    await hostClient.emitAck('host:open-buzzers', hostPayload(host));
    const started = game!.engine.snapshot(host.roomCode).gameStartedAt;
    expect((await oneClient.emitAck<{ accepted: boolean }>('player:buzz', playerPayload(one, { questionId: tile.questionId, gameStartedAt: started }))).accepted).toBe(true);
    await hostClient.emitAck('host:reveal-answer', hostPayload(host));
    await hostClient.emitAck('host:resolve-answer', hostPayload(host, { playerId: one.playerId, correct: true }));
    await scoreReceived;
    const before = game!.engine.snapshot(host.roomCode);
    const firstScore = before.players.find((player) => player.id === one.playerId)!.score;
    expect(firstScore).toBeGreaterThan(0);
    expect(scoreEvents.filter((event) => event.playerId === one.playerId)).toHaveLength(1);

    oneClient.suspendClientSession();
    twoClient.suspendClientSession();
    displayClient.suspendClientSession();
    hostClient.suspendClientSession();
    await resume(hostClient);
    await Promise.all([resume(oneClient), resume(twoClient), resume(displayClient)]);
    await oneClient.emitAck('player:heartbeat', playerPayload(one));
    await twoClient.emitAck('player:heartbeat', playerPayload(two));
    const after = game!.engine.snapshot(host.roomCode);
    expect(after.players).toHaveLength(2);
    expect(after.players.find((player) => player.id === one.playerId)?.score).toBe(firstScore);
    expect(after.players.find((player) => player.id === one.playerId)?.seat).toBe(before.players.find((player) => player.id === one.playerId)?.seat);
    expect(game!.getPresentationConnectionCount(host.roomCode)).toBe(1);
    expect(oneClient.getNetworkDiagnostics().some((event) => event.kind === 'identity-restored')).toBe(true);
  });

  it('runs a multi-client clue through the authoritative server and broadcasts one score effect', async () => {
    await start();
    const hostSocket = await connect();
    const host = await request<HostRoomCredentials>(hostSocket, 'room:create', { settings: { dailyDoublesEnabled: false, finalRoundEnabled: false, timerSeconds: null } });
    expect((await request<HostRoomCredentials>(hostSocket, 'room:create', {}, 'second-create')).roomCode).toBe(host.roomCode);
    const oneSocket = await connect();
    const twoSocket = await connect();
    const displaySocket = await connect();
    const one = await join(oneSocket, host.roomCode, 'One');
    await join(twoSocket, host.roomCode, 'Two');
    const display = await request<RoomSnapshot>(displaySocket, 'presentation:join', { roomCode: host.roomCode, presentationToken: presentationToken(host) });
    expect(display.players).toHaveLength(2);
    const scores: ScoreEvent[] = [];
    displaySocket.on('room:score', (event: ScoreEvent) => scores.push(event));

    await request(hostSocket, 'host:start-game', hostPayload(host));
    const board = game!.engine.snapshot(host.roomCode).board!;
    const questionId = board.questions[0].questionId;
    await request(hostSocket, 'host:select-question', hostPayload(host, { questionId }));
    await request(hostSocket, 'host:open-buzzers', hostPayload(host));
    const context = game!.engine.snapshot(host.roomCode);
    const buzzPayload = playerPayload(one, { questionId, gameStartedAt: context.gameStartedAt });
    const buzz = await request<{ accepted: boolean }>(oneSocket, 'player:buzz', buzzPayload, 'buzz-once');
    expect(buzz.accepted).toBe(true);
    expect(await request<{ accepted: boolean }>(oneSocket, 'player:buzz', buzzPayload, 'buzz-once')).toEqual(buzz);
    expect(game!.engine.snapshot(host.roomCode).currentQuestion?.buzzWinnerId).toBe(one.playerId);
    await request(hostSocket, 'host:reveal-answer', hostPayload(host));
    const scoreRequestId = 'score-once';
    await request(hostSocket, 'host:resolve-answer', hostPayload(host, { playerId: one.playerId, correct: true }), scoreRequestId);
    const score = game!.engine.snapshot(host.roomCode).players.find((player) => player.id === one.playerId)!.score;
    expect(score).toBeGreaterThan(0);
    await request(hostSocket, 'host:resolve-answer', hostPayload(host, { playerId: one.playerId, correct: true }), scoreRequestId);
    expect(game!.engine.snapshot(host.roomCode).players.find((player) => player.id === one.playerId)?.score).toBe(score);
    expect(scores.filter((event) => event.playerId === one.playerId)).toHaveLength(1);
    expect(await rejection(displaySocket, 'host:adjust-score', hostPayload(host, { playerId: one.playerId, delta: 100 }))).toMatch(/authority|authenticated/i);
    expect(await rejection(oneSocket, 'host:adjust-score', hostPayload(host, { playerId: one.playerId, delta: 100 }))).toMatch(/authority/i);
    await request(hostSocket, 'host:advance-board', hostPayload(host));
    expect(game!.engine.snapshot(host.roomCode).phase).toBe('board');
    const rotated = await request<{ presentationToken: string }>(hostSocket, 'host:rotate-presentation-capability', hostPayload(host));
    expect(rotated.presentationToken).not.toBe(presentationToken(host));
    const oldDisplay = await connect();
    expect(await rejection(oldDisplay, 'presentation:join', { roomCode: host.roomCode, presentationToken: presentationToken(host) })).toMatch(/capability/i);
    const newDisplay = await connect();
    await request(newDisplay, 'presentation:join', { roomCode: host.roomCode, presentationToken: rotated.presentationToken });
    expect(game!.getPresentationConnectionCount(host.roomCode)).toBe(1);

    const anotherHostSocket = await connect();
    const anotherHost = await request<HostRoomCredentials>(anotherHostSocket, 'room:create', {});
    expect(await rejection(oneSocket, 'player:heartbeat', { ...playerPayload(one), roomCode: anotherHost.roomCode })).toMatch(/room/i);
    expect(game!.engine.snapshot(anotherHost.roomCode).players).toHaveLength(0);
    const malformed = await new Promise<GameReply>((resolve) => anotherHostSocket.emit('game:request', { event: 'host:start-game' }, resolve));
    expect(malformed.ok).toBe(false);
    expect(game!.engine.snapshot(anotherHost.roomCode).phase).toBe('lobby');
  });

  it('recovers a mass disconnect without losing identity, score, room access, or deduplication', async () => {
    await start();
    const hostSocket = await connect();
    const host = await request<HostRoomCredentials>(hostSocket, 'room:create', { settings: { dailyDoublesEnabled: false, finalRoundEnabled: false } });
    const firstSocket = await connect();
    const secondSocket = await connect();
    const displaySocket = await connect();
    const first = await join(firstSocket, host.roomCode, 'First');
    const second = await join(secondSocket, host.roomCode, 'Second');
    await request(displaySocket, 'presentation:join', { roomCode: host.roomCode, presentationToken: presentationToken(host) });
    await request(hostSocket, 'host:start-game', hostPayload(host));
    const scoreRequestId = 'stable-score';
    await request(hostSocket, 'host:adjust-score', hostPayload(host, { playerId: first.playerId, delta: 200 }), scoreRequestId);
    const before = game!.engine.snapshot(host.roomCode);
    const firstBefore = before.players.find((player) => player.id === first.playerId)!;

    firstSocket.disconnect();
    secondSocket.disconnect();
    displaySocket.disconnect();
    hostSocket.disconnect();
    const restoredHost = await connect();
    await request(restoredHost, 'host:reconnect', hostPayload(host));
    await request(restoredHost, 'host:adjust-score', hostPayload(host, { playerId: first.playerId, delta: 200 }), scoreRequestId);
    expect(await rejection(restoredHost, 'host:adjust-score', hostPayload(host, { playerId: first.playerId, delta: 500 }), scoreRequestId)).toMatch(/already used/i);

    const retriedFirst = await connect();
    expect(await rejection(retriedFirst, 'player:reconnect', playerPayload(first, { reconnectToken: 'wrong' }))).toMatch(/authorization|token|identity|credential/i);
    const firstReconnect = await request<PlayerJoinCredentials>(retriedFirst, 'player:reconnect', playerPayload(first));
    expect(firstReconnect.playerId).toBe(first.playerId);
    const replacement = await connect();
    await request(replacement, 'player:reconnect', playerPayload(first));
    await new Promise<void>((resolve) => retriedFirst.connected ? retriedFirst.once('disconnect', resolve) : resolve());
    expect(retriedFirst.connected).toBe(false);
    const retriedSecond = await connect();
    await request(retriedSecond, 'player:reconnect', playerPayload(second));
    const restoredDisplay = await connect();
    await request(restoredDisplay, 'presentation:join', { roomCode: host.roomCode, presentationToken: presentationToken(host) });
    const newcomerSocket = await connect();
    await join(newcomerSocket, host.roomCode, 'Newcomer');

    const after = game!.engine.snapshot(host.roomCode);
    const firstAfter = after.players.find((player) => player.id === first.playerId)!;
    expect(after.players).toHaveLength(3);
    expect(firstAfter.name).toBe(firstBefore.name);
    expect(firstAfter.avatar).toBe(firstBefore.avatar);
    expect(firstAfter.seat).toBe(firstBefore.seat);
    expect(firstAfter.score).toBe(firstBefore.score);
    expect(firstAfter.connected).toBe(true);
    expect(game!.getPresentationConnectionCount(host.roomCode)).toBe(1);
    expect(after.phase).toBe(before.phase);
  });

  it('lets the same Host token replace a lingering socket and revokes the old socket', async () => {
    await start();
    const oldSocket = await connect();
    const host = await request<HostRoomCredentials>(oldSocket, 'room:create', {});
    const replacement = await connect();
    const displaced = new Promise<void>((resolve) => oldSocket.once('disconnect', () => resolve()));
    await request(replacement, 'host:reconnect', hostPayload(host));
    await displaced;
    await new Promise<void>((resolve) => { oldSocket.once('connect', () => resolve()); oldSocket.connect(); });
    expect(await rejection(oldSocket, 'host:start-game', hostPayload(host))).toMatch(/authenticated|authority/i);
    await request(replacement, 'host:start-game', hostPayload(host));
    expect(game!.engine.snapshot(host.roomCode).phase).toBe('board');
  });

  it('grades Free Response and a Daily Double through socket requests', async () => {
    await start();
    const hostSocket = await connect();
    const host = await request<HostRoomCredentials>(hostSocket, 'room:create', {
      settings: { gameMode: 'free-response', selectedPackIds: ['free-response-general-1'], freeResponseReadSeconds: 0, dailyDoublesEnabled: false, finalRoundEnabled: false, timerSeconds: null }
    });
    const oneSocket = await connect();
    const twoSocket = await connect();
    const one = await join(oneSocket, host.roomCode, 'One');
    const two = await join(twoSocket, host.roomCode, 'Two');
    await request(hostSocket, 'host:start-game', hostPayload(host));
    const tile = game!.engine.snapshot(host.roomCode).board!.questions[0];
    await request(hostSocket, 'host:select-question', hostPayload(host, { questionId: tile.questionId }));
    const question = game!.engine.snapshot(host.roomCode).currentQuestion!;
    const started = game!.engine.snapshot(host.roomCode).gameStartedAt;
    expect(question.responseMode).toBe('text');
    const textPayload = playerPayload(one, { questionId: tile.questionId, gameStartedAt: started, answer: question.acceptedAnswers![0] });
    await request(oneSocket, 'player:text-response', textPayload, 'text-once');
    await request(oneSocket, 'player:text-response', textPayload, 'text-once');
    expect(Object.keys(game!.engine.snapshot(host.roomCode).currentQuestion?.textResponses ?? {})).toHaveLength(1);
    await request(twoSocket, 'player:text-response', playerPayload(two, { questionId: tile.questionId, gameStartedAt: started, answer: 'A deliberately wrong answer' }));
    expect(game!.engine.snapshot(host.roomCode).currentQuestion?.answerRevealed).toBe(true);
    await request(hostSocket, 'host:confirm-text-grades', hostPayload(host));
    const graded = game!.engine.snapshot(host.roomCode);
    expect(graded.players.find((player) => player.id === one.playerId)?.score).toBeGreaterThan(0);
    expect(graded.phase).toBe('board');

    // A new game can change modes while preserving the room and player identities.
    await request(hostSocket, 'host:reset-game', hostPayload(host));
    await request(hostSocket, 'host:update-settings', hostPayload(host, { updates: { gameMode: 'classic', selectedPackIds: ['history-geography'], dailyDoublesEnabled: true, dailyDoubleCount: 16, allowWagerBeyondScore: true, finalRoundEnabled: false } }));
    await request(hostSocket, 'host:start-game', hostPayload(host));
    const daily = game!.engine.snapshot(host.roomCode).board!.questions.find((entry) => entry.dailyDouble)!;
    await request(hostSocket, 'host:select-question', hostPayload(host, { questionId: daily.questionId, dailyDoublePlayerId: one.playerId }));
    const dailyState = game!.engine.snapshot(host.roomCode);
    expect(dailyState.phase).toBe('daily-double-wager');
    const wagerPayload = playerPayload(one, { questionId: daily.questionId, gameStartedAt: dailyState.gameStartedAt, wager: 100 });
    await request(oneSocket, 'player:daily-double-wager', wagerPayload, 'daily-wager-once');
    await request(oneSocket, 'player:daily-double-wager', wagerPayload, 'daily-wager-once');
    expect(game!.engine.snapshot(host.roomCode).currentQuestion?.wager).toBe(100);
    await request(hostSocket, 'host:reveal-answer', hostPayload(host));
    await request(hostSocket, 'host:resolve-answer', hostPayload(host, { playerId: one.playerId, correct: true }));
    expect(game!.engine.snapshot(host.roomCode).players.find((player) => player.id === one.playerId)?.score).toBe(100);
  });

  it('does not broadcast room state for read-only requests', async () => {
    await start();
    const hostSocket = await connect();
    const host = await request<HostRoomCredentials>(hostSocket, 'room:create', {});
    const playerSocket = await connect();
    const player = await join(playerSocket, host.roomCode, 'Quiet');
    await new Promise((resolve) => setTimeout(resolve, 50));
    let broadcasts = 0;
    playerSocket.on('room:state', () => { broadcasts += 1; });
    await request(hostSocket, 'host:get-player-health', hostPayload(host));
    await request(hostSocket, 'host:get-presentation-count', hostPayload(host));
    await request(playerSocket, 'player:heartbeat', playerPayload(player));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(broadcasts).toBe(0);
    await request(hostSocket, 'host:update-settings', hostPayload(host, { updates: { timerSeconds: 20 } }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(broadcasts).toBe(1);
  });

  it('tells the Host when saving rooms fails and when it recovers', async () => {
    const storage = new MemoryStorage();
    let failWrites = false;
    const setItem = storage.setItem.bind(storage);
    storage.setItem = (key: string, value: string) => {
      if (failWrites) throw new Error('disk full');
      setItem(key, value);
    };
    server = createServer();
    game = createGameServer({ httpServer: server, storage });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test HTTP server has no TCP address');
    url = `http://127.0.0.1:${address.port}`;

    const hostSocket = await connect();
    const statuses: boolean[] = [];
    hostSocket.on('server:persistence', (status: { ok: boolean }) => statuses.push(status.ok));
    const host = await request<HostRoomCredentials>(hostSocket, 'room:create', {});
    failWrites = true;
    await request(hostSocket, 'host:update-settings', hostPayload(host, { updates: { timerSeconds: 20 } }));
    failWrites = false;
    await request(hostSocket, 'host:update-settings', hostPayload(host, { updates: { timerSeconds: 30 } }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(statuses).toEqual([true, false, true]);
  });

  it('keeps unrevealed Final answers private on Presentation and supports a room-preserving rematch', async () => {
    await start();
    const hostSocket = await connect();
    const host = await request<HostRoomCredentials>(hostSocket, 'room:create', { settings: { gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true, timerSeconds: null } });
    const playerSocket = await connect();
    const displaySocket = await connect();
    const player = await join(playerSocket, host.roomCode, 'Finalist');
    await request(displaySocket, 'presentation:join', { roomCode: host.roomCode, presentationToken: presentationToken(host) });
    await request(hostSocket, 'host:start-game', hostPayload(host));
    while (game!.engine.snapshot(host.roomCode).phase === 'board') {
      const tile = game!.engine.snapshot(host.roomCode).board!.questions.find((entry) => !entry.used)!;
      await request(hostSocket, 'host:select-question', hostPayload(host, { questionId: tile.questionId }));
      await request(hostSocket, 'host:reveal-answer', hostPayload(host));
      await request(hostSocket, 'host:advance-board', hostPayload(host));
    }
    expect(game!.engine.snapshot(host.roomCode).phase).toBe('final-category');
    await request(hostSocket, 'host:begin-final-wagers', hostPayload(host));
    const started = game!.engine.snapshot(host.roomCode).gameStartedAt;
    await request(playerSocket, 'player:final-wager', playerPayload(player, { wager: 0, gameStartedAt: started }));
    await request(hostSocket, 'host:open-final-question', hostPayload(host));
    const finalPayload = playerPayload(player, { answer: 'private final answer', gameStartedAt: started });
    await request(playerSocket, 'player:final-answer', finalPayload, 'final-answer-once');
    await request(playerSocket, 'player:final-answer', finalPayload, 'final-answer-once');
    const displayBefore = await request<RoomSnapshot>(displaySocket, 'presentation:join', { roomCode: host.roomCode, presentationToken: presentationToken(host) });
    expect(displayBefore.players.find((entry) => entry.id === player.playerId)?.finalAnswer).toBeNull();
    await request(hostSocket, 'host:begin-final-review', hostPayload(host));
    const displayDuring = await request<RoomSnapshot>(displaySocket, 'presentation:join', { roomCode: host.roomCode, presentationToken: presentationToken(host) });
    expect(displayDuring.phase).toBe('final-review');
    await request(hostSocket, 'host:resolve-final', hostPayload(host, { playerId: player.playerId, correct: false }));
    await request(hostSocket, 'host:end-game', hostPayload(host));
    expect(game!.engine.snapshot(host.roomCode).phase).toBe('recap');
    await request(hostSocket, 'host:reset-game', hostPayload(host));
    const rematch = game!.engine.snapshot(host.roomCode);
    expect(rematch.phase).toBe('lobby');
    expect(rematch.players.find((entry) => entry.id === player.playerId)?.name).toBe('Finalist');
    expect(rematch.players.find((entry) => entry.id === player.playerId)?.score).toBe(0);
  });
});
