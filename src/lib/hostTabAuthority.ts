const HOST_AUTHORITY_KEY_PREFIX = 'blue-stage-host-owner';

const fallbackOwners = new Map<string, string>();

export function hostAuthorityKey(roomCode?: string): string {
  const normalized = roomCode?.trim().toUpperCase();
  if (!normalized) throw new Error('A room code is required for host authority');
  return `${HOST_AUTHORITY_KEY_PREFIX}:${normalized}`;
}

export function readHostAuthorityOwner(roomCode: string, storage: Storage = localStorage): string | null {
  const key = hostAuthorityKey(roomCode);
  try { return storage.getItem(key); }
  catch { return fallbackOwners.get(key) ?? null; }
}

export function canClaimHostAuthority(
  roomCode: string,
  ownerId: string,
  allowTakeover: boolean,
  storage: Storage = localStorage
): boolean {
  const activeOwner = readHostAuthorityOwner(roomCode, storage);
  return allowTakeover || activeOwner === null || activeOwner === ownerId;
}

export function claimHostAuthority(roomCode: string, ownerId: string, storage: Storage = localStorage): void {
  const key = hostAuthorityKey(roomCode);
  fallbackOwners.set(key, ownerId);
  try { storage.setItem(key, ownerId); } catch { /* local fallback keeps this tab functional */ }
}

export function hasHostAuthority(roomCode: string, ownerId: string, storage: Storage = localStorage): boolean {
  return readHostAuthorityOwner(roomCode, storage) === ownerId;
}

export function releaseHostAuthority(roomCode: string, ownerId: string, storage: Storage = localStorage): void {
  const key = hostAuthorityKey(roomCode);
  if (fallbackOwners.get(key) === ownerId) fallbackOwners.delete(key);
  try {
    if (storage.getItem(key) === ownerId) storage.removeItem(key);
  } catch { /* storage may be unavailable during teardown */ }
}
