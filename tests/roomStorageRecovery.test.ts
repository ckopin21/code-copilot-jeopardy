import { beforeEach, describe, expect, it } from 'vitest';
import { BrowserGameEngine, type RandomSource } from '../src/lib/browserGameEngine';
import { mergeStoredRooms, recoverRoomStorage } from '../src/lib/roomStorageRecovery';

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
  private value = 0.419;
  next(): number { this.value = (this.value * 6.17 + 0.11) % 1; return this.value; }
}

const room = (code: string, expiresAt: number, marker: string) => ({ state: { code, createdAt: 100, expiresAt }, marker });
const PRIMARY_KEY = 'blue-stage-p2p-engine-v2';
const BACKUP_KEY = 'blue-stage-p2p-engine-v2-backup';

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

describe('room storage recovery', () => {
  it('keeps the freshest version of each live room across primary and backup', () => {
    const now = 1_000;
    const merged = mergeStoredRooms(
      [room('AAAAA', 2_000, 'stale-primary'), room('BBBBB', 3_000, 'primary-only')],
      [room('AAAAA', 4_000, 'fresh-backup'), room('CCCCC', 5_000, 'backup-only')],
      now
    );
    expect(merged.map((item) => item.state?.code)).toEqual(['AAAAA', 'BBBBB', 'CCCCC']);
    expect(merged.find((item) => item.state?.code === 'AAAAA')?.marker).toBe('fresh-backup');
  });

  it('drops expired records while recovering', () => {
    const merged = mergeStoredRooms([room('OLD11', 900, 'expired')], [room('LIVE1', 2_000, 'live')], 1_000);
    expect(merged.map((item) => item.state?.code)).toEqual(['LIVE1']);
  });

  it('repairs a valid but incomplete primary snapshot from backup', () => {
    const storage = new MemoryStorage();
    const expiresAt = Date.now() + 60_000;
    storage.setItem(PRIMARY_KEY, JSON.stringify([room('OLD11', expiresAt, 'old')]));
    storage.setItem(BACKUP_KEY, JSON.stringify([room('ROOM1', expiresAt + 1_000, 'saved-room')]));

    const recovered = recoverRoomStorage(storage);
    expect(recovered.some((item) => item.state?.code === 'ROOM1')).toBe(true);
    expect(JSON.parse(storage.getItem(PRIMARY_KEY) ?? '[]')).toHaveLength(2);
  });

  it('recovers a real active room and preserves host and player reconnect credentials', () => {
    const engine = new BrowserGameEngine(new FixedRandom(), 60_000);
    const host = engine.createRoom('https://example.test/game', {
      selectedPackIds: ['sports-games'],
      gameLength: 'quick',
      dailyDoublesEnabled: false,
      finalRoundEnabled: false
    });
    const player = engine.joinPlayer(host.roomCode, { name: 'Recovery', avatar: '🚀', accent: '#93c5fd' });
    engine.startGame(host.roomCode, host.hostToken);
    const before = engine.snapshot(host.roomCode);
    const activeSnapshot = localStorage.getItem(PRIMARY_KEY);
    expect(activeSnapshot).toBeTruthy();

    localStorage.setItem(BACKUP_KEY, activeSnapshot!);
    localStorage.setItem(PRIMARY_KEY, '[]');
    recoverRoomStorage(localStorage);

    const restoredEngine = new BrowserGameEngine(new FixedRandom(), 60_000);
    const restoredHost = restoredEngine.reconnectHost(host.roomCode, host.hostToken);
    const restoredPlayer = restoredEngine.reconnectPlayer(host.roomCode, player.playerId, player.reconnectToken);
    const after = restoredEngine.snapshot(host.roomCode);

    expect(restoredHost.code).toBe(host.roomCode);
    expect(restoredPlayer.playerId).toBe(player.playerId);
    expect(after.phase).toBe(before.phase);
    expect(after.board?.questions.map((item) => item.questionId)).toEqual(before.board?.questions.map((item) => item.questionId));
    expect(after.players[0].id).toBe(player.playerId);
    expect(after.players[0].seat).toBe(before.players[0].seat);
    expect(after.players[0].connected).toBe(true);
  });

  it('prefers the higher state revision when timestamps tie', () => {
    const now = 1_000;
    const primary = { state: { code: 'TIE11', createdAt: 100, expiresAt: 5_000, revision: 3 }, marker: 'stale-primary' };
    const backup = { state: { code: 'TIE11', createdAt: 100, expiresAt: 5_000, revision: 8 }, marker: 'newer-backup' };
    const merged = mergeStoredRooms([primary], [backup], now);
    expect(merged.find((item) => item.state?.code === 'TIE11')?.marker).toBe('newer-backup');
  });

});
