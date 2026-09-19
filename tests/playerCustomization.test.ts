import { beforeEach, describe, expect, it } from 'vitest';
import { BrowserGameEngine } from '../src/lib/browserGameEngine';
import { playerJoinSchema } from '../src/shared/validation';
import { AVATAR_CATALOG, AVATAR_CATEGORIES } from '../src/shared/playerCustomization';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const random = { next: () => 0.31 };

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

describe('player customization', () => {
  it('ships a broad, categorized avatar library with unique ids', () => {
    expect(AVATAR_CATALOG).toHaveLength(50);
    expect(new Set(AVATAR_CATALOG.map((avatar) => avatar.id)).size).toBe(50);
    for (const category of AVATAR_CATEGORIES) {
      expect(AVATAR_CATALOG.filter((avatar) => avatar.category === category.id).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('validates catalog customization and rejects unknown avatar ids', () => {
    const valid = {
      roomCode: 'ABCDE',
      name: 'Alex',
      avatar: '🦊',
      avatarId: 'fox',
      accent: '#5eead4',
      frameStyle: 'halo',
      title: 'professor',
      buzzerSound: 'chime',
      scoreEffect: 'spark',
      victoryEffect: 'stars'
    };
    expect(playerJoinSchema.parse(valid)).toMatchObject(valid);
    expect(() => playerJoinSchema.parse({ ...valid, avatarId: 'copyright-hero' })).toThrow(/avatar/i);
  });

  it('persists all customization through disconnect, reconnect, and room recovery', () => {
    const engine = new BrowserGameEngine(random, 60_000);
    const host = engine.createRoom('https://example.test/game');
    const joined = engine.joinPlayer(host.roomCode, {
      name: 'Alex',
      avatar: '🤖',
      avatarId: 'bot-atlas',
      accent: '#93c5fd',
      frameStyle: 'neon',
      title: 'speed-demon',
      buzzerSound: 'arcade',
      scoreEffect: 'wave',
      victoryEffect: 'spotlight'
    });

    engine.setPlayerConnected(host.roomCode, joined.playerId, false);
    engine.reconnectPlayer(host.roomCode, joined.playerId, joined.reconnectToken);

    const player = engine.snapshot(host.roomCode).players[0];
    expect(player).toMatchObject({
      avatar: '🤖',
      avatarId: 'bot-atlas',
      accent: '#93c5fd',
      frameStyle: 'neon',
      title: 'speed-demon',
      buzzerSound: 'arcade',
      scoreEffect: 'wave',
      victoryEffect: 'spotlight',
      connected: true
    });

    const recovered = new BrowserGameEngine(random, 60_000).snapshot(host.roomCode).players[0];
    expect(recovered).toMatchObject({
      avatarId: 'bot-atlas',
      accent: '#93c5fd',
      frameStyle: 'neon',
      title: 'speed-demon',
      buzzerSound: 'arcade',
      scoreEffect: 'wave',
      victoryEffect: 'spotlight'
    });
  });
});
