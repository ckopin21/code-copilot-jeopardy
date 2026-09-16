import { beforeEach, describe, expect, it } from 'vitest';
import type { GameSettings } from '../src/shared/types';
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
  private value = 0.113;
  next(): number { this.value = (this.value * 7.13 + 0.19) % 1; return this.value; }
}

function setup(settings: Partial<GameSettings> = {}) {
  const engine = new BrowserGameEngine(new FixedRandom(), 60_000);
  const host = engine.createRoom('https://example.test/game', { randomizeCategories: false, ...settings });
  return { engine, host };
}

function addPlayer(engine: BrowserGameEngine, roomCode: string, name = 'Alex') {
  return engine.joinPlayer(roomCode, { name, avatar: '🚀', accent: '#93c5fd' });
}

function firstUnused(engine: BrowserGameEngine, roomCode: string) {
  return engine.snapshot(roomCode).board!.questions.find((question) => !question.used)!;
}

function finishBoardWithoutScoring(engine: BrowserGameEngine, roomCode: string, hostToken: string): void {
  while (engine.snapshot(roomCode).phase === 'board') {
    const tile = firstUnused(engine, roomCode);
    engine.selectQuestion(roomCode, hostToken, tile.questionId);
    engine.revealAnswer(roomCode, hostToken);
    engine.advanceToBoard(roomCode, hostToken);
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

describe('BrowserGameEngine production state', () => {
  it('reconnects a reserved seat without changing player identity', () => {
    const { engine, host } = setup();
    const player = addPlayer(engine, host.roomCode);
    engine.setPlayerConnected(host.roomCode, player.playerId, false);
    expect(engine.snapshot(host.roomCode).players[0].connected).toBe(false);

    const reconnected = engine.reconnectPlayer(host.roomCode, player.playerId, player.reconnectToken);
    expect(reconnected.playerId).toBe(player.playerId);
    expect(engine.snapshot(host.roomCode).players[0].connected).toBe(true);
  });

  it('restores an active timer instead of erasing it on host reload', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, timerSeconds: 30 });
    addPlayer(engine, host.roomCode);
    engine.startGame(host.roomCode, host.hostToken);
    const tile = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    const before = engine.snapshot(host.roomCode).timer;
    expect(before.running).toBe(true);
    expect(before.endsAt).not.toBeNull();

    const restored = new BrowserGameEngine(new FixedRandom(), 60_000);
    const after = restored.snapshot(host.roomCode).timer;
    expect(after.running).toBe(true);
    expect(after.endsAt).toBe(before.endsAt);
    expect(after.remainingMs).toBeGreaterThan(0);
  });

  it('turns an unowned Daily Double into a normal practice clue', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: true, dailyDoubleCount: 16 });
    engine.startGame(host.roomCode, host.hostToken);
    const daily = engine.snapshot(host.roomCode).board!.questions.find((question) => question.dailyDouble)!;
    engine.selectQuestion(host.roomCode, host.hostToken, daily.questionId);
    const state = engine.snapshot(host.roomCode);

    expect(state.phase).toBe('question');
    expect(state.currentQuestion?.dailyDouble).toBe(false);
    expect(state.currentQuestion?.dailyDoublePlayerId).toBeNull();
  });

  it('snapshots only connected players into Final Round', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true });
    const one = addPlayer(engine, host.roomCode, 'One');
    const two = addPlayer(engine, host.roomCode, 'Two');
    engine.startGame(host.roomCode, host.hostToken);
    engine.setPlayerConnected(host.roomCode, two.playerId, false);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);

    const state = engine.snapshot(host.roomCode);
    expect(state.phase).toBe('final-category');
    expect(state.finalRound?.participantIds).toEqual([one.playerId]);
    expect(state.players.find((player) => player.id === two.playerId)?.finalResolved).toBe(true);
  });

  it('locks Final answers at timeout without revealing until the host starts review', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true, timerSeconds: 5 });
    const player = addPlayer(engine, host.roomCode);
    engine.startGame(host.roomCode, host.hostToken);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    engine.submitFinalWager(host.roomCode, player.playerId, player.reconnectToken, 100);
    engine.openFinalQuestion(host.roomCode, host.hostToken);

    const open = engine.snapshot(host.roomCode);
    expect(open.phase).toBe('final-question');
    expect(open.finalRound?.responsesClosed).toBe(false);
    engine.tick((open.timer.endsAt ?? Date.now()) + 1);

    const locked = engine.snapshot(host.roomCode);
    expect(locked.phase).toBe('final-question');
    expect(locked.finalRound?.responsesClosed).toBe(true);
    expect(locked.timer.running).toBe(false);
    expect(() => engine.submitFinalAnswer(host.roomCode, player.playerId, player.reconnectToken, 'late answer')).toThrow(/closed/i);

    engine.beginFinalReview(host.roomCode, host.hostToken);
    expect(engine.snapshot(host.roomCode).phase).toBe('final-review');
  });

  it('locks Final responses after all active participants submit but preserves host-controlled reveal', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true });
    const player = addPlayer(engine, host.roomCode);
    engine.startGame(host.roomCode, host.hostToken);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    engine.submitFinalWager(host.roomCode, player.playerId, player.reconnectToken, 0);
    engine.openFinalQuestion(host.roomCode, host.hostToken);

    engine.submitFinalAnswer(host.roomCode, player.playerId, player.reconnectToken, 'locked answer');
    const state = engine.snapshot(host.roomCode);
    expect(state.phase).toBe('final-question');
    expect(state.finalRound?.responsesClosed).toBe(true);
    expect(state.players[0].finalAnswerSubmitted).toBe(true);
  });

  it('does not let a disconnected Final participant block response locking', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true });
    const one = addPlayer(engine, host.roomCode, 'One');
    const two = addPlayer(engine, host.roomCode, 'Two');
    engine.startGame(host.roomCode, host.hostToken);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    engine.submitFinalWager(host.roomCode, one.playerId, one.reconnectToken, 0);
    engine.submitFinalWager(host.roomCode, two.playerId, two.reconnectToken, 0);
    engine.openFinalQuestion(host.roomCode, host.hostToken);
    engine.setPlayerConnected(host.roomCode, two.playerId, false);
    engine.submitFinalAnswer(host.roomCode, one.playerId, one.reconnectToken, 'answer');

    const state = engine.snapshot(host.roomCode);
    expect(state.finalRound?.responsesClosed).toBe(true);
    expect(state.phase).toBe('final-question');
  });

  it('requires host authorization before suspending a reserved seat', () => {
    const { engine, host } = setup();
    const player = addPlayer(engine, host.roomCode);

    expect(() => engine.suspendPlayer(host.roomCode, 'wrong-token', player.playerId)).toThrow(/authorization/i);
    expect(engine.snapshot(host.roomCode).players[0].connected).toBe(true);

    engine.suspendPlayer(host.roomCode, host.hostToken, player.playerId);
    expect(engine.snapshot(host.roomCode).players[0].connected).toBe(false);
  });

  it('honors room locking while reserved players can still reconnect', () => {
    const { engine, host } = setup({ lockRoomOnStart: true });
    const player = addPlayer(engine, host.roomCode, 'One');
    engine.startGame(host.roomCode, host.hostToken);

    expect(() => addPlayer(engine, host.roomCode, 'Two')).toThrow(/locked/i);
    engine.setPlayerConnected(host.roomCode, player.playerId, false);
    expect(() => engine.reconnectPlayer(host.roomCode, player.playerId, player.reconnectToken)).not.toThrow();
  });

  it('keeps exact late-game multiplier windows', () => {
    const { engine } = setup();
    expect(engine.multiplierForRemaining(7)).toBe(1);
    expect(engine.multiplierForRemaining(6)).toBe(2);
    expect(engine.multiplierForRemaining(4)).toBe(2);
    expect(engine.multiplierForRemaining(3)).toBe(3);
    expect(engine.multiplierForRemaining(1)).toBe(3);
  });
});
