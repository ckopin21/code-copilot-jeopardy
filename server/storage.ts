import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** A synchronous, atomic backing store for the engine's existing Storage contract. */
export function createFileRoomStorage(filePath: string): Storage {
  let values: Record<string, string> = {};
  if (existsSync(filePath)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        values = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
      }
    } catch {
      // The engine will start with an empty store. A later write is atomic.
    }
  }

  const flush = () => {
    mkdirSync(dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify(values), { encoding: 'utf8', mode: 0o600 });
      renameSync(temporary, filePath);
    } catch (error) {
      try { unlinkSync(temporary); } catch { /* no temporary file */ }
      throw error;
    }
  };

  return {
    get length() { return Object.keys(values).length; },
    key(index: number) { return Object.keys(values)[index] ?? null; },
    getItem(key: string) { return values[String(key)] ?? null; },
    setItem(key: string, value: string) { values[String(key)] = String(value); flush(); },
    removeItem(key: string) { delete values[String(key)]; flush(); },
    clear() { values = {}; flush(); }
  } as Storage;
}
