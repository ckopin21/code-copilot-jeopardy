import { resumeClientSession } from './socket';
import './soundCaptions';

// A phone page restored from the browser back/forward cache keeps its React tree,
// but pagehide deliberately suspended its WebRTC session. Resume the transport so
// the existing heartbeat/reconnect loop can reclaim the saved seat.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  const mode = new URLSearchParams(location.search).get('mode');
  if (mode === 'player') resumeClientSession();
});
