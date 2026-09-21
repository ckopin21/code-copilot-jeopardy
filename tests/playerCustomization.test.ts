import { beforeEach, describe, expect, it } from 'vitest';
import { BrowserGameEngine } from '../src/lib/browserGameEngine';
import { playerJoinSchema } from '../src/shared/validation';
import {
  AVATAR_CATALOG,
  AVATAR_CATEGORIES,
  SCORE_EFFECTS,
  normalizePlayerCustomization
} from '../src/shared/playerCustomization';

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
const STORAGE_KEY = 'blue-stage-p2p-engine-v2';

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

  it('validates current customization and silently ignores a legacy title payload', () => {
    const valid = {
      roomCode: 'ABCDE',
      name: 'Alex',
      avatar: '🦊',
      avatarId: 'fox',
      accent: '#5eead4',
      frameStyle: 'halo',
      buzzerSound: 'chime',
      scoreEffect: 'spark',
      victoryEffect: 'stars'
    };
    expect(playerJoinSchema.parse(valid)).toMatchObject(valid);
    expect(playerJoinSchema.parse({ ...valid, title: 'professor' })).not.toHaveProperty('title');
    expect(() => playerJoinSchema.parse({ ...valid, avatarId: 'copyright-hero' })).toThrow(/avatar/i);
  });

  it('normalizes legacy customization without carrying a title forward', () => {
    const normalized = normalizePlayerCustomization({
      avatarId: 'bot-atlas',
      frameStyle: 'neon',
      buzzerSound: 'arcade',
      scoreEffect: 'wave',
      victoryEffect: 'spotlight',
      title: 'speed-demon'
    } as Parameters<typeof normalizePlayerCustomization>[0] & { title: string });

    expect(normalized).toMatchObject({
      avatarId: 'bot-atlas',
      frameStyle: 'neon',
      buzzerSound: 'arcade',
      scoreEffect: 'wave',
      victoryEffect: 'spotlight'
    });
    expect(normalized).not.toHaveProperty('title');
  });

  it('persists customization through disconnect, reconnect, and room recovery', () => {
    const engine = new BrowserGameEngine(random, 60_000);
    const host = engine.createRoom('https://example.test/game');
    const joined = engine.joinPlayer(host.roomCode, {
      name: 'Alex',
      avatar: '🤖',
      avatarId: 'bot-atlas',
      accent: '#93c5fd',
      frameStyle: 'neon',
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
      buzzerSound: 'arcade',
      scoreEffect: 'wave',
      victoryEffect: 'spotlight',
      connected: true
    });
    expect(player).not.toHaveProperty('title');

    const recovered = new BrowserGameEngine(random, 60_000).snapshot(host.roomCode).players[0];
    expect(recovered).toMatchObject({
      avatarId: 'bot-atlas',
      accent: '#93c5fd',
      frameStyle: 'neon',
      buzzerSound: 'arcade',
      scoreEffect: 'wave',
      victoryEffect: 'spotlight'
    });
    expect(recovered).not.toHaveProperty('title');
  });

  it('migrates an old saved player title without breaking room recovery', () => {
    const engine = new BrowserGameEngine(random, 60_000);
    const host = engine.createRoom('https://example.test/game');
    engine.joinPlayer(host.roomCode, {
      name: 'Legacy Alex',
      avatar: '🦊',
      avatarId: 'fox',
      accent: '#ffd166',
      frameStyle: 'halo',
      buzzerSound: 'classic',
      scoreEffect: 'spark',
      victoryEffect: 'confetti'
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { rooms: Array<{ state: { players: Array<Record<string, unknown>> } }> };
    stored.rooms[0].state.players[0].title = 'professor';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const restored = new BrowserGameEngine(random, 60_000);
    const player = restored.snapshot(host.roomCode).players[0];
    expect(player.name).toBe('Legacy Alex');
    expect(player.scoreEffect).toBe('spark');
    expect(player).not.toHaveProperty('title');

    const migrated = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { rooms: Array<{ state: { players: Array<Record<string, unknown>> } }> };
    expect(migrated.rooms[0].state.players[0]).not.toHaveProperty('title');
  });

  it.each(SCORE_EFFECTS.map((effect) => effect.id))('persists the %s score effect', (scoreEffect) => {
    const engine = new BrowserGameEngine(random, 60_000);
    const host = engine.createRoom('https://example.test/game');
    engine.joinPlayer(host.roomCode, {
      name: 'Effect Test',
      avatar: '🦊',
      avatarId: 'fox',
      accent: '#5eead4',
      frameStyle: 'clean',
      buzzerSound: 'classic',
      scoreEffect,
      victoryEffect: 'confetti'
    });

    expect(engine.snapshot(host.roomCode).players[0].scoreEffect).toBe(scoreEffect);
    expect(new BrowserGameEngine(random, 60_000).snapshot(host.roomCode).players[0].scoreEffect).toBe(scoreEffect);
  });
});
