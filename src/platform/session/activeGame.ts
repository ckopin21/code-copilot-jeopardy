/**
 * Which game this tab is showing, so shared browser storage (saved Host rooms, etc.)
 * is kept separate per game. The app shell sets it before a game renders.
 */
let storageNamespace = 'blue-stage';

export function setActiveGameStorageNamespace(namespace: string): void {
  storageNamespace = namespace;
}

/** Prefix for this game's localStorage/sessionStorage keys, e.g. `blue-stage-host-room`. */
export function activeStorageNamespace(): string {
  return storageNamespace;
}
