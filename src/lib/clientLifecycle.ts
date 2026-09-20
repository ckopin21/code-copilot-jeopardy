import { emitAck, resumeClientSession, suspendClientSession } from './socket';
import { readActiveHostCredentials } from './hostCredentials';
import { shouldForceClientTransportReset } from './clientRecoveryPolicy';
// Load sound captions once for host, player, and presentation modes so accessibility behavior stays consistent.
import './soundCaptions';

const HOST_KEEPALIVE_MS = 5 * 60 * 1000;
let hiddenAt = 0;

function currentMode(): string | null {
  return new URLSearchParams(location.search).get('mode');
}

function clientMode(): boolean {
  const mode = currentMode();
  return mode === 'player' || mode === 'presentation';
}

// Keep a room alive while its owning host tab is open. Credentials are session-scoped first,
// so another tab starting a different game cannot redirect this tab's keepalive.
window.setInterval(() => {
  if (currentMode() !== 'host') return;
  const credentials = readActiveHostCredentials();
  if (!credentials) return;
  void emitAck('host:reconnect', {
    roomCode: credentials.roomCode,
    hostToken: credentials.hostToken
  }).catch(() => {
    // Host recovery owns user-facing error reporting. Keepalive never deletes saved credentials.
  });
}, HOST_KEEPALIVE_MS);

// WebKit can preserve the JavaScript objects for a page while suspending the network path.
// Treat page-cache restores, meaningful background resumes, and a returning network as reasons
// to rebuild the client Peer/DataConnection instead of trusting stale "open" flags.
window.addEventListener('pagehide', () => {
  if (!clientMode()) return;
  suspendClientSession();
});

window.addEventListener('pageshow', (event) => {
  if (!clientMode()) return;
  hiddenAt = 0;
  resumeClientSession(false, shouldForceClientTransportReset('pageshow', { persisted: event.persisted }));
});

document.addEventListener('visibilitychange', () => {
  if (!clientMode()) return;
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
    return;
  }

  const hiddenForMs = hiddenAt ? Date.now() - hiddenAt : 0;
  hiddenAt = 0;
  resumeClientSession(false, shouldForceClientTransportReset('visibility', { hiddenForMs }));
});

window.addEventListener('online', () => {
  if (!clientMode()) return;
  resumeClientSession(false, shouldForceClientTransportReset('online'));
});
