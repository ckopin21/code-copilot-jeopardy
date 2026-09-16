from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:160]!r}")
    file.write_text(text.replace(old, new, 1))


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


write("src/lib/ids.ts", """export function randomId(prefix = 'id'): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return `${prefix}_${cryptoApi.randomUUID()}`;
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${prefix}_${value}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}
""")

write("src/lib/hostCredentials.ts", """import type { HostRoomCredentials } from '../shared/types';

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
""")

# Browser engine: LAN-safe ids and disconnect/final recovery behavior.
replace_once(
    "src/lib/browserGameEngine.ts",
    "import { calculateComebackAward } from './comebackScoring';",
    "import { calculateComebackAward } from './comebackScoring';\nimport { randomId } from './ids';",
)
replace_once(
    "src/lib/browserGameEngine.ts",
    "function id(prefix: string): string { return `${prefix}_${crypto.randomUUID()}`; }",
    "function id(prefix: string): string { return randomId(prefix); }",
)
replace_once(
    "src/lib/browserGameEngine.ts",
    """    if (!connected) {
      player.buzzEligible = false;
      const current = room.state.currentQuestion;
      if (room.state.phase === 'question' && current?.responseMode === 'text' && !current.answerRevealed) {
        const active = this.currentQuestionParticipants(room);
        if (active.length === 0 || active.every((candidate) => Boolean(current.textResponses?.[candidate.id]))) this.closeTextResponsesInternal(room);
      }
      if (room.state.phase === 'final-question' && room.state.finalRound && !room.state.finalRound.responsesClosed) {
        const active = this.activeFinalParticipants(room);
        if (active.length === 0 || active.every((candidate) => candidate.finalAnswerSubmitted)) this.closeFinalResponsesInternal(room);
      }
    } else {""",
    """    if (!connected) {
      // A transient disconnect must not permanently close a typed/Final response window.
      // Timers or the host still close those phases; reconnecting players can continue if time remains.
      player.buzzEligible = false;
    } else {""",
)
replace_once(
    "src/lib/browserGameEngine.ts",
    """      if (room.state.settings.finalRoundEnabled && this.connectedPlayers(room).length > 0) this.prepareFinalRound(room);
      else this.finishGame(room);""",
    """      if (room.state.settings.finalRoundEnabled && room.state.players.length > 0) this.prepareFinalRound(room);
      else this.finishGame(room);""",
)
replace_once(
    "src/lib/browserGameEngine.ts",
    """  private prepareFinalRound(room: RoomRecord): void {
    const participantIds = this.connectedPlayers(room).map((player) => player.id);
    if (!participantIds.length) { this.finishGame(room); return; }""",
    """  private prepareFinalRound(room: RoomRecord): void {
    // Freeze every reserved seat that was part of the game, not only the exact millisecond's
    // connected set. Brief Wi-Fi drops at the last clue must not silently remove Final.
    const participantIds = [...room.state.players].sort((a, b) => a.seat - b.seat).map((player) => player.id);
    if (!participantIds.length) { this.finishGame(room); return; }""",
)

# Host credentials are tab-scoped for authority, while localStorage remains the resumable saved game.
replace_once(
    "src/components/HostAppV3.tsx",
    "import { ScoreFlight, type ScoreFlightState } from './ScoreFlight';\n\nconst HOST_KEY = 'blue-stage-host-room';",
    "import { ScoreFlight, type ScoreFlightState } from './ScoreFlight';\nimport { clearHostCredentials, readActiveHostCredentials, writeHostCredentials } from '../lib/hostCredentials';\nimport { stripFreshHostFlag } from '../lib/hostSession';",
)
replace_once(
    "src/components/HostAppV3.tsx",
    """      const createFreshRoom = async () => {
        const network = await fetch('/api/network').then((response) => response.json()) as { baseUrl: string };
        const created = await emitAck<HostRoomCredentials>('room:create', { settings: DEFAULT_SETTINGS, baseUrl: network.baseUrl });
        localStorage.setItem(HOST_KEY, JSON.stringify(created));
        setCredentials(created);
      };
      try {
        const forceFresh = new URLSearchParams(location.search).get('fresh') === '1';
        if (!forceFresh) {
          const saved = localStorage.getItem(HOST_KEY);
          if (saved) {
            try {
              const parsed = JSON.parse(saved) as HostStored;
              const snapshot = await emitAck<RoomSnapshot>('host:reconnect', { roomCode: parsed.roomCode, hostToken: parsed.hostToken });
              setCredentials(parsed);
              setRoom(snapshot);
              return;
            } catch {
              localStorage.removeItem(HOST_KEY);
            }
          }
        } else {
          localStorage.removeItem(HOST_KEY);
        }
        await createFreshRoom();
      } catch (err) {
        localStorage.removeItem(HOST_KEY);
        setError(err instanceof Error ? err.message : 'Could not create room');
      } finally {""",
    """      const createFreshRoom = async () => {
        const network = await fetch('/api/network').then((response) => response.json()) as { baseUrl: string };
        const created = await emitAck<HostRoomCredentials>('room:create', { settings: DEFAULT_SETTINGS, baseUrl: network.baseUrl });
        writeHostCredentials(created);
        setCredentials(created);
        if (new URLSearchParams(location.search).get('fresh') === '1') {
          history.replaceState(null, '', stripFreshHostFlag(location.href));
        }
      };
      try {
        const forceFresh = new URLSearchParams(location.search).get('fresh') === '1';
        if (!forceFresh) {
          const parsed = readActiveHostCredentials();
          if (parsed) {
            try {
              const snapshot = await emitAck<RoomSnapshot>('host:reconnect', { roomCode: parsed.roomCode, hostToken: parsed.hostToken });
              writeHostCredentials(parsed);
              setCredentials(parsed);
              setRoom(snapshot);
              return;
            } catch (reconnectError) {
              const message = reconnectError instanceof Error ? reconnectError.message : 'Could not restore saved room';
              const terminal = /authorization|not found|expired/i.test(message);
              if (!terminal) {
                // Preserve the saved room on signaling/network failures. A transient outage must
                // never destroy the only reconnect credentials for an otherwise valid game.
                setCredentials(parsed);
                setError(`${message}. Saved room ${parsed.roomCode} was preserved; retry when the connection is available.`);
                return;
              }
              clearHostCredentials(parsed);
            }
          }
        }
        await createFreshRoom();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create room');
      } finally {""",
)

# Host enhancement controls must stay bound to the tab's room even if another tab starts a new game.
replace_once(
    "src/components/HostEnhancements.tsx",
    "import { readAccessibility, saveAccessibility, type AccessibilityPreferences } from '../lib/accessibility';\n\nconst HOST_KEY = 'blue-stage-host-room';",
    "import { readAccessibility, saveAccessibility, type AccessibilityPreferences } from '../lib/accessibility';\nimport { readActiveHostCredentials } from '../lib/hostCredentials';",
)
replace_once(
    "src/components/HostEnhancements.tsx",
    """function readCredentials(): HostRoomCredentials | null {
  try {
    const raw = localStorage.getItem(HOST_KEY);
    return raw ? JSON.parse(raw) as HostRoomCredentials : null;
  } catch { return null; }
}""",
    """function readCredentials(): HostRoomCredentials | null {
  try { return readActiveHostCredentials(); }
  catch { return null; }
}""",
)

# Lifecycle no longer polls fresh=1; HostApp consumes it only after a successful new-room creation.
write("src/lib/clientLifecycle.ts", """import { emitAck, resumeClientSession } from './socket';
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
""")

# Peer client: LAN-safe ids, one in-flight connection per room, and lightweight heartbeat.
replace_once(
    "src/lib/socket.ts",
    "import { authorizeRemoteEvent, type RemoteIdentity } from './remoteAuthorization';",
    "import { authorizeRemoteEvent, type RemoteIdentity } from './remoteAuthorization';\nimport { randomId } from './ids';",
)
replace_once(
    "src/lib/socket.ts",
    "let reconnectTimer: number | null = null;\nlet authReplay:",
    "let reconnectTimer: number | null = null;\nlet clientConnectPromise: { roomCode: string; promise: Promise<DataConnection> } | null = null;\nlet authReplay:",
)
replace_once(
    "src/lib/socket.ts",
    "const requestId = crypto.randomUUID();",
    "const requestId = randomId('request');",
)
replace_once(
    "src/lib/socket.ts",
    """async function connectToHost(roomCode: string): Promise<DataConnection> {
  if (clientSuspended) throw new Error('Connection is paused');
  const targetRoom = roomCode.toUpperCase();
  if (clientConnection && !clientConnection.open) {
    const staleConnection = clientConnection;
    clientConnection = null;
    try { staleConnection.close(); } catch { /* already closed */ }
  }
  if (clientConnection?.open && clientRoomCode === targetRoom) return clientConnection;
  if (clientConnection?.open && clientRoomCode && clientRoomCode !== targetRoom) {
    try { clientConnection.close(); } catch { /* ignore */ }
    clientConnection = null;
    authReplay = null;
  }
  clientRoomCode = targetRoom;
  const peer = await createClientPeer();
  return await new Promise<DataConnection>((resolve, reject) => {
    const connection = peer.connect(hostPeerId(roomCode), { reliable: true, serialization: 'json' });
    let settled = false;
    attachClientConnection(connection);
    connection.on('open', () => {
      if (settled) return;
      settled = true;
      clientConnection = connection;
      socket.connected = true;
      reconnectDelayMs = 400;
      emitLocal('connect');
      const finish = async () => {
        if (authReplay) {
          try {
            await sendRequestOn(connection, authReplay.event, authReplay.payload, 6000);
          } catch (error) {
            dropClientConnection(connection);
            reject(error instanceof Error ? error : new Error('Could not restore session'));
            return;
          }
        }
        resolve(connection);
      };
      void finish();
    });
    connection.on('error', (error) => { if (settled) return; settled = true; reject(error instanceof Error ? error : new Error('Could not connect to host')); });
    window.setTimeout(() => {
      if (settled) return;
      settled = true;
      try { connection.close(); } catch { /* ignore */ }
      reject(new Error('Could not find that game. Confirm the host page is open.'));
    }, 6500);
  });
}""",
    """async function openConnectionToHost(targetRoom: string): Promise<DataConnection> {
  if (clientConnection && !clientConnection.open) {
    const staleConnection = clientConnection;
    clientConnection = null;
    try { staleConnection.close(); } catch { /* already closed */ }
  }
  if (clientConnection?.open && clientRoomCode === targetRoom) return clientConnection;
  if (clientConnection?.open && clientRoomCode && clientRoomCode !== targetRoom) {
    try { clientConnection.close(); } catch { /* ignore */ }
    clientConnection = null;
    authReplay = null;
  }
  clientRoomCode = targetRoom;
  const peer = await createClientPeer();
  return await new Promise<DataConnection>((resolve, reject) => {
    const connection = peer.connect(hostPeerId(targetRoom), { reliable: true, serialization: 'json' });
    let settled = false;
    attachClientConnection(connection);
    connection.on('open', () => {
      if (settled) return;
      if (clientSuspended) {
        settled = true;
        try { connection.close(); } catch { /* ignore */ }
        reject(new Error('Connection is paused'));
        return;
      }
      settled = true;
      clientConnection = connection;
      socket.connected = true;
      reconnectDelayMs = 400;
      emitLocal('connect');
      const finish = async () => {
        if (authReplay) {
          try {
            await sendRequestOn(connection, authReplay.event, authReplay.payload, 6000);
          } catch (error) {
            dropClientConnection(connection);
            reject(error instanceof Error ? error : new Error('Could not restore session'));
            return;
          }
        }
        resolve(connection);
      };
      void finish();
    });
    connection.on('error', (error) => { if (settled) return; settled = true; reject(error instanceof Error ? error : new Error('Could not connect to host')); });
    window.setTimeout(() => {
      if (settled) return;
      settled = true;
      try { connection.close(); } catch { /* ignore */ }
      reject(new Error('Could not find that game. Confirm the host page is open.'));
    }, 6500);
  });
}
async function connectToHost(roomCode: string): Promise<DataConnection> {
  if (clientSuspended) throw new Error('Connection is paused');
  const targetRoom = roomCode.toUpperCase();
  if (clientConnection?.open && clientRoomCode === targetRoom) return clientConnection;
  if (clientConnectPromise?.roomCode === targetRoom) return clientConnectPromise.promise;
  const promise = openConnectionToHost(targetRoom).finally(() => {
    if (clientConnectPromise?.promise === promise) clientConnectPromise = null;
  });
  clientConnectPromise = { roomCode: targetRoom, promise };
  return promise;
}""",
)
replace_once(
    "src/lib/socket.ts",
    """    case 'player:reconnect': {
      if (!connection) throw new Error('Player reconnect requires a phone connection');
      const credentials = engine.reconnectPlayer(roomCode, String(payload.playerId ?? ''), String(payload.reconnectToken ?? ''));
      bindIdentity(connection, { roomCode: credentials.roomCode, role: 'player', playerId: credentials.playerId });
      emitRoom(credentials.roomCode);
      return credentials;
    }
    case 'host:update-settings':""",
    """    case 'player:reconnect': {
      if (!connection) throw new Error('Player reconnect requires a phone connection');
      const credentials = engine.reconnectPlayer(roomCode, String(payload.playerId ?? ''), String(payload.reconnectToken ?? ''));
      bindIdentity(connection, { roomCode: credentials.roomCode, role: 'player', playerId: credentials.playerId });
      emitRoom(credentials.roomCode);
      return credentials;
    }
    case 'player:heartbeat': return null;
    case 'host:update-settings':""",
)
replace_once(
    "src/lib/socket.ts",
    """    const roomCode = String(message.payload.roomCode ?? '').toUpperCase();
    if (roomCode) emitRoom(roomCode);""",
    """    const roomCode = String(message.payload.roomCode ?? '').toUpperCase();
    if (roomCode && message.event !== 'player:heartbeat') emitRoom(roomCode);""",
)
replace_once(
    "src/lib/socket.ts",
    """export function suspendClientSession(): void {
  clientSuspended = true;""",
    """export function suspendClientSession(): void {
  clientSuspended = true;
  clientConnectPromise = null;""",
)

# Player heartbeat now only confirms transport health; reconnect remains the authentication replay path.
replace_once(
    "src/components/PlayerApp.tsx",
    """  useEffect(() => {
    if (!credentials || !room?.code || hostSuspended) return;
    let syncing = false;
    const sync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        const result = await emitAck<PlayerJoinCredentials>('player:reconnect', credentials);
        localStorage.setItem(PLAYER_KEY, JSON.stringify(result));
        setCredentials(result);
        syncFailuresRef.current = 0;
        setRecovering(false);
      } catch {
        syncFailuresRef.current += 1;
        setRecovering(true);
      } finally { syncing = false; }
    };
    const timer = window.setInterval(() => { void sync(); }, 3000);
    return () => window.clearInterval(timer);
  }, [credentials, room?.code, hostSuspended]);""",
    """  useEffect(() => {
    if (!credentials || !room?.code || hostSuspended) return;
    let syncing = false;
    const sync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        await emitAck('player:heartbeat', credentials);
        syncFailuresRef.current = 0;
        setRecovering(false);
      } catch {
        syncFailuresRef.current += 1;
        setRecovering(true);
      } finally { syncing = false; }
    };
    const timer = window.setInterval(() => { void sync(); }, 3000);
    return () => window.clearInterval(timer);
  }, [credentials, room?.code, hostSuspended]);""",
)

# Presentation must relinquish its read-only authenticated transport when it leaves the route.
replace_once(
    "src/components/PresentationApp.tsx",
    "import { emitAck, socket } from '../lib/socket';",
    "import { emitAck, resumeClientSession, socket, suspendClientSession } from '../lib/socket';",
)
replace_once(
    "src/components/PresentationApp.tsx",
    """  useEffect(() => {
    const onState = (snapshot: RoomSnapshot) => applySnapshot(snapshot);
    socket.on('room:state', onState);
    void emitAck<RoomSnapshot>('presentation:join', { roomCode }).then(applySnapshot).catch((err) => setError(err instanceof Error ? err.message : 'Could not join game'));
    return () => { socket.off('room:state', onState); audio.stop(); };
  }, [roomCode, applySnapshot]);""",
    """  useEffect(() => {
    resumeClientSession();
    const onState = (snapshot: RoomSnapshot) => applySnapshot(snapshot);
    socket.on('room:state', onState);
    void emitAck<RoomSnapshot>('presentation:join', { roomCode }).then(applySnapshot).catch((err) => setError(err instanceof Error ? err.message : 'Could not join game'));
    return () => {
      socket.off('room:state', onState);
      suspendClientSession();
      audio.stop();
    };
  }, [roomCode, applySnapshot]);""",
)

# Host/presentation animation ids must work on LAN HTTP, where randomUUID may be unavailable.
replace_once(
    "src/components/HostAppV3.tsx",
    "import { stripFreshHostFlag } from '../lib/hostSession';",
    "import { stripFreshHostFlag } from '../lib/hostSession';\nimport { randomId } from '../lib/ids';",
)
replace_once("src/components/HostAppV3.tsx", "id: crypto.randomUUID(),", "id: randomId('score-flight'),")
replace_once(
    "src/components/PresentationApp.tsx",
    "import { ScoreFlight, type ScoreFlightState } from './ScoreFlight';",
    "import { ScoreFlight, type ScoreFlightState } from './ScoreFlight';\nimport { randomId } from '../lib/ids';",
)
replace_once("src/components/PresentationApp.tsx", "id: crypto.randomUUID(),", "id: randomId('presentation-score'),")

# Regression tests for the disconnect/Final behavior added by this audit.
path = Path('tests/browserGameEngine.test.ts')
text = path.read_text()
marker = "\n});\n"
insert = r'''

  it('keeps typed and Final response windows open through a transient disconnect', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true, timerSeconds: 15 });
    const player = addPlayer(engine, host.roomCode, 'Reconnect Me');
    engine.startGame(host.roomCode, host.hostToken);

    const rooms = (engine as unknown as { rooms: Map<string, { questions: Record<string, { responseMode?: 'buzz' | 'text' }> }> }).rooms;
    const record = rooms.get(host.roomCode)!;
    const typed = engine.snapshot(host.roomCode).board!.questions.find((candidate) => !candidate.used && (record.questions[candidate.questionId].responseMode ?? 'buzz') === 'text');
    if (typed) {
      engine.selectQuestion(host.roomCode, host.hostToken, typed.questionId);
      engine.setPlayerConnected(host.roomCode, player.playerId, false);
      expect(engine.snapshot(host.roomCode).currentQuestion?.responsesClosed).toBe(false);
      engine.reconnectPlayer(host.roomCode, player.playerId, player.reconnectToken);
      engine.submitTextResponse(host.roomCode, player.playerId, player.reconnectToken, 'answer');
      expect(engine.snapshot(host.roomCode).currentQuestion?.textResponses?.[player.playerId]).toBeTruthy();
      engine.revealAnswer(host.roomCode, host.hostToken);
      engine.resolveTextResponse(host.roomCode, host.hostToken, player.playerId, false);
      engine.advanceToBoard(host.roomCode, host.hostToken);
    }

    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    const finalState = engine.snapshot(host.roomCode);
    expect(finalState.phase).toBe('final-category');
    expect(finalState.finalRound?.participantIds).toContain(player.playerId);
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    engine.submitFinalWager(host.roomCode, player.playerId, player.reconnectToken, 0);
    engine.openFinalQuestion(host.roomCode, host.hostToken);
    engine.setPlayerConnected(host.roomCode, player.playerId, false);
    expect(engine.snapshot(host.roomCode).finalRound?.responsesClosed).toBe(false);
  });

  it('still starts Final when the reserved player is disconnected at the last board clue', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true });
    const player = addPlayer(engine, host.roomCode, 'Reserved');
    engine.startGame(host.roomCode, host.hostToken);
    while (engine.snapshot(host.roomCode).remainingQuestions > 1) {
      const tile = firstUnused(engine, host.roomCode);
      engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
      engine.revealAnswer(host.roomCode, host.hostToken);
      engine.advanceToBoard(host.roomCode, host.hostToken);
    }
    engine.setPlayerConnected(host.roomCode, player.playerId, false);
    const last = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, last.questionId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.advanceToBoard(host.roomCode, host.hostToken);
    const state = engine.snapshot(host.roomCode);
    expect(state.phase).toBe('final-category');
    expect(state.finalRound?.participantIds).toContain(player.playerId);
  });
'''
pos = text.rfind(marker)
if pos < 0:
    raise SystemExit('tests/browserGameEngine.test.ts: closing describe marker not found')
path.write_text(text[:pos] + insert + text[pos:])

# Ensure no randomUUID dependency remains in application code.
for source in Path('src').rglob('*'):
    if source.suffix not in {'.ts', '.tsx'}:
        continue
    if 'crypto.randomUUID()' in source.read_text():
        raise SystemExit(f'{source}: crypto.randomUUID remains')
