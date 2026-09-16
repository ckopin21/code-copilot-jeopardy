const PREFIX = 'blue-stage-';

function clearPrefixedStorage(storage: Storage): void {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}

export function menuUrl(extra?: Record<string, string>): string {
  const url = new URL('./', location.href);
  url.search = '';
  url.hash = '';
  for (const [key, value] of Object.entries(extra ?? {})) url.searchParams.set(key, value);
  return url.toString();
}

export async function resetInstance(): Promise<never> {
  clearPrefixedStorage(localStorage);
  clearPrefixedStorage(sessionStorage);

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.toLowerCase().includes('blue-stage')).map((key) => caches.delete(key)));
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const path = new URL('./', location.href).pathname;
    await Promise.all(registrations.filter((registration) => new URL(registration.scope).pathname.startsWith(path)).map((registration) => registration.unregister()));
  }

  const url = new URL(menuUrl());
  url.searchParams.set('instance-reset', String(Date.now()));
  location.replace(url.toString());
  throw new Error('Navigation did not occur');
}
