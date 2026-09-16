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
