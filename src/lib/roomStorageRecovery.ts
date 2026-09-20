const PRIMARY_KEY = 'blue-stage-p2p-engine-v2';
const BACKUP_KEY = 'blue-stage-p2p-engine-v2-backup';

type StoredRoom = {
  state?: {
    code?: string;
    createdAt?: number;
    expiresAt?: number;
    revision?: number;
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

/** Reject records that could win freshness selection but cannot restore a room. */
export function isRecoverableStoredRoom(room: StoredRoom): boolean {
  const state = room.state;
  return Boolean(
    state &&
    typeof state.code === 'string' && state.code.trim() &&
    Number.isFinite(Number(state.createdAt)) &&
    Number.isFinite(Number(state.expiresAt)) &&
    typeof room.hostToken === 'string' && room.hostToken &&
    room.playerTokens && typeof room.playerTokens === 'object' &&
    room.questions && typeof room.questions === 'object'
  );
}

function roomFreshness(room: StoredRoom): [number, number] {
  const revision = Number(room.state?.revision ?? 0);
  const expiresAt = Number(room.state?.expiresAt ?? 0);
  const createdAt = Number(room.state?.createdAt ?? 0);
  return [Number.isFinite(revision) ? revision : 0, Math.max(expiresAt, createdAt)];
}
function newerThan(candidate: StoredRoom, existing: StoredRoom): boolean {
  const [candidateRevision, candidateTime] = roomFreshness(candidate);
  const [existingRevision, existingTime] = roomFreshness(existing);
  return candidateRevision !== existingRevision ? candidateRevision > existingRevision : candidateTime > existingTime;
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
    if (!existing || newerThan(room, existing)) byCode.set(code, room);
  }
  return [...byCode.values()].sort((a, b) => String(a.state?.code ?? '').localeCompare(String(b.state?.code ?? '')));
}

function safeGetItem(storage: Storage, key: string): string | null {
  try { return storage.getItem(key); }
  catch { return null; }
}

function safeSetItem(storage: Storage, key: string, value: string): void {
  try { storage.setItem(key, value); }
  catch { /* recovery must never make the app fail to start */ }
}

export function recoverRoomStorage(storage: Storage = localStorage): StoredRoom[] {
  const primaryRaw = safeGetItem(storage, PRIMARY_KEY);
  const backupRaw = safeGetItem(storage, BACKUP_KEY);
  const primary = parseRooms(primaryRaw).filter(isRecoverableStoredRoom);
  const backup = parseRooms(backupRaw).filter(isRecoverableStoredRoom);
  const merged = mergeStoredRooms(primary, backup);
  const serialized = JSON.stringify(merged);
  if (primaryRaw !== serialized) safeSetItem(storage, PRIMARY_KEY, serialized);
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
