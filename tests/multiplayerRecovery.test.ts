import { beforeEach, describe, expect, it } from 'vitest';
import { BrowserGameEngine, type RandomSource } from '../src/lib/browserGameEngine';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

class FixedRandom implements RandomSource {
  private value = 0.271;
  next(): number { this.value = (this.value * 5.73 + 0.17) % 1; return this.value; }
}

function createFreeResponseGame() {
  const engine = new BrowserGameEngine(new FixedRandom(), 60_000);
  const host = engine.createRoom('https://example.test/game', {
    gameMode: 'free-response',
    gameLength: 'quick',
    randomizeCategories: false,
    dailyDoublesEnabled: false,
    finalRoundEnabled: false,
    timerSeconds: null,
    freeResponseReadSeconds: 0,
    allowNegativeScores: true
  });
  const one = engine.joinPlayer(host.roomCode, { name: 'One', avatar: '🚀', accent: '#93c5fd' });
  const two = engine.joinPlayer(host.roomCode, { name: 'Two', avatar: '🧪', accent: '#f472b6' });
  engine.startGame(host.roomCode, host.hostToken);
  const tile = engine.snapshot(host.roomCode).board!.questions.find((question) => !question.used)!;
  engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
  return { engine, host, one, two, questionId: tile.questionId };
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

describe('multiplayer recovery during Free Response', () => {
  it('restores the same players and active response state after temporary network loss', () => {
    const { engine, host, one, two, questionId } = createFreeResponseGame();
    engine.adjustScore(host.roomCode, host.hostToken, one.playerId, 500);
    engine.submitTextResponse(host.roomCode, one.playerId, one.reconnectToken, 'first answer', questionId);

    const before = engine.snapshot(host.roomCode);
    const beforeOne = before.players.find((player) => player.id === one.playerId)!;
    expect(before.currentQuestion?.textResponses?.[one.playerId]?.answer).toBe('first answer');

    engine.setPlayerConnected(host.roomCode, one.playerId, false);
    engine.setPlayerConnected(host.roomCode, two.playerId, false);

    const offline = engine.snapshot(host.roomCode);
    expect(offline.code).toBe(host.roomCode);
    expect(offline.phase).toBe('question');
    expect(offline.currentQuestion?.questionId).toBe(questionId);
    expect(offline.currentQuestion?.responsesClosed).toBe(false);
    expect(offline.players).toHaveLength(2);

    const firstReconnect = engine.reconnectPlayer(host.roomCode, one.playerId, one.reconnectToken);
    const repeatedReconnect = engine.reconnectPlayer(host.roomCode, one.playerId, one.reconnectToken);
    engine.reconnectPlayer(host.roomCode, two.playerId, two.reconnectToken);

    expect(firstReconnect.playerId).toBe(one.playerId);
    expect(repeatedReconnect.playerId).toBe(one.playerId);

    const restored = engine.snapshot(host.roomCode);
    const restoredOne = restored.players.find((player) => player.id === one.playerId)!;
    expect(restored.players).toHaveLength(2);
    expect(new Set(restored.players.map((player) => player.id)).size).toBe(2);
    expect(restoredOne.score).toBe(beforeOne.score);
    expect(restoredOne.avatar).toBe(beforeOne.avatar);
    expect(restoredOne.accent).toBe(beforeOne.accent);
    expect(restored.currentQuestion?.textResponses?.[one.playerId]?.answer).toBe('first answer');
    expect(restored.currentQuestion?.questionId).toBe(questionId);

    engine.submitTextResponse(host.roomCode, two.playerId, two.reconnectToken, 'second answer', questionId);
    const completed = engine.snapshot(host.roomCode);
    expect(completed.currentQuestion?.responsesClosed).toBe(true);
    expect(completed.currentQuestion?.textResponses?.[two.playerId]?.answer).toBe('second answer');
  });

  it('preserves the active room and Free Response question across host disconnect and reconnect', () => {
    const { engine, host, one, questionId } = createFreeResponseGame();
    engine.submitTextResponse(host.roomCode, one.playerId, one.reconnectToken, 'locked answer', questionId);

    engine.setHostConnected(host.roomCode, false);
    const disconnected = engine.snapshot(host.roomCode);
    expect(disconnected.hostConnected).toBe(false);
    expect(disconnected.phase).toBe('question');
    expect(disconnected.currentQuestion?.questionId).toBe(questionId);

    const restoredHost = engine.reconnectHost(host.roomCode, host.hostToken);
    expect(restoredHost.hostConnected).toBe(true);
    expect(restoredHost.phase).toBe('question');
    expect(restoredHost.currentQuestion?.questionId).toBe(questionId);
    expect(restoredHost.currentQuestion?.textResponses?.[one.playerId]?.answer).toBe('locked answer');
    expect(restoredHost.players).toHaveLength(2);
  });

  it('lets a host-paused player reclaim the reserved seat without creating a duplicate', () => {
    const { engine, host, one } = createFreeResponseGame();
    const before = engine.snapshot(host.roomCode).players.find((player) => player.id === one.playerId)!;

    engine.suspendPlayer(host.roomCode, host.hostToken, one.playerId);
    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === one.playerId)?.connected).toBe(false);

    const credentials = engine.reconnectPlayer(host.roomCode, one.playerId, one.reconnectToken);
    const restored = engine.snapshot(host.roomCode);
    const player = restored.players.find((candidate) => candidate.id === one.playerId)!;

    expect(credentials.playerId).toBe(one.playerId);
    expect(restored.players).toHaveLength(2);
    expect(restored.players.filter((candidate) => candidate.id === one.playerId)).toHaveLength(1);
    expect(player.connected).toBe(true);
    expect(player.name).toBe(before.name);
    expect(player.score).toBe(before.score);
    expect(player.avatar).toBe(before.avatar);
    expect(player.accent).toBe(before.accent);
  });
});
