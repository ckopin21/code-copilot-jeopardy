import { describe, expect, it } from 'vitest';
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

const room = (code: string, expiresAt: number, marker: string) => ({ state: { code, createdAt: 100, expiresAt }, marker });

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
    storage.setItem('blue-stage-p2p-engine-v2', JSON.stringify([room('OLD11', expiresAt, 'old')]));
    storage.setItem('blue-stage-p2p-engine-v2-backup', JSON.stringify([room('ROOM1', expiresAt + 1_000, 'saved-room')]));

    const recovered = recoverRoomStorage(storage);
    expect(recovered.some((item) => item.state?.code === 'ROOM1')).toBe(true);
    expect(JSON.parse(storage.getItem('blue-stage-p2p-engine-v2') ?? '[]')).toHaveLength(2);
  });
});
