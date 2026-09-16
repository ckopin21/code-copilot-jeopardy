import { emitAck, resumeClientSession } from './socket';
import { readActiveHostCredentials } from './hostCredentials';
// Load sound captions once for host, player, and presentation modes so accessibility behavior stays consistent.
import './soundCaptions';

const HOST_KEEPALIVE_MS = 5 * 60 * 1000;

// Keep a room alive while its owning host tab is open. Credentials are session-scoped first,
// so another tab starting a different game cannot redirect this tab's keepalive.
window.setInterval(() => {
  if (new URLSearchParams(location.search).get('mode') !== 'host') return;
  const credentials = readActiveHostCredentials();
  if (!credentials) return;
  void emitAck('host:reconnect', {
    roomCode: credentials.roomCode,
    hostToken: credentials.hostToken
  }).catch(() => {
    // Host recovery owns user-facing error reporting. Keepalive never deletes saved credentials.
  });
}, HOST_KEEPALIVE_MS);

// A phone page restored from the browser back/forward cache keeps its React tree,
// but pagehide deliberately suspended its WebRTC session. Resume the transport so
// the existing heartbeat/reconnect loop can reclaim the saved seat.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  const mode = new URLSearchParams(location.search).get('mode');
  if (mode === 'player' || mode === 'presentation') resumeClientSession();
});
