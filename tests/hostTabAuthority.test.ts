import { beforeEach, describe, expect, it } from 'vitest';
import { claimHostAuthority, hasHostAuthority, hostAuthorityKey, releaseHostAuthority } from '../src/lib/hostTabAuthority';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
});

describe('host tab authority', () => {
  it('lets a newly claimed host tab supersede an older owner', () => {
    claimHostAuthority('abcde', 'tab-a', storage);
    expect(hasHostAuthority('ABCDE', 'tab-a', storage)).toBe(true);

    claimHostAuthority('ABCDE', 'tab-b', storage);
    expect(hasHostAuthority('ABCDE', 'tab-a', storage)).toBe(false);
    expect(hasHostAuthority('ABCDE', 'tab-b', storage)).toBe(true);
  });


  it('allows only one active host tab across different rooms in the browser', () => {
    claimHostAuthority('ROOM1', 'tab-a', storage);
    expect(hasHostAuthority('ROOM1', 'tab-a', storage)).toBe(true);

    claimHostAuthority('ROOM2', 'tab-b', storage);
    expect(hasHostAuthority('ROOM1', 'tab-a', storage)).toBe(false);
    expect(hasHostAuthority('ROOM2', 'tab-b', storage)).toBe(true);
    expect(hostAuthorityKey('ROOM1')).toBe(hostAuthorityKey('ROOM2'));
  });

  it('does not let an old owner release the new owner lease', () => {
    claimHostAuthority('ABCDE', 'tab-a', storage);
    claimHostAuthority('ABCDE', 'tab-b', storage);
    releaseHostAuthority('ABCDE', 'tab-a', storage);

    expect(storage.getItem(hostAuthorityKey('ABCDE'))).toBe('tab-b');
    expect(hasHostAuthority('ABCDE', 'tab-b', storage)).toBe(true);
  });

  it('releases only the matching active owner', () => {
    claimHostAuthority('ABCDE', 'tab-a', storage);
    releaseHostAuthority('ABCDE', 'tab-a', storage);
    expect(hasHostAuthority('ABCDE', 'tab-a', storage)).toBe(false);
  });
});
