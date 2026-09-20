import { beforeAll, describe, expect, it } from 'vitest';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

beforeAll(() => {
  const browser = globalThis as typeof globalThis & { window: Window; document: Document; location: Location; history: History };
  const url = new URL('https://example.test/?mode=player');
  const timers = new Set<ReturnType<typeof setInterval>>();
  browser.location = url as unknown as Location;
  browser.history = { replaceState() {} } as unknown as History;
  browser.document = { visibilityState: 'visible', addEventListener() {} } as unknown as Document;
  browser.window = {
    ...globalThis,
    location: browser.location,
    history: browser.history,
    fetch: globalThis.fetch,
    addEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval(callback: TimerHandler, delay?: number) {
      const timer = setInterval(callback, delay);
      timers.add(timer);
      return timer as unknown as number;
    },
    clearInterval(timer: number) { clearInterval(timer); }
  } as unknown as Window;
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

describe('production socket runtime isolation', () => {
  it('keeps public connection state and local subscriptions instance-owned', async () => {
    const { createSocketRuntime } = await import('../src/lib/socket');
    const one = createSocketRuntime({ installBrowserHooks: false });
    const two = createSocketRuntime({ installBrowserHooks: false });
    let oneDisconnects = 0;
    let twoDisconnects = 0;
    one.socket.on('disconnect', () => { oneDisconnects += 1; });
    two.socket.on('disconnect', () => { twoDisconnects += 1; });

    one.socket.connected = true;
    one.suspendClientSession();

    expect(one.socket.connected).toBe(false);
    expect(two.socket.connected).toBe(false);
    expect(oneDisconnects).toBe(1);
    expect(twoDisconnects).toBe(0);
    one.destroy();
    two.destroy();
  });
});
