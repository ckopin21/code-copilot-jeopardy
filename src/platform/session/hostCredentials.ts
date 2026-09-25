import type { HostRoomCredentials } from '../rooms/types';
import { activeStorageNamespace } from './activeGame';

// Saved per game: `<namespace>-host-room` survives the browser; the `-tab` copy pins this tab to its room.
const savedKey = () => `${activeStorageNamespace()}-host-room`;
const tabKey = () => `${activeStorageNamespace()}-host-room-tab`;

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
  return parse(localStorage.getItem(savedKey()));
}

export function readTabHostCredentials(): HostRoomCredentials | null {
  return parse(sessionStorage.getItem(tabKey()));
}

export function readActiveHostCredentials(): HostRoomCredentials | null {
  return readTabHostCredentials() ?? readSavedHostCredentials();
}

/** Fired on `window` whenever this tab writes or clears Host credentials. */
export const HOST_CREDENTIALS_EVENT = 'blue-stage:host-credentials';

function announceChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(HOST_CREDENTIALS_EVENT));
}

export function writeHostCredentials(credentials: HostRoomCredentials): void {
  const serialized = JSON.stringify(credentials);
  localStorage.setItem(savedKey(), serialized);
  sessionStorage.setItem(tabKey(), serialized);
  announceChange();
}

export function clearHostCredentials(credentials?: HostRoomCredentials | null): void {
  const active = readTabHostCredentials();
  if (!credentials || active?.roomCode === credentials.roomCode) sessionStorage.removeItem(tabKey());
  const saved = readSavedHostCredentials();
  if (!credentials || saved?.roomCode === credentials.roomCode) localStorage.removeItem(savedKey());
  announceChange();
}
