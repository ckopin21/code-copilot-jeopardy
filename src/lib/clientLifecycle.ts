import type { HostRoomCredentials } from '../shared/types';
import { emitAck, resumeClientSession } from './socket';
import { isFreshHostUrl, stripFreshHostFlag } from './hostSession';
// Load sound captions once for host, player, and presentation modes so accessibility behavior stays consistent.
import './soundCaptions';

const HOST_KEY = 'blue-stage-host-room';
const HOST_KEEPALIVE_MS = 5 * 60 * 1000;

function readHostCredentials(): HostRoomCredentials | null {
  try {
    const raw = localStorage.getItem(HOST_KEY);
    return raw ? JSON.parse(raw) as HostRoomCredentials : null;
  } catch {
    return null;
  }
}

// `fresh=1` is a one-shot instruction. If it remains in the URL, refreshing the
// host page creates a different room and makes every existing phone look expired.
// Wait until HostApp has replaced the saved credentials before removing the flag.
if (isFreshHostUrl(location.href)) {
  const initialCredentials = localStorage.getItem(HOST_KEY);
  let checks = 0;
  const consumeTimer = window.setInterval(() => {
    checks += 1;
    const currentCredentials = localStorage.getItem(HOST_KEY);
    const freshRoomCreated = currentCredentials !== null && currentCredentials !== initialCredentials;
    if (freshRoomCreated) {
      window.clearInterval(consumeTimer);
      history.replaceState(null, '', stripFreshHostFlag(location.href));
      return;
    }
    if (checks >= 100) window.clearInterval(consumeTimer);
  }, 100);
}

// Keep a room alive while its host display is open. BrowserGameEngine otherwise
// expires rooms after its inactivity TTL, even if the host tab has remained open.
window.setInterval(() => {
  if (new URLSearchParams(location.search).get('mode') !== 'host') return;
  const credentials = readHostCredentials();
  if (!credentials) return;
  void emitAck('host:reconnect', {
    roomCode: credentials.roomCode,
    hostToken: credentials.hostToken
  }).catch(() => {
    // Normal host recovery owns user-facing error reporting. This is best-effort.
  });
}, HOST_KEEPALIVE_MS);

// A phone page restored from the browser back/forward cache keeps its React tree,
// but pagehide deliberately suspended its WebRTC session. Resume the transport so
// the existing heartbeat/reconnect loop can reclaim the saved seat.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  const mode = new URLSearchParams(location.search).get('mode');
  if (mode === 'player') resumeClientSession();
});
