const PRIMARY_KEY = 'blue-stage-p2p-engine-v2';
const BACKUP_KEY = 'blue-stage-p2p-engine-v2-backup';

type StoredRoom = {
  state?: {
    code?: string;
    createdAt?: number;
    expiresAt?: number;
  };
  [key: string]: unknown;
};

function parseRooms(raw: string | null): StoredRoom[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is StoredRoom => Boolean(item && typeof item === 'object')) : [];
  } catch {
    return [];
  }
}

function roomFreshness(room: StoredRoom): number {
  const expiresAt = Number(room.state?.expiresAt ?? 0);
  const createdAt = Number(room.state?.createdAt ?? 0);
  return Math.max(expiresAt, createdAt);
}

/**
 * Merge the primary and recovery room snapshots instead of trusting whichever
 * file happens to be syntactically valid. A stale browser tab can write an
 * older primary snapshot while the previous, newer state is still preserved
 * in the backup. Keeping the freshest record for each room prevents a valid
 * saved room from disappearing on the next reload.
 */
export function mergeStoredRooms(primary: StoredRoom[], backup: StoredRoom[], now = Date.now()): StoredRoom[] {
  const byCode = new Map<string, StoredRoom>();
  for (const room of [...backup, ...primary]) {
    const code = room.state?.code?.trim().toUpperCase();
    const expiresAt = Number(room.state?.expiresAt ?? 0);
    if (!code || !Number.isFinite(expiresAt) || expiresAt <= now) continue;
    const existing = byCode.get(code);
    if (!existing || roomFreshness(room) >= roomFreshness(existing)) byCode.set(code, room);
  }
  return [...byCode.values()].sort((a, b) => String(a.state?.code ?? '').localeCompare(String(b.state?.code ?? '')));
}

export function recoverRoomStorage(storage: Storage = localStorage): StoredRoom[] {
  const primary = parseRooms(storage.getItem(PRIMARY_KEY));
  const backup = parseRooms(storage.getItem(BACKUP_KEY));
  const merged = mergeStoredRooms(primary, backup);
  const serialized = JSON.stringify(merged);
  if (storage.getItem(PRIMARY_KEY) !== serialized) storage.setItem(PRIMARY_KEY, serialized);
  return merged;
}

if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  recoverRoomStorage();
  let scheduled = false;
  window.addEventListener('storage', (event) => {
    if (event.storageArea !== localStorage || (event.key !== PRIMARY_KEY && event.key !== BACKUP_KEY) || scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      recoverRoomStorage();
    });
  });
}
