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
  open = false;
  disconnected = false;
  destroyed = false;
  private handlers = new Map<string, Handler[]>();
  constructor(private readonly id?: string) { queueMicrotask(() => { this.open = true; if (this.id) DeterministicPeer.peers.set(this.id, this); this.emit('open', this.id); }); }
  on(event: string, handler: Handler) { this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]); return this; }
  connect(peerId: string) {
    const target = DeterministicPeer.peers.get(peerId);
    const client = new DeterministicConnection();
    const host = new DeterministicConnection();
    DeterministicPeer.clientConnections.push(client);
    client.peerConnection = host; host.peerConnection = client;
    queueMicrotask(() => { target?.emit('connection', host); client.emit('open'); host.emit('open'); });
    return client;
  }
  reconnect() { this.disconnected = false; }
  destroy() { this.destroyed = true; this.disconnected = true; if (this.id) DeterministicPeer.peers.delete(this.id); this.emit('close'); }
  private emit(event: string, ...args: unknown[]) { for (const handler of this.handlers.get(event) ?? []) handler(...args); }
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
    host.destroy(); player.destroy();
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
});
