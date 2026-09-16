import type { HostRoomCredentials, RoomSnapshot } from '../shared/types';
import { emitAck, resumeClientSession, socket } from './socket';

const HOST_KEY = 'blue-stage-host-room';
let hostRoom: RoomSnapshot | null = null;
let lastGamepadPressed: boolean[] = [];

function mode(): string | null { return new URLSearchParams(location.search).get('mode'); }
function hostCredentials(): HostRoomCredentials | null {
  try {
    const raw = localStorage.getItem(HOST_KEY);
    return raw ? JSON.parse(raw) as HostRoomCredentials : null;
  } catch { return null; }
}

// A phone page restored from the browser back/forward cache keeps its React tree,
// but pagehide deliberately suspended its WebRTC session. Resume the transport so
// the existing heartbeat/reconnect loop can reclaim the saved seat.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  if (mode() === 'player') resumeClientSession();
});

// Track the host room independently of the React host UI. This lets local input
// assignments stay tied to P1-P5 even when some reserved seats are disconnected.
socket.on('room:state', (snapshot: RoomSnapshot) => {
  if (mode() === 'host') hostRoom = snapshot;
});

function canLocalBuzz(room: RoomSnapshot | null): room is RoomSnapshot {
  return Boolean(
    room &&
    room.phase === 'question' &&
    room.currentQuestion &&
    room.currentQuestion.responseMode !== 'text' &&
    !room.currentQuestion.dailyDouble &&
    room.currentQuestion.buzzOpen &&
    !room.currentQuestion.buzzWinnerId
  );
}

async function buzzSeat(seat: number): Promise<void> {
  if (!canLocalBuzz(hostRoom)) return;
  const player = hostRoom.players.find((candidate) => candidate.seat === seat && candidate.connected && candidate.buzzEligible);
  const credentials = hostCredentials();
  if (!player || !credentials || credentials.roomCode !== hostRoom.code) return;
  try {
    await emitAck('host:local-buzz', { roomCode: credentials.roomCode, hostToken: credentials.hostToken, playerId: player.id });
  } catch { /* another input may have won the same buzzer race */ }
}

// Capture before HostApp's legacy window-level handler so a missing P2 never makes
// the "2" key control P3. Number keys now always mean the matching permanent seat.
document.addEventListener('keydown', (event) => {
  if (mode() !== 'host' || !hostRoom?.settings.localBuzzersEnabled || event.repeat) return;
  const seat = Number(event.key);
  if (!Number.isInteger(seat) || seat < 1 || seat > 5) return;
  if (!canLocalBuzz(hostRoom)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  void buzzSeat(seat);
}, { capture: true });

// HostApp historically paired gamepads with the filtered connected-player array.
// Own gamepad polling here and hide the raw list from that legacy poller on host
// pages, so gamepad index 0..4 always maps to permanent seat P1..P5.
const nativeGetGamepads = navigator.getGamepads?.bind(navigator);
if (nativeGetGamepads) {
  try {
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => mode() === 'host' ? [] : nativeGetGamepads()
    });
  } catch { /* Some browsers expose a non-configurable method; stable keyboard mapping still applies. */ }

  window.setInterval(() => {
    if (mode() !== 'host' || !hostRoom?.settings.controllerBuzzersEnabled || !canLocalBuzz(hostRoom)) {
      lastGamepadPressed = [];
      return;
    }
    const pads = Array.from(nativeGetGamepads() ?? []);
    pads.forEach((pad, index) => {
      const pressed = Boolean(pad?.buttons.some((button) => button.pressed));
      if (pressed && !lastGamepadPressed[index]) void buzzSeat(index + 1);
      lastGamepadPressed[index] = pressed;
    });
  }, 20);
}
