const HOST_AUTHORITY_KEY = 'blue-stage-host-owner';

const fallbackOwners = new Map<string, string>();

export function hostAuthorityKey(roomCode?: string): string {
  void roomCode;
  return HOST_AUTHORITY_KEY;
}

export function claimHostAuthority(roomCode: string, ownerId: string, storage: Storage = localStorage): void {
  const key = hostAuthorityKey(roomCode);
  fallbackOwners.set(key, ownerId);
  try { storage.setItem(key, ownerId); } catch { /* local fallback keeps this tab functional */ }
}

export function hasHostAuthority(roomCode: string, ownerId: string, storage: Storage = localStorage): boolean {
  const key = hostAuthorityKey(roomCode);
  try { return storage.getItem(key) === ownerId; }
  catch { return fallbackOwners.get(key) === ownerId; }
}

export function releaseHostAuthority(roomCode: string, ownerId: string, storage: Storage = localStorage): void {
  const key = hostAuthorityKey(roomCode);
  if (fallbackOwners.get(key) === ownerId) fallbackOwners.delete(key);
  try {
    if (storage.getItem(key) === ownerId) storage.removeItem(key);
  } catch { /* storage may be unavailable during teardown */ }
}
