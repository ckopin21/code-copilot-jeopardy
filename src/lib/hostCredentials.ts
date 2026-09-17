import type { HostRoomCredentials } from '../shared/types';

export const HOST_STORAGE_KEY = 'blue-stage-host-room';
const HOST_TAB_KEY = 'blue-stage-host-room-tab';

function parse(raw: string | null): HostRoomCredentials | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<HostRoomCredentials>;
    return typeof value.roomCode === 'string' && typeof value.hostToken === 'string' && typeof value.joinUrl === 'string' && typeof value.presentationUrl === 'string'
      ? value as HostRoomCredentials
      : null;
  } catch {
    return null;
  }
}

export function readSavedHostCredentials(): HostRoomCredentials | null {
  return parse(localStorage.getItem(HOST_STORAGE_KEY));
}

export function readTabHostCredentials(): HostRoomCredentials | null {
  return parse(sessionStorage.getItem(HOST_TAB_KEY));
}

export function readActiveHostCredentials(): HostRoomCredentials | null {
  return readTabHostCredentials() ?? readSavedHostCredentials();
}

export function writeHostCredentials(credentials: HostRoomCredentials): void {
  const serialized = JSON.stringify(credentials);
  localStorage.setItem(HOST_STORAGE_KEY, serialized);
  sessionStorage.setItem(HOST_TAB_KEY, serialized);
}

export function clearHostCredentials(credentials?: HostRoomCredentials | null): void {
  const active = readTabHostCredentials();
  if (!credentials || active?.roomCode === credentials.roomCode) sessionStorage.removeItem(HOST_TAB_KEY);
  const saved = readSavedHostCredentials();
  if (!credentials || saved?.roomCode === credentials.roomCode) localStorage.removeItem(HOST_STORAGE_KEY);
}
