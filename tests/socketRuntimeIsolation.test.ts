import { beforeAll, describe, expect, it } from 'vitest';
import { BrowserGameEngine } from '../src/lib/browserGameEngine';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

type Handler = (...args: any[]) => void;
class DeterministicConnection {
  open = true;
  private handlers = new Map<string, Handler[]>();
  peerConnection?: DeterministicConnection;
  on(event: string, handler: Handler) { this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]); return this; }
  send(data: unknown) { queueMicrotask(() => this.peerConnection?.emit('data', data)); }
  close() { if (!this.open) return; this.open = false; this.emit('close'); const other = this.peerConnection; if (other?.open) { other.open = false; other.emit('close'); } }
  emit(event: string, ...args: unknown[]) { for (const handler of this.handlers.get(event) ?? []) handler(...args); }
}
class DeterministicPeer {
  static peers = new Map<string, DeterministicPeer>();
  static clientConnections: DeterministicConnection[] = [];
  static instances: DeterministicPeer[] = [];
  static reconnectFailures = 0;
  static connectFailures = 0;
  open = false;
  disconnected = false;
  destroyed = false;
  private handlers = new Map<string, Handler[]>();
  constructor(private readonly id?: string) { DeterministicPeer.instances.push(this); queueMicrotask(() => { this.open = true; if (this.id) DeterministicPeer.peers.set(this.id, this); this.emit('open', this.id); }); }
  on(event: string, handler: Handler) { this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]); return this; }
  connect(peerId: string) {
    const target = DeterministicPeer.peers.get(peerId);
    const client = new DeterministicConnection();
    const host = new DeterministicConnection();
    DeterministicPeer.clientConnections.push(client);
    client.peerConnection = host; host.peerConnection = client;
    queueMicrotask(() => {
      if (DeterministicPeer.connectFailures > 0 || !target || target.destroyed) {
        DeterministicPeer.connectFailures = Math.max(0, DeterministicPeer.connectFailures - 1);
        client.open = false;
        client.emit('error', new Error('Host peer is unavailable'));
        client.emit('close');
        return;
      }
      target.emit('connection', host); client.emit('open'); host.emit('open');
    });
    return client;
  }
  reconnect() {
    if (DeterministicPeer.reconnectFailures > 0) {
      DeterministicPeer.reconnectFailures -= 1;
      throw new Error('Temporary signaling failure');
    }
    this.disconnected = false;
    queueMicrotask(() => this.emit('open', this.id));
  }
  destroy() { this.destroyed = true; this.disconnected = true; if (this.id) DeterministicPeer.peers.delete(this.id); this.emit('close'); }
  emit(event: string, ...args: unknown[]) { for (const handler of this.handlers.get(event) ?? []) handler(...args); }
}

const settle = async () => { await Promise.resolve(); await Promise.resolve(); await new Promise((resolve) => setTimeout(resolve, 0)); };

beforeAll(() => {
  const browser = globalThis as typeof globalThis & { window: Window; document: Document; location: Location; history: History };
  const url = new URL('https://example.test/?mode=player');
  const timers = new Set<ReturnType<typeof setInterval>>();
  browser.location = url as unknown as Location;
  browser.history = { replaceState() {} } as unknown as History;
  browser.document = { visibilityState: 'visible', addEventListener() {} } as unknown as Document;
  browser.window = {
    ...globalThis,
    location: browser.location,
    history: browser.history,
    fetch: globalThis.fetch,
    addEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval(callback: TimerHandler, delay?: number) {
      const timer = setInterval(callback, delay);
      timers.add(timer);
      return timer as unknown as number;
    },
    clearInterval(timer: number) { clearInterval(timer); }
  } as unknown as Window;
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

describe('production socket runtime isolation', () => {
  it('keeps public connection state and local subscriptions instance-owned', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    const one = createSocketRuntime({ installBrowserHooks: false });
    const two = createSocketRuntime({ installBrowserHooks: false });
    let oneDisconnects = 0;
    let twoDisconnects = 0;
    one.socket.on('disconnect', () => { oneDisconnects += 1; });
    two.socket.on('disconnect', () => { twoDisconnects += 1; });

    one.socket.connected = true;
    one.suspendClientSession();

    expect(one.socket.connected).toBe(false);
    expect(two.socket.connected).toBe(false);
    expect(oneDisconnects).toBe(1);
    expect(twoDisconnects).toBe(0);
    one.destroy();
    two.destroy();
  });

  it('runs join, broadcast, buzz, and answer through concurrent production runtimes', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    const peerFactory = (id: string | undefined) => new DeterministicPeer(id) as never;
    const hostEngine = new BrowserGameEngine();
    location.search = '?mode=host';
    const host = createSocketRuntime({ createPeer: peerFactory, createEngine: () => hostEngine, installBrowserHooks: false });
    const credentials = await host.emitAck<{ roomCode: string; hostToken: string }>('room:create', { settings: { dailyDoublesEnabled: false, finalRoundEnabled: false } });
    const playerOne = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    const playerTwo = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    location.search = '?mode=player';
    const one = await playerOne.emitAck<{ playerId: string; reconnectToken: string }>('player:join', { roomCode: credentials.roomCode, name: 'One', avatar: '🚀', accent: '#93c5fd' });
    const two = await playerTwo.emitAck<{ playerId: string; reconnectToken: string }>('player:join', { roomCode: credentials.roomCode, name: 'Two', avatar: '🛰️', accent: '#f9a8d4' });
    const broadcasts: unknown[] = [];
    playerOne.socket.on('room:state', (state) => broadcasts.push(state));

    location.search = '?mode=host';
    await host.emitAck('host:start-game', { roomCode: credentials.roomCode, hostToken: credentials.hostToken });
    const before = hostEngine.snapshot(credentials.roomCode);
    const question = before.board!.questions.find((entry) => !entry.used)!;
    await host.emitAck('host:select-question', { roomCode: credentials.roomCode, hostToken: credentials.hostToken, questionId: question.questionId });
    await host.emitAck('host:open-buzzers', { roomCode: credentials.roomCode, hostToken: credentials.hostToken });
    const current = hostEngine.snapshot(credentials.roomCode);

    location.search = '?mode=player';
    await expect(playerOne.emitAck('player:buzz', { roomCode: credentials.roomCode, ...one, questionId: current.currentQuestion!.questionId, gameStartedAt: current.gameStartedAt })).resolves.toMatchObject({ accepted: true });
    location.search = '?mode=host';
    await host.emitAck('host:reveal-answer', { roomCode: credentials.roomCode, hostToken: credentials.hostToken });
    await host.emitAck('host:resolve-answer', { roomCode: credentials.roomCode, hostToken: credentials.hostToken, playerId: one.playerId, correct: true });
    await settle();

    expect(hostEngine.snapshot(credentials.roomCode).players.find((player) => player.id === one.playerId)?.score).toBeGreaterThan(0);
    expect(hostEngine.snapshot(credentials.roomCode).players).toHaveLength(2);
    expect(two.playerId).not.toBe(one.playerId);
    expect(broadcasts.length).toBeGreaterThan(0);
    host.destroy(); playerOne.destroy(); playerTwo.destroy();
  });

  it('recovers a functioning room after simultaneous player disconnects and a failed reconnect retry', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    DeterministicPeer.peers.clear();
    DeterministicPeer.clientConnections = [];
    DeterministicPeer.connectFailures = 0;
    const peerFactory = (id: string | undefined) => new DeterministicPeer(id) as never;
    const engine = new BrowserGameEngine();
    location.search = '?mode=host';
    const host = createSocketRuntime({ createPeer: peerFactory, createEngine: () => engine, installBrowserHooks: false });
    const room = await host.emitAck<{ roomCode: string; hostToken: string }>('room:create', { settings: { dailyDoublesEnabled: false, finalRoundEnabled: false } });
    location.search = '?mode=player';
    const one = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    const two = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    const oneIdentity = await one.emitAck<{ playerId: string; reconnectToken: string }>('player:join', { roomCode: room.roomCode, name: 'One', avatar: '🚀', accent: '#93c5fd' });
    const twoIdentity = await two.emitAck<{ playerId: string; reconnectToken: string }>('player:join', { roomCode: room.roomCode, name: 'Two', avatar: '🛰️', accent: '#f9a8d4' });
    const originalSeats = new Map(engine.snapshot(room.roomCode).players.map((player) => [player.id, player.seat]));

    location.search = '?mode=host';
    await host.emitAck('host:start-game', { roomCode: room.roomCode, hostToken: room.hostToken });
    const firstQuestion = engine.snapshot(room.roomCode).board!.questions.find((question) => !question.used)!;
    await host.emitAck('host:select-question', { roomCode: room.roomCode, hostToken: room.hostToken, questionId: firstQuestion.questionId });
    await host.emitAck('host:open-buzzers', { roomCode: room.roomCode, hostToken: room.hostToken });
    location.search = '?mode=player';
    await one.emitAck('player:buzz', { roomCode: room.roomCode, ...oneIdentity, questionId: firstQuestion.questionId, gameStartedAt: engine.snapshot(room.roomCode).gameStartedAt });
    location.search = '?mode=host';
    await host.emitAck('host:reveal-answer', { roomCode: room.roomCode, hostToken: room.hostToken });
    await host.emitAck('host:resolve-answer', { roomCode: room.roomCode, hostToken: room.hostToken, playerId: oneIdentity.playerId, correct: true });
    const scoreBeforeFailure = engine.snapshot(room.roomCode).players.find((player) => player.id === oneIdentity.playerId)!.score;

    // This is the reported incident's controlled equivalent: every active player
    // data channel closes at once while the authoritative host stays alive.
    DeterministicPeer.clientConnections[0]!.close();
    DeterministicPeer.clientConnections[1]!.close();
    await new Promise((resolve) => setTimeout(resolve, 700));
    const afterMassReconnect = engine.snapshot(room.roomCode);
    expect(one.socket.connected).toBe(true);
    expect(two.socket.connected).toBe(true);
    expect(afterMassReconnect.players).toHaveLength(2);
    expect(afterMassReconnect.players.map((player) => player.id).sort()).toEqual([oneIdentity.playerId, twoIdentity.playerId].sort());
    expect(afterMassReconnect.players.every((player) => player.connected && player.seat === originalSeats.get(player.id))).toBe(true);
    expect(afterMassReconnect.players.find((player) => player.id === oneIdentity.playerId)?.score).toBe(scoreBeforeFailure);

    // One failed recovery attempt must clear its pending state and retry rather
    // than leaving an otherwise valid saved session permanently disconnected.
    DeterministicPeer.connectFailures = 1;
    DeterministicPeer.clientConnections.at(-1)!.close();
    await new Promise((resolve) => setTimeout(resolve, 1400));
    expect(two.socket.connected).toBe(true);
    expect(engine.snapshot(room.roomCode).players).toHaveLength(2);

    // A recovered room remains usable for both restored and new clients.
    location.search = '?mode=host';
    await host.emitAck('host:advance-board', { roomCode: room.roomCode, hostToken: room.hostToken });
    const nextQuestion = engine.snapshot(room.roomCode).board!.questions.find((question) => !question.used)!;
    await host.emitAck('host:select-question', { roomCode: room.roomCode, hostToken: room.hostToken, questionId: nextQuestion.questionId });
    await host.emitAck('host:open-buzzers', { roomCode: room.roomCode, hostToken: room.hostToken });
    location.search = '?mode=player';
    await expect(two.emitAck('player:buzz', { roomCode: room.roomCode, ...twoIdentity, questionId: nextQuestion.questionId, gameStartedAt: engine.snapshot(room.roomCode).gameStartedAt })).resolves.toMatchObject({ accepted: true });
    const newcomer = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    await newcomer.emitAck('player:join', { roomCode: room.roomCode, name: 'New', avatar: '🎯', accent: '#86efac' });
    expect(engine.snapshot(room.roomCode).players).toHaveLength(3);
    host.destroy(); one.destroy(); two.destroy(); newcomer.destroy();
  });

  it('re-registers a destroyed host peer and ignores its delayed signaling events', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    DeterministicPeer.peers.clear();
    DeterministicPeer.clientConnections = [];
    DeterministicPeer.reconnectFailures = 1;
    const peerFactory = (id: string | undefined) => new DeterministicPeer(id) as never;
    const engine = new BrowserGameEngine();
    location.search = '?mode=host';
    const host = createSocketRuntime({ createPeer: peerFactory, createEngine: () => engine, installBrowserHooks: false });
    const room = await host.emitAck<{ roomCode: string; hostToken: string }>('room:create', { settings: { dailyDoublesEnabled: false, finalRoundEnabled: false } });
    location.search = '?mode=player';
    const player = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    const identity = await player.emitAck<{ playerId: string; reconnectToken: string }>('player:join', { roomCode: room.roomCode, name: 'Host recovery', avatar: '🚀', accent: '#93c5fd' });

    const oldHostPeer = DeterministicPeer.peers.values().next().value!;
    oldHostPeer.disconnected = true;
    oldHostPeer.emit('disconnected');
    await new Promise((resolve) => setTimeout(resolve, 2200));
    expect(host.socket.connected).toBe(true);

    // A permanently closed signaling peer must be replaced without abandoning
    // the persisted room. Closing the data channel models the accompanying
    // WebRTC loss that real players observe when their host Peer disappears.
    oldHostPeer.destroy();
    DeterministicPeer.clientConnections[0]!.close();
    await new Promise((resolve) => setTimeout(resolve, 1600));
    const replacementHostPeer = DeterministicPeer.peers.values().next().value!;
    expect(replacementHostPeer).not.toBe(oldHostPeer);
    expect(host.socket.connected).toBe(true);
    expect(player.socket.connected).toBe(true);
    expect(engine.snapshot(room.roomCode).players).toEqual([expect.objectContaining({ id: identity.playerId, connected: true })]);

    oldHostPeer.emit('close');
    oldHostPeer.emit('error', new Error('late stale host peer error'));
    await settle();
    expect(host.socket.connected).toBe(true);
    expect([...DeterministicPeer.peers.values()]).toContain(replacementHostPeer);
    host.destroy(); player.destroy();
  });

  it('coalesces simultaneous duplicate production packets and replays the cached acknowledgement', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    DeterministicPeer.peers.clear();
    DeterministicPeer.clientConnections = [];
    const peerFactory = (id: string | undefined) => new DeterministicPeer(id) as never;
    const engine = new BrowserGameEngine();
    location.search = '?mode=host';
    const host = createSocketRuntime({ createPeer: peerFactory, createEngine: () => engine, installBrowserHooks: false });
    const room = await host.emitAck<{ roomCode: string; hostToken: string }>('room:create', { settings: { dailyDoublesEnabled: false, finalRoundEnabled: false } });
    const player = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    location.search = '?mode=player';
    const credentials = await player.emitAck<{ playerId: string; reconnectToken: string }>('player:join', { roomCode: room.roomCode, name: 'Duplicate', avatar: '🚀', accent: '#93c5fd' });
    location.search = '?mode=host';
    await host.emitAck('host:start-game', { roomCode: room.roomCode, hostToken: room.hostToken });
    const question = engine.snapshot(room.roomCode).board!.questions.find((entry) => !entry.used)!;
    await host.emitAck('host:select-question', { roomCode: room.roomCode, hostToken: room.hostToken, questionId: question.questionId });
    await host.emitAck('host:open-buzzers', { roomCode: room.roomCode, hostToken: room.hostToken });
    const state = engine.snapshot(room.roomCode);
    const wire = DeterministicPeer.clientConnections[0]!;
    const responses: Array<{ ok: boolean; data?: { accepted?: boolean } }> = [];
    wire.on('data', (message: { kind?: string; requestId?: string; ok?: boolean; data?: { accepted?: boolean } }) => {
      if (message.kind === 'response' && message.requestId === 'same-buzz') responses.push(message);
    });
    const packet = { kind: 'request', requestId: 'same-buzz', event: 'player:buzz', payload: { roomCode: room.roomCode, ...credentials, questionId: state.currentQuestion!.questionId, gameStartedAt: state.gameStartedAt } };
    wire.send(packet);
    wire.send(packet);
    await settle();
    wire.send(packet);
    await settle();

    expect(engine.snapshot(room.roomCode).currentQuestion?.buzzWinnerId).toBe(credentials.playerId);
    expect(responses).toHaveLength(3);
    expect(responses.every((response) => response.ok && response.data?.accepted)).toBe(true);
    player.destroy();
    await settle();
    const retryingPlayer = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    location.search = '?mode=player';
    await retryingPlayer.emitAck('player:reconnect', { roomCode: room.roomCode, ...credentials });
    const retryWire = DeterministicPeer.clientConnections.at(-1)!;
    const retried: Array<{ ok: boolean; data?: { accepted?: boolean } }> = [];
    retryWire.on('data', (message: { kind?: string; requestId?: string; ok?: boolean; data?: { accepted?: boolean } }) => {
      if (message.kind === 'response' && message.requestId === 'same-buzz') retried.push(message);
    });
    retryWire.send(packet);
    await settle();
    expect(retried).toEqual([expect.objectContaining({ ok: true, data: expect.objectContaining({ accepted: true }) })]);
    host.destroy(); retryingPlayer.destroy();
  });

  it('restores a disconnected player through a replacement production runtime without duplicating its seat', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    DeterministicPeer.peers.clear();
    const peerFactory = (id: string | undefined) => new DeterministicPeer(id) as never;
    const engine = new BrowserGameEngine();
    location.search = '?mode=host';
    const host = createSocketRuntime({ createPeer: peerFactory, createEngine: () => engine, installBrowserHooks: false });
    const room = await host.emitAck<{ roomCode: string; hostToken: string }>('room:create', { settings: {} });
    const first = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    location.search = '?mode=player';
    const credentials = await first.emitAck<{ playerId: string; reconnectToken: string }>('player:join', { roomCode: room.roomCode, name: 'Reconnect', avatar: '🚀', accent: '#93c5fd' });
    const seat = engine.snapshot(room.roomCode).players[0]!.seat;
    first.destroy();
    await settle();
    const replacement = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    const restored = await replacement.emitAck<{ playerId: string; reconnectToken: string }>('player:reconnect', { roomCode: room.roomCode, ...credentials });
    const players = engine.snapshot(room.roomCode).players;

    expect(restored.playerId).toBe(credentials.playerId);
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({ id: credentials.playerId, seat, connected: true, name: 'Reconnect' });
    host.destroy(); replacement.destroy();
  });

  it('rejects delayed stale-question and stale-game packets on the production host dispatcher', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    DeterministicPeer.peers.clear();
    DeterministicPeer.clientConnections = [];
    const peerFactory = (id: string | undefined) => new DeterministicPeer(id) as never;
    const engine = new BrowserGameEngine();
    location.search = '?mode=host';
    const host = createSocketRuntime({ createPeer: peerFactory, createEngine: () => engine, installBrowserHooks: false });
    const room = await host.emitAck<{ roomCode: string; hostToken: string }>('room:create', { settings: { dailyDoublesEnabled: false, finalRoundEnabled: false } });
    const player = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    location.search = '?mode=player';
    const identity = await player.emitAck<{ playerId: string; reconnectToken: string }>('player:join', { roomCode: room.roomCode, name: 'Stale', avatar: '🚀', accent: '#93c5fd' });
    location.search = '?mode=host';
    await host.emitAck('host:start-game', { roomCode: room.roomCode, hostToken: room.hostToken });
    const first = engine.snapshot(room.roomCode);
    const firstQuestion = first.board!.questions.find((entry) => !entry.used)!;
    await host.emitAck('host:select-question', { roomCode: room.roomCode, hostToken: room.hostToken, questionId: firstQuestion.questionId });
    const staleContext = engine.snapshot(room.roomCode);
    await host.emitAck('host:reveal-answer', { roomCode: room.roomCode, hostToken: room.hostToken });
    await host.emitAck('host:advance-board', { roomCode: room.roomCode, hostToken: room.hostToken });
    const secondQuestion = engine.snapshot(room.roomCode).board!.questions.find((entry) => !entry.used)!;
    await host.emitAck('host:select-question', { roomCode: room.roomCode, hostToken: room.hostToken, questionId: secondQuestion.questionId });
    await host.emitAck('host:open-buzzers', { roomCode: room.roomCode, hostToken: room.hostToken });
    const wire = DeterministicPeer.clientConnections[0]!;
    const errors: string[] = [];
    wire.on('data', (message: { kind?: string; requestId?: string; ok?: boolean; error?: string }) => { if (message.kind === 'response' && message.requestId?.startsWith('stale-') && !message.ok) errors.push(message.error ?? ''); });
    wire.send({ kind: 'request', requestId: 'stale-question', event: 'player:buzz', payload: { roomCode: room.roomCode, ...identity, questionId: staleContext.currentQuestion!.questionId, gameStartedAt: staleContext.gameStartedAt } });
    await settle();
    const afterQuestion = engine.snapshot(room.roomCode);
    expect(afterQuestion.currentQuestion?.buzzWinnerId).toBeNull();
    expect(errors.join(' ')).toMatch(/older question/i);

    await host.emitAck('host:reset-game', { roomCode: room.roomCode, hostToken: room.hostToken });
    wire.send({ kind: 'request', requestId: 'stale-game', event: 'player:buzz', payload: { roomCode: room.roomCode, ...identity, questionId: secondQuestion.questionId, gameStartedAt: staleContext.gameStartedAt } });
    await settle();
    expect(engine.snapshot(room.roomCode).phase).toBe('lobby');
    expect(errors.join(' ')).toMatch(/older game/i);
    host.destroy(); player.destroy();
  });

  it('reconstructs a persisted host room and restores an existing player without duplicate state', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    DeterministicPeer.peers.clear();
    const peerFactory = (id: string | undefined) => new DeterministicPeer(id) as never;
    const initialEngine = new BrowserGameEngine();
    location.search = '?mode=host';
    const firstHost = createSocketRuntime({ createPeer: peerFactory, createEngine: () => initialEngine, installBrowserHooks: false });
    const room = await firstHost.emitAck<{ roomCode: string; hostToken: string }>('room:create', { settings: { dailyDoublesEnabled: false, finalRoundEnabled: false } });
    const firstPlayer = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    location.search = '?mode=player';
    const identity = await firstPlayer.emitAck<{ playerId: string; reconnectToken: string }>('player:join', { roomCode: room.roomCode, name: 'Recovery', avatar: '🚀', accent: '#93c5fd' });
    location.search = '?mode=host';
    await firstHost.emitAck('host:start-game', { roomCode: room.roomCode, hostToken: room.hostToken });
    const before = initialEngine.snapshot(room.roomCode);
    firstHost.destroy();
    firstPlayer.destroy();
    await settle();

    const recoveredEngine = new BrowserGameEngine();
    const recoveredHost = createSocketRuntime({ createPeer: peerFactory, createEngine: () => recoveredEngine, installBrowserHooks: false });
    const restored = await recoveredHost.emitAck<{ code: string; phase: string }>('host:reconnect', { roomCode: room.roomCode, hostToken: room.hostToken });
    location.search = '?mode=player';
    const recoveredPlayer = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    await recoveredPlayer.emitAck('player:reconnect', { roomCode: room.roomCode, ...identity });
    const after = recoveredEngine.snapshot(room.roomCode);

    expect(restored).toMatchObject({ code: room.roomCode, phase: before.phase });
    expect(after.players).toHaveLength(1);
    expect(after.players[0]).toMatchObject({ id: identity.playerId, name: 'Recovery', connected: true });
    expect(after.phase).toBe(before.phase);
    recoveredHost.destroy(); recoveredPlayer.destroy();
  });

  it('removes a replaced connection authority before its delayed packet can mutate the current question', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    DeterministicPeer.peers.clear();
    DeterministicPeer.clientConnections = [];
    const peerFactory = (id: string | undefined) => new DeterministicPeer(id) as never;
    const engine = new BrowserGameEngine();
    location.search = '?mode=host';
    const host = createSocketRuntime({ createPeer: peerFactory, createEngine: () => engine, installBrowserHooks: false });
    const room = await host.emitAck<{ roomCode: string; hostToken: string }>('room:create', { settings: { dailyDoublesEnabled: false, finalRoundEnabled: false } });
    const original = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    location.search = '?mode=player';
    const identity = await original.emitAck<{ playerId: string; reconnectToken: string }>('player:join', { roomCode: room.roomCode, name: 'Replace', avatar: '🚀', accent: '#93c5fd' });
    const staleWire = DeterministicPeer.clientConnections[0]!;
    const replacement = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    await replacement.emitAck('player:reconnect', { roomCode: room.roomCode, ...identity });
    location.search = '?mode=host';
    await host.emitAck('host:start-game', { roomCode: room.roomCode, hostToken: room.hostToken });
    const question = engine.snapshot(room.roomCode).board!.questions.find((entry) => !entry.used)!;
    await host.emitAck('host:select-question', { roomCode: room.roomCode, hostToken: room.hostToken, questionId: question.questionId });
    await host.emitAck('host:open-buzzers', { roomCode: room.roomCode, hostToken: room.hostToken });
    const state = engine.snapshot(room.roomCode);
    staleWire.send({ kind: 'request', requestId: 'stale-connection', event: 'player:buzz', payload: { roomCode: room.roomCode, ...identity, questionId: state.currentQuestion!.questionId, gameStartedAt: state.gameStartedAt } });
    await settle();
    expect(engine.snapshot(room.roomCode).currentQuestion?.buzzWinnerId).toBeNull();
    location.search = '?mode=player';
    await expect(replacement.emitAck('player:buzz', { roomCode: room.roomCode, ...identity, questionId: state.currentQuestion!.questionId, gameStartedAt: state.gameStartedAt })).resolves.toMatchObject({ accepted: true });
    host.destroy(); original.destroy(); replacement.destroy();
  });

  it('ignores a delayed close from an obsolete client connection after reconnecting', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    DeterministicPeer.peers.clear();
    DeterministicPeer.clientConnections = [];
    const peerFactory = (id: string | undefined) => new DeterministicPeer(id) as never;
    const host = createSocketRuntime({ createPeer: peerFactory, createEngine: () => new BrowserGameEngine(), installBrowserHooks: false });
    location.search = '?mode=host';
    const room = await host.emitAck<{ roomCode: string }>('room:create', { settings: {} });
    location.search = '?mode=player';
    const player = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    await player.emitAck('player:join', { roomCode: room.roomCode, name: 'Generation', avatar: '🚀', accent: '#93c5fd' });
    const old = DeterministicPeer.clientConnections[0]!;
    old.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const current = DeterministicPeer.clientConnections[1]!;
    expect(player.socket.connected).toBe(true);
    old.emit('close');
    old.emit('error', new Error('late'));
    await settle();
    expect(current.open).toBe(true);
    expect(player.socket.connected).toBe(true);
    host.destroy(); player.destroy();
  });

  it('ignores stale data events that would otherwise suspend a recovered client session', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    DeterministicPeer.peers.clear();
    DeterministicPeer.clientConnections = [];
    const peerFactory = (id: string | undefined) => new DeterministicPeer(id) as never;
    location.search = '?mode=host';
    const host = createSocketRuntime({ createPeer: peerFactory, createEngine: () => new BrowserGameEngine(), installBrowserHooks: false });
    const room = await host.emitAck<{ roomCode: string }>('room:create', { settings: {} });
    location.search = '?mode=player';
    const player = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    await player.emitAck('player:join', { roomCode: room.roomCode, name: 'Stale data', avatar: '🚀', accent: '#93c5fd' });
    const old = DeterministicPeer.clientConnections[0]!;
    player.resumeClientSession(false, true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const current = DeterministicPeer.clientConnections[1]!;
    old.emit('data', { kind: 'event', event: 'player:removed', data: {} });
    await settle();
    expect(player.socket.connected).toBe(true);
    current.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(player.socket.connected).toBe(true);
    expect(DeterministicPeer.clientConnections).toHaveLength(3);
    host.destroy(); player.destroy();
  });

  it('coalesces overlapping reconnect triggers and ignores stale peer-generation events', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    DeterministicPeer.peers.clear();
    DeterministicPeer.clientConnections = [];
    DeterministicPeer.instances = [];
    const peerFactory = (id: string | undefined) => new DeterministicPeer(id) as never;
    location.search = '?mode=host';
    const host = createSocketRuntime({ createPeer: peerFactory, createEngine: () => new BrowserGameEngine(), installBrowserHooks: false });
    const room = await host.emitAck<{ roomCode: string }>('room:create', { settings: {} });
    location.search = '?mode=player';
    const player = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    await player.emitAck('player:join', { roomCode: room.roomCode, name: 'Peer generation', avatar: '🚀', accent: '#93c5fd' });
    const oldPeer = DeterministicPeer.instances.find((candidate) => !candidate['id'])!;
    player.resumeClientSession(false, true);
    player.resumeClientSession(false, true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const liveConnection = DeterministicPeer.clientConnections.at(-1)!;
    const peersAfterReconnect = DeterministicPeer.instances.filter((candidate) => !candidate['id']);
    expect(peersAfterReconnect).toHaveLength(2);
    expect(player.socket.connected).toBe(true);
    oldPeer.emit('disconnected');
    oldPeer.emit('close');
    oldPeer.emit('error', new Error('stale peer'));
    await settle();
    expect(liveConnection.open).toBe(true);
    expect(player.socket.connected).toBe(true);
    host.destroy(); player.destroy();
  });

  it('keeps Free Response submissions authoritative across reconnects, duplicates, and stale connections', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    DeterministicPeer.peers.clear();
    DeterministicPeer.clientConnections = [];
    const peerFactory = (id: string | undefined) => new DeterministicPeer(id) as never;
    const engine = new BrowserGameEngine();
    location.search = '?mode=host';
    const host = createSocketRuntime({ createPeer: peerFactory, createEngine: () => engine, installBrowserHooks: false });
    const room = await host.emitAck<{ roomCode: string; hostToken: string }>('room:create', {
      settings: { gameMode: 'free-response', dailyDoublesEnabled: false, finalRoundEnabled: false, freeResponseReadSeconds: 0, timerSeconds: 15, allowNegativeScores: true }
    });
    location.search = '?mode=player';
    const one = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    const two = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    const oneIdentity = await one.emitAck<{ playerId: string; reconnectToken: string }>('player:join', { roomCode: room.roomCode, name: 'Free one', avatar: '🚀', accent: '#93c5fd' });
    const twoIdentity = await two.emitAck<{ playerId: string; reconnectToken: string }>('player:join', { roomCode: room.roomCode, name: 'Free two', avatar: '🛰️', accent: '#f9a8d4' });
    location.search = '?mode=host';
    await host.emitAck('host:start-game', { roomCode: room.roomCode, hostToken: room.hostToken });
    const question = engine.snapshot(room.roomCode).board!.questions.find((candidate) => !candidate.used)!;
    await host.emitAck('host:select-question', { roomCode: room.roomCode, hostToken: room.hostToken, questionId: question.questionId });
    const state = engine.snapshot(room.roomCode);
    expect(state.currentQuestion?.responseMode).toBe('text');

    // Disconnect during collection, then let the real client reconnect/replay its identity.
    const staleOneWire = DeterministicPeer.clientConnections[0]!;
    staleOneWire.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const restoredOneWire = DeterministicPeer.clientConnections.at(-1)!;
    expect(one.socket.connected).toBe(true);
    staleOneWire.send({ kind: 'request', requestId: 'stale-text', event: 'player:text-response', payload: { roomCode: room.roomCode, ...oneIdentity, answer: 'stale', questionId: question.questionId, gameStartedAt: state.gameStartedAt } });
    await settle();
    expect(engine.snapshot(room.roomCode).currentQuestion?.textResponses?.[oneIdentity.playerId]).toBeUndefined();

    location.search = '?mode=player';
    await one.emitAck('player:text-response', { roomCode: room.roomCode, ...oneIdentity, answer: 'first', questionId: question.questionId, gameStartedAt: state.gameStartedAt });
    const duplicateResponses: Array<{ ok?: boolean }> = [];
    const twoWire = DeterministicPeer.clientConnections[1]!;
    twoWire.on('data', (message: { kind?: string; requestId?: string; ok?: boolean }) => {
      if (message.kind === 'response' && message.requestId === 'duplicate-text') duplicateResponses.push(message);
    });
    const duplicate = { kind: 'request', requestId: 'duplicate-text', event: 'player:text-response', payload: { roomCode: room.roomCode, ...twoIdentity, answer: 'second', questionId: question.questionId, gameStartedAt: state.gameStartedAt } };
    twoWire.send(duplicate);
    twoWire.send(duplicate);
    await settle();
    const revealed = engine.snapshot(room.roomCode);
    expect(revealed.currentQuestion?.textResponses).toMatchObject({ [oneIdentity.playerId]: expect.any(Object), [twoIdentity.playerId]: expect.any(Object) });
    expect(duplicateResponses).toHaveLength(2);
    expect(duplicateResponses.every((response) => response.ok)).toBe(true);

    location.search = '?mode=host';
    await host.emitAck('host:resolve-text', { roomCode: room.roomCode, hostToken: room.hostToken, playerId: oneIdentity.playerId, correct: true });
    await host.emitAck('host:resolve-text', { roomCode: room.roomCode, hostToken: room.hostToken, playerId: twoIdentity.playerId, correct: false });
    await host.emitAck('host:confirm-text-grades', { roomCode: room.roomCode, hostToken: room.hostToken });
    const finished = engine.snapshot(room.roomCode);
    expect(finished.phase).toBe('board');
    expect(finished.players.find((player) => player.id === oneIdentity.playerId)?.score).toBeGreaterThan(0);
    expect(finished.players.find((player) => player.id === twoIdentity.playerId)?.score).toBeLessThan(0);
    expect(restoredOneWire.open).toBe(true);
    host.destroy(); one.destroy(); two.destroy();
  });

  it('preserves Final credentials and rejects duplicate or stale answer traffic through the production protocol', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    DeterministicPeer.peers.clear();
    DeterministicPeer.clientConnections = [];
    const peerFactory = (id: string | undefined) => new DeterministicPeer(id) as never;
    const engine = new BrowserGameEngine();
    location.search = '?mode=host';
    const host = createSocketRuntime({ createPeer: peerFactory, createEngine: () => engine, installBrowserHooks: false });
    const room = await host.emitAck<{ roomCode: string; hostToken: string }>('room:create', { settings: { gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true, timerSeconds: 15 } });
    location.search = '?mode=player';
    const player = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    const identity = await player.emitAck<{ playerId: string; reconnectToken: string }>('player:join', { roomCode: room.roomCode, name: 'Finalist', avatar: '🚀', accent: '#93c5fd' });
    location.search = '?mode=host';
    await host.emitAck('host:start-game', { roomCode: room.roomCode, hostToken: room.hostToken });
    while (engine.snapshot(room.roomCode).phase === 'board') {
      const question = engine.snapshot(room.roomCode).board!.questions.find((candidate) => !candidate.used)!;
      await host.emitAck('host:select-question', { roomCode: room.roomCode, hostToken: room.hostToken, questionId: question.questionId });
      await host.emitAck('host:reveal-answer', { roomCode: room.roomCode, hostToken: room.hostToken });
      await host.emitAck('host:advance-board', { roomCode: room.roomCode, hostToken: room.hostToken });
    }
    expect(engine.snapshot(room.roomCode).phase).toBe('final-category');
    await host.emitAck('host:begin-final-wagers', { roomCode: room.roomCode, hostToken: room.hostToken });
    const staleWire = DeterministicPeer.clientConnections[0]!;
    staleWire.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(player.socket.connected).toBe(true);
    location.search = '?mode=player';
    await player.emitAck('player:final-wager', { roomCode: room.roomCode, ...identity, wager: 0, gameStartedAt: engine.snapshot(room.roomCode).gameStartedAt });
    location.search = '?mode=host';
    await host.emitAck('host:open-final-question', { roomCode: room.roomCode, hostToken: room.hostToken });
    const liveWire = DeterministicPeer.clientConnections.at(-1)!;
    const responses: Array<{ ok?: boolean }> = [];
    liveWire.on('data', (message: { kind?: string; requestId?: string; ok?: boolean }) => {
      if (message.kind === 'response' && message.requestId === 'duplicate-final-answer') responses.push(message);
    });
    const answer = { kind: 'request', requestId: 'duplicate-final-answer', event: 'player:final-answer', payload: { roomCode: room.roomCode, ...identity, answer: 'answer', gameStartedAt: engine.snapshot(room.roomCode).gameStartedAt } };
    liveWire.send(answer);
    liveWire.send(answer);
    await settle();
    expect(engine.snapshot(room.roomCode).finalRound).toMatchObject({ responsesClosed: true, responsesClosedReason: 'all-submitted' });
    expect(responses).toHaveLength(2);
    expect(responses.every((response) => response.ok)).toBe(true);
    staleWire.send({ ...answer, requestId: 'stale-final-answer' });
    await settle();
    expect(engine.snapshot(room.roomCode).players.find((candidate) => candidate.id === identity.playerId)?.finalAnswer).toBe('answer');
    host.destroy(); player.destroy();
  });

  it('moves same-room host authority deterministically without allowing the displaced runtime to mutate', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    DeterministicPeer.peers.clear();
    DeterministicPeer.clientConnections = [];
    const peerFactory = (id: string | undefined) => new DeterministicPeer(id) as never;
    location.search = '?mode=host';
    const firstEngine = new BrowserGameEngine();
    const firstHost = createSocketRuntime({ createPeer: peerFactory, createEngine: () => firstEngine, installBrowserHooks: false });
    const room = await firstHost.emitAck<{ roomCode: string; hostToken: string }>('room:create', { settings: { dailyDoublesEnabled: false, finalRoundEnabled: false } });
    location.search = '?mode=player';
    const player = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    const identity = await player.emitAck<{ playerId: string; reconnectToken: string }>('player:join', { roomCode: room.roomCode, name: 'Authority', avatar: '🚀', accent: '#93c5fd' });

    location.search = '?mode=host';
    const recoveredEngine = new BrowserGameEngine();
    const replacementHost = createSocketRuntime({ createPeer: peerFactory, createEngine: () => recoveredEngine, installBrowserHooks: false });
    await replacementHost.emitAck('host:reconnect', { roomCode: room.roomCode, hostToken: room.hostToken, allowAuthorityTakeover: true });
    await expect(firstHost.emitAck('host:start-game', { roomCode: room.roomCode, hostToken: room.hostToken })).rejects.toThrow(/active host/i);

    location.search = '?mode=player';
    player.resumeClientSession(false, true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(player.socket.connected).toBe(true);
    location.search = '?mode=host';
    await replacementHost.emitAck('host:start-game', { roomCode: room.roomCode, hostToken: room.hostToken });
    expect(recoveredEngine.snapshot(room.roomCode)).toMatchObject({ phase: 'board', players: [expect.objectContaining({ id: identity.playerId, connected: true })] });
    firstHost.destroy(); replacementHost.destroy(); player.destroy();
  });

  it('enforces and rotates presentation capabilities through the production socket protocol', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    DeterministicPeer.peers.clear();
    const peerFactory = (id: string | undefined) => new DeterministicPeer(id) as never;
    const engine = new BrowserGameEngine();
    location.search = '?mode=host';
    const host = createSocketRuntime({ createPeer: peerFactory, createEngine: () => engine, installBrowserHooks: false });
    const room = await host.emitAck<{ roomCode: string; hostToken: string; presentationUrl: string }>('room:create', { settings: {} });
    const token = new URL(room.presentationUrl).searchParams.get('display')!;
    location.search = '?mode=presentation';
    const rejected = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    await expect(rejected.emitAck('presentation:join', { roomCode: room.roomCode, presentationToken: 'invalid' })).rejects.toThrow(/capability/i);
    const display = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    await expect(display.emitAck<{ code: string }>('presentation:join', { roomCode: room.roomCode, presentationToken: token })).resolves.toMatchObject({ code: room.roomCode });
    expect(display.socket.connected).toBe(true);
    location.search = '?mode=host';
    const rotated = await host.emitAck<{ presentationToken: string }>('host:rotate-presentation-capability', { roomCode: room.roomCode, hostToken: room.hostToken });
    await settle();
    expect(rotated.presentationToken).not.toBe(token);
    expect(display.socket.connected).toBe(false);
    const currentDisplay = createSocketRuntime({ createPeer: peerFactory, installBrowserHooks: false });
    location.search = '?mode=presentation';
    await expect(currentDisplay.emitAck('presentation:join', { roomCode: room.roomCode, presentationToken: token })).rejects.toThrow(/capability/i);
    await expect(currentDisplay.emitAck<{ code: string }>('presentation:join', { roomCode: room.roomCode, presentationToken: rotated.presentationToken })).resolves.toMatchObject({ code: room.roomCode });
    host.destroy(); rejected.destroy(); display.destroy(); currentDisplay.destroy();
  });
});
