import { beforeEach, describe, expect, it } from 'vitest';
import { BrowserGameEngine, type RandomSource } from '../src/lib/browserGameEngine';
import { builtInPacks } from '../src/packs';
import { GAME_LENGTH_CONFIG } from '../src/shared/config';
import type { GameLength } from '../src/shared/types';

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
  next(): number { this.value = (this.value * 5.91 + 0.23) % 1; return this.value; }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

describe('full built-in game audit', () => {
  for (const pack of builtInPacks) {
    for (const gameLength of ['quick', 'standard', 'marathon'] as GameLength[]) {
      it(`${pack.title} completes a ${gameLength} board cleanly`, () => {
        localStorage.clear();
        const engine = new BrowserGameEngine(new FixedRandom(), 60_000);
        const host = engine.createRoom('https://example.test/game', {
          selectedPackIds: [pack.id],
          mixedPacks: false,
          randomizeCategories: false,
          dailyDoublesEnabled: false,
          finalRoundEnabled: false,
          gameLength
        });
        engine.startGame(host.roomCode, host.hostToken);

        const expected = GAME_LENGTH_CONFIG[gameLength];
        const started = engine.snapshot(host.roomCode);
        expect(started.board?.categories).toHaveLength(expected.categories);
        expect(started.board?.questions).toHaveLength(expected.categories * expected.rows);
        expect(started.remainingQuestions).toBe(expected.categories * expected.rows);

        while (engine.snapshot(host.roomCode).phase === 'board') {
          const state = engine.snapshot(host.roomCode);
          const tile = state.board!.questions.find((item) => !item.used)!;
          engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
          engine.revealAnswer(host.roomCode, host.hostToken);
          engine.advanceToBoard(host.roomCode, host.hostToken);
        }

        const ended = engine.snapshot(host.roomCode);
        expect(ended.phase).toBe('recap');
        expect(ended.remainingQuestions).toBe(0);
      });
    }
  }

  it('completes a multiplayer lifecycle with reconnect, scoring, Daily Double, Final, and reset', () => {
    const engine = new BrowserGameEngine(new FixedRandom(), 60_000);
    const host = engine.createRoom('https://example.test/game', {
      selectedPackIds: ['sports-games'],
      mixedPacks: false,
      randomizeCategories: false,
      gameLength: 'quick',
      dailyDoublesEnabled: true,
      dailyDoubleCount: 1,
      finalRoundEnabled: true,
      timerSeconds: null
    });
    const one = engine.joinPlayer(host.roomCode, { name: 'One', avatar: '🚀', accent: '#93c5fd' });
    const two = engine.joinPlayer(host.roomCode, { name: 'Two', avatar: '🦊', accent: '#f9a8d4' });
    const originalSeats = engine.snapshot(host.roomCode).players.map((player) => [player.id, player.seat] as const);

    engine.startGame(host.roomCode, host.hostToken);
    engine.setPlayerConnected(host.roomCode, two.playerId, false);
    const restoredTwo = engine.reconnectPlayer(host.roomCode, two.playerId, two.reconnectToken);
    expect(restoredTwo.playerId).toBe(two.playerId);
    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === two.playerId)?.connected).toBe(true);

    let state = engine.snapshot(host.roomCode);
    const normal = state.board!.questions.find((item) => !item.dailyDouble)!;
    engine.selectQuestion(host.roomCode, host.hostToken, normal.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    expect(engine.buzz(host.roomCode, one.playerId, one.reconnectToken).accepted).toBe(true);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, one.playerId, true);
    engine.advanceToBoard(host.roomCode, host.hostToken);
    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === one.playerId)?.stats.correct).toBe(1);

    state = engine.snapshot(host.roomCode);
    const dailyDouble = state.board!.questions.find((item) => item.dailyDouble && !item.used)!;
    engine.selectQuestion(host.roomCode, host.hostToken, dailyDouble.questionId, two.playerId);
    expect(engine.snapshot(host.roomCode).phase).toBe('daily-double-wager');
    engine.setDailyDoubleWager(host.roomCode, host.hostToken, 100);
    expect(engine.snapshot(host.roomCode).phase).toBe('daily-double-question');
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, two.playerId, false);
    engine.advanceToBoard(host.roomCode, host.hostToken);
    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === two.playerId)?.stats.incorrect).toBe(1);

    while (engine.snapshot(host.roomCode).phase === 'board') {
      state = engine.snapshot(host.roomCode);
      const tile = state.board!.questions.find((item) => !item.used)!;
      engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
      engine.revealAnswer(host.roomCode, host.hostToken);
      engine.advanceToBoard(host.roomCode, host.hostToken);
    }

    expect(engine.snapshot(host.roomCode).phase).toBe('final-category');
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    engine.submitFinalWager(host.roomCode, one.playerId, one.reconnectToken, 100);
    engine.submitFinalWager(host.roomCode, two.playerId, two.reconnectToken, 0);
    engine.openFinalQuestion(host.roomCode, host.hostToken);
    engine.submitFinalAnswer(host.roomCode, one.playerId, one.reconnectToken, 'answer one');
    engine.submitFinalAnswer(host.roomCode, two.playerId, two.reconnectToken, 'answer two');
    engine.beginFinalReview(host.roomCode, host.hostToken);

    while (engine.snapshot(host.roomCode).phase === 'final-review') {
      const review = engine.snapshot(host.roomCode);
      const playerId = review.finalRound?.reviewPlayerId;
      expect(playerId).toBeTruthy();
      engine.resolveFinalAnswer(host.roomCode, host.hostToken, playerId!, false);
    }

    expect(engine.snapshot(host.roomCode).phase).toBe('recap');
    engine.resetGame(host.roomCode, host.hostToken);
    const reset = engine.snapshot(host.roomCode);
    expect(reset.phase).toBe('lobby');
    expect(reset.players.map((player) => [player.id, player.seat] as const)).toEqual(originalSeats);
    expect(reset.players.every((player) => player.connected && player.score === 0)).toBe(true);
    expect(engine.reconnectPlayer(host.roomCode, one.playerId, one.reconnectToken).playerId).toBe(one.playerId);
    expect(engine.reconnectPlayer(host.roomCode, two.playerId, two.reconnectToken).playerId).toBe(two.playerId);
  });

  it('restores the same unexpired room after rebuilding the browser engine', () => {
    const engine = new BrowserGameEngine(new FixedRandom(), 60_000);
    const host = engine.createRoom('https://example.test/game');
    const original = engine.snapshot(host.roomCode);
    const restoredEngine = new BrowserGameEngine(new FixedRandom(), 60_000);
    const restored = restoredEngine.reconnectHost(host.roomCode, host.hostToken);
    expect(restored.code).toBe(original.code);
    expect(restored.createdAt).toBe(original.createdAt);
  });
});
