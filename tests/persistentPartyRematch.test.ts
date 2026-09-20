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
  next(): number {
    this.value = (this.value * 5.31 + 0.17) % 1;
    return this.value;
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

describe('persistent party rematch lifecycle', () => {
  it('resets game state without replacing connected player identity or profile', () => {
    const engine = new BrowserGameEngine(new FixedRandom(), 60_000);
    const host = engine.createRoom('https://example.test/game');
    const joined = engine.joinPlayer(host.roomCode, {
      name: 'Caleb',
      avatar: '🚀',
      accent: '#93c5fd'
    });

    engine.startGame(host.roomCode, host.hostToken);
    engine.adjustScore(host.roomCode, host.hostToken, joined.playerId, 900);

    const before = engine.snapshot(host.roomCode).players[0];
    expect(before.score).toBe(900);
    expect(before.connected).toBe(true);

    engine.resetGame(host.roomCode, host.hostToken);

    const reset = engine.snapshot(host.roomCode);
    const after = reset.players[0];
    expect(reset.phase).toBe('lobby');
    expect(after.id).toBe(before.id);
    expect(after.seat).toBe(before.seat);
    expect(after.name).toBe(before.name);
    expect(after.avatar).toBe(before.avatar);
    expect(after.accent).toBe(before.accent);
    expect(after.connected).toBe(true);
    expect(after.score).toBe(0);

    expect(engine.reconnectPlayer(host.roomCode, joined.playerId, joined.reconnectToken).playerId).toBe(joined.playerId);
  });
});
