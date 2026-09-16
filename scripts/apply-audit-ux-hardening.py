from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:180]!r}")
    file.write_text(text.replace(old, new, 1))


# ----- Authoritative board result metadata + persistence revision -----
replace_once(
    'src/shared/types.ts',
    """export interface BoardQuestion {
  questionId: string;
  category: string;
  value: QuestionValue;
  used: boolean;
  dailyDouble: boolean;
}""",
    """export interface BoardQuestionResult {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  correct: boolean;
  delta: number;
}

export interface BoardQuestion {
  questionId: string;
  category: string;
  value: QuestionValue;
  used: boolean;
  dailyDouble: boolean;
  /** Actual point value when this tile was played, including late modifiers or DD wager. */
  playedValue?: number;
  /** Public scoring result stored with the authoritative room so presentation/recovery stay consistent. */
  results?: BoardQuestionResult[];
}""",
)
replace_once(
    'src/shared/types.ts',
    """  createdAt: number;
  expiresAt: number;
  hostConnected: boolean;""",
    """  createdAt: number;
  expiresAt: number;
  /** Monotonic authoritative-state revision used to choose the newer recovery snapshot. */
  revision?: number;
  hostConnected: boolean;""",
)

replace_once(
    'src/lib/browserGameEngine.ts',
    """      record.state.locked = false;
      record.state.settings.lockRoomOnStart = false;""",
    """      record.state.locked = false;
      record.state.revision ??= 0;
      record.state.settings.lockRoomOnStart = false;""",
)
replace_once(
    'src/lib/browserGameEngine.ts',
    """  private rooms = new Map<string, RoomRecord>();
  private seenQuestionIds = new Set<string>();""",
    """  private rooms = new Map<string, RoomRecord>();
  private seenQuestionIds = new Set<string>();
  private persistenceHealthy = true;""",
)
replace_once(
    'src/lib/browserGameEngine.ts',
    """  private persist(): void {
    try {
      const serialized = JSON.stringify([...this.rooms.values()]);
      const previous = localStorage.getItem(STORAGE_KEY);
      if (previous && previous !== serialized && validStoredRooms(previous)) localStorage.setItem(STORAGE_BACKUP_KEY, previous);
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch { /* keep the in-memory game running */ }
  }""",
    """  private reportPersistence(ok: boolean): void {
    if (this.persistenceHealthy === ok) return;
    this.persistenceHealthy = ok;
    if (typeof window === 'undefined') return;
    (window as typeof window & { BLUE_STAGE_PERSISTENCE_OK?: boolean }).BLUE_STAGE_PERSISTENCE_OK = ok;
    window.dispatchEvent(new CustomEvent('blue-stage:persistence-status', { detail: { ok } }));
  }
  private persist(): void {
    try {
      for (const room of this.rooms.values()) room.state.revision = (room.state.revision ?? 0) + 1;
      const serialized = JSON.stringify([...this.rooms.values()]);
      const previous = localStorage.getItem(STORAGE_KEY);
      if (previous && previous !== serialized && validStoredRooms(previous)) localStorage.setItem(STORAGE_BACKUP_KEY, previous);
      localStorage.setItem(STORAGE_KEY, serialized);
      this.reportPersistence(true);
    } catch {
      // Keep the in-memory game running, but make recovery failure visible to the host.
      this.reportPersistence(false);
    }
  }""",
)
replace_once(
    'src/lib/browserGameEngine.ts',
    """      createdAt: Date.now(),
      expiresAt: Date.now() + this.roomTtlMs,
      hostConnected: true,""",
    """      createdAt: Date.now(),
      expiresAt: Date.now() + this.roomTtlMs,
      revision: 0,
      hostConnected: true,""",
)
replace_once(
    'src/lib/browserGameEngine.ts',
    """        boardQuestions.push({ questionId: chosenQuestion.id, category: categoryName, value: chosenQuestion.value, used: false, dailyDouble: false });""",
    """        boardQuestions.push({ questionId: chosenQuestion.id, category: categoryName, value: chosenQuestion.value, used: false, dailyDouble: false, playedValue: undefined, results: [] });""",
)
replace_once(
    'src/lib/browserGameEngine.ts',
    """    tile.used = true;
    room.state.remainingQuestions -= 1;""",
    """    tile.used = true;
    tile.playedValue = question.value * multiplier;
    tile.results = [];
    room.state.remainingQuestions -= 1;""",
)
replace_once(
    'src/lib/browserGameEngine.ts',
    """    current.wager = wager;
    player.stats.biggestWager = Math.max(player.stats.biggestWager, wager);""",
    """    current.wager = wager;
    const tile = room.state.board?.questions.find((entry) => entry.questionId === current.questionId);
    if (tile) {
      const multiplier = room.state.settings.dailyDoubleStacksWithMultiplier
        ? this.multiplierForRemaining(room.state.remainingQuestions + 1, room.state.settings.lateGameModifiers)
        : 1;
      tile.playedValue = wager * multiplier;
    }
    player.stats.biggestWager = Math.max(player.stats.biggestWager, wager);""",
)
replace_once(
    'src/lib/browserGameEngine.ts',
    """  private addScore(player: Player, delta: number, settings: GameSettings): void {
    const before = player.score;
    const after = settings.allowNegativeScores ? before + delta : Math.max(0, before + delta);
    const actualDelta = after - before;
    player.score = after;
    if (actualDelta >= 0) player.stats.pointsGained += actualDelta;
    else player.stats.pointsLost += Math.abs(actualDelta);
  }
""",
    """  private addScore(player: Player, delta: number, settings: GameSettings): number {
    const before = player.score;
    const after = settings.allowNegativeScores ? before + delta : Math.max(0, before + delta);
    const actualDelta = after - before;
    player.score = after;
    if (actualDelta >= 0) player.stats.pointsGained += actualDelta;
    else player.stats.pointsLost += Math.abs(actualDelta);
    return actualDelta;
  }
  private recordBoardResult(room: RoomRecord, player: Player, correct: boolean, delta: number): void {
    const current = room.state.currentQuestion;
    if (!current || !room.state.board) return;
    const tile = room.state.board.questions.find((entry) => entry.questionId === current.questionId);
    if (!tile) return;
    tile.playedValue ??= current.effectiveValue;
    const result = { playerId: player.id, playerName: player.name, playerAvatar: player.avatar, correct, delta };
    tile.results = [...(tile.results ?? []).filter((entry) => entry.playerId !== player.id), result];
  }
""",
)
replace_once(
    'src/lib/browserGameEngine.ts',
    """    this.addScore(player, correct ? points : -points, room.state.settings);
    if (correct) player.stats.correct += 1; else player.stats.incorrect += 1;""",
    """    const scoreDelta = this.addScore(player, correct ? points : -points, room.state.settings);
    this.recordBoardResult(room, player, correct, scoreDelta);
    if (correct) player.stats.correct += 1; else player.stats.incorrect += 1;""",
)
replace_once(
    'src/lib/browserGameEngine.ts',
    """    this.addScore(player, correct ? points : -points, room.state.settings);
    if (correct) player.stats.correct += 1; else player.stats.incorrect += 1;
    this.applyStreak(player, correct, room.state.settings);
    this.persist();
    return this.snapshot(roomCode);
  }

  private closeTextResponsesInternal""",
    """    const scoreDelta = this.addScore(player, correct ? points : -points, room.state.settings);
    this.recordBoardResult(room, player, correct, scoreDelta);
    if (correct) player.stats.correct += 1; else player.stats.incorrect += 1;
    this.applyStreak(player, correct, room.state.settings);
    this.persist();
    return this.snapshot(roomCode);
  }

  private closeTextResponsesInternal""",
)
replace_once(
    'src/lib/browserGameEngine.ts',
    """    this.addScore(player, -points, room.state.settings);
    player.stats.incorrect += 1;""",
    """    const scoreDelta = this.addScore(player, -points, room.state.settings);
    this.recordBoardResult(room, player, false, scoreDelta);
    player.stats.incorrect += 1;""",
)

# ----- Recovery chooses higher revision before timestamps -----
replace_once(
    'src/lib/roomStorageRecovery.ts',
    """    expiresAt?: number;
  };""",
    """    expiresAt?: number;
    revision?: number;
  };""",
)
replace_once(
    'src/lib/roomStorageRecovery.ts',
    """function roomFreshness(room: StoredRoom): number {
  const expiresAt = Number(room.state?.expiresAt ?? 0);
  const createdAt = Number(room.state?.createdAt ?? 0);
  return Math.max(expiresAt, createdAt);
}""",
    """function roomFreshness(room: StoredRoom): [number, number] {
  const revision = Number(room.state?.revision ?? 0);
  const expiresAt = Number(room.state?.expiresAt ?? 0);
  const createdAt = Number(room.state?.createdAt ?? 0);
  return [Number.isFinite(revision) ? revision : 0, Math.max(expiresAt, createdAt)];
}
function newerThan(candidate: StoredRoom, existing: StoredRoom): boolean {
  const [candidateRevision, candidateTime] = roomFreshness(candidate);
  const [existingRevision, existingTime] = roomFreshness(existing);
  return candidateRevision !== existingRevision ? candidateRevision > existingRevision : candidateTime > existingTime;
}""",
)
replace_once(
    'src/lib/roomStorageRecovery.ts',
    """    if (!existing || roomFreshness(room) >= roomFreshness(existing)) byCode.set(code, room);""",
    """    if (!existing || newerThan(room, existing)) byCode.set(code, room);""",
)

# ----- Board displays authoritative played values/results everywhere -----
replace_once(
    'src/components/Board.tsx',
    """import type { BoardState } from '../shared/types';

export type BoardResult = {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  correct: boolean;
};""",
    """import type { BoardQuestionResult, BoardState } from '../shared/types';

export type BoardResult = BoardQuestionResult;""",
)
replace_once(
    'src/components/Board.tsx',
    """        const displayedValue = question.used ? question.value : question.value * multiplier;
        const questionResults = results[question.questionId] ?? [];""",
    """        const displayedValue = question.used ? question.playedValue ?? question.value : question.value * multiplier;
        const questionResults = question.results?.length ? question.results : results[question.questionId] ?? [];""",
)
replace_once(
    'src/components/Board.tsx',
    """            <small className=\"used-tile-value\">{question.value}</small>
            <div className=\"used-result-list\">{questionResults.map((result) => <span className={`used-result-chip ${result.correct ? 'correct' : 'wrong'}`} key={result.playerId}><b>{result.playerAvatar} {result.playerName}</b><em>{result.correct ? 'CORRECT' : 'INCORRECT'}</em></span>)}</div>""",
    """            <small className=\"used-tile-value\">{question.playedValue ?? question.value}</small>
            <div className=\"used-result-list\">{questionResults.map((result) => <span className={`used-result-chip ${result.correct ? 'correct' : 'wrong'}`} key={result.playerId}><b>{result.playerAvatar} {result.playerName}</b><em>{result.correct ? `CORRECT · +${Math.max(0, result.delta).toLocaleString()}` : `INCORRECT · ${result.delta.toLocaleString()}`}</em></span>)}</div>""",
)

# ----- Visible comeback award on score-flight animation -----
replace_once(
    'src/components/ScoreFlight.tsx',
    """  delta: number;
  correct: boolean;
};""",
    """  delta: number;
  correct: boolean;
  comebackBonus?: number;
};""",
)
replace_once(
    'src/components/ScoreFlight.tsx',
    """      token.textContent = `${flight.delta > 0 ? '+' : ''}${flight.delta.toLocaleString()}`;""",
    """      token.textContent = flight.comebackBonus && flight.comebackBonus > 0
        ? `+${flight.delta.toLocaleString()} · COMEBACK +${flight.comebackBonus.toLocaleString()}`
        : `${flight.delta > 0 ? '+' : ''}${flight.delta.toLocaleString()}`;""",
)
replace_once(
    'src/components/HostAppV3.tsx',
    """    const awardedPoints = correct && !current.dailyDouble ? calculateComebackAward(room, player, pointsAtStake).points : pointsAtStake;
    const signedDelta = correct ? awardedPoints : settings.allowNegativeScores ? -pointsAtStake : -Math.min(Math.max(0, player.score), pointsAtStake);""",
    """    const comeback = correct && !current.dailyDouble ? calculateComebackAward(room, player, pointsAtStake) : null;
    const awardedPoints = comeback?.points ?? pointsAtStake;
    const signedDelta = correct ? awardedPoints : settings.allowNegativeScores ? -pointsAtStake : -Math.min(Math.max(0, player.score), pointsAtStake);""",
)
replace_once(
    'src/components/HostAppV3.tsx',
    """      delta: signedDelta,
      correct
    };""",
    """      delta: signedDelta,
      correct,
      comebackBonus: comeback?.bonus ?? 0
    };""",
)
replace_once(
    'src/components/PresentationApp.tsx',
    """          delta: player.score - before.score,
          correct: player.score > before.score
        });""",
    """          delta: player.score - before.score,
          correct: player.score > before.score,
          comebackBonus: player.score > before.score && !snapshot.currentQuestion?.dailyDouble
            ? Math.max(0, player.score - before.score - (snapshot.currentQuestion?.effectiveValue ?? previous.currentQuestion?.effectiveValue ?? 0))
            : 0
        });""",
)

# ----- Host duplicate-action guard -----
replace_once(
    'src/components/HostAppV3.tsx',
    """  const lastPenaltySnapshotRef = useRef<RoomSnapshot | null>(null);

  const perform = useCallback(async (event: string, payload: Record<string, unknown> = {}): Promise<boolean> => {
    if (!credentials) return false;
    setError('');
    setBusy(true);""",
    """  const lastPenaltySnapshotRef = useRef<RoomSnapshot | null>(null);
  const inFlightActionsRef = useRef(new Set<string>());

  const perform = useCallback(async (event: string, payload: Record<string, unknown> = {}): Promise<boolean> => {
    if (!credentials) return false;
    const actionKey = `${event}:${JSON.stringify(payload)}`;
    if (inFlightActionsRef.current.has(actionKey)) return false;
    inFlightActionsRef.current.add(actionKey);
    setError('');
    setBusy(true);""",
)
replace_once(
    'src/components/HostAppV3.tsx',
    """    } finally {
      setBusy(false);
    }
  }, [credentials]);""",
    """    } finally {
      inFlightActionsRef.current.delete(actionKey);
      setBusy(false);
    }
  }, [credentials]);""",
)

# ----- Lint warnings fixed by depending on the actual captured values -----
replace_once(
    'src/components/HostAppV3.tsx',
    """  }, [room?.phase, room?.settings.stealsEnabled, room?.settings.lockRoomOnStart, room?.settings.selectedPackIds, room?.settings.mixedPacks, credentials, perform]);""",
    """  }, [room, credentials, perform]);""",
)
replace_once(
    'src/components/HostAppV3.tsx',
    """  }, [room?.currentQuestion?.answerRevealed, room?.currentQuestion?.questionId, room?.currentQuestion?.acceptedAnswers, saveHistory]);""",
    """  }, [room?.currentQuestion, saveHistory]);""",
)
replace_once(
    'src/components/HostAppV3.tsx',
    """  }, [room?.currentQuestion?.questionId, room?.currentQuestion?.buzzOpen, room?.currentQuestion?.buzzWinnerId, room?.currentQuestion?.answerRevealed, room?.currentQuestion?.responseMode, room?.phase, perform]);""",
    """  }, [room?.currentQuestion, room?.phase, perform]);""",
)
replace_once(
    'src/components/HostAppV3.tsx',
    """  }, [room?.multiplier, room?.phase]);""",
    """  }, [room]);""",
)
replace_once(
    'src/components/HostEnhancements.tsx',
    """  }, [room?.code, room?.players.length, credentials]);""",
    """  }, [room, credentials]);""",
)
replace_once(
    'src/components/HostEnhancements.tsx',
    """  }, [room?.phase, room?.gameStartedAt, room?.gameEndedAt, room?.currentQuestion?.questionId, room?.board?.categories.join('|'), accessibility.reduceMotion]);""",
    """  }, [room, accessibility.reduceMotion]);""",
)
replace_once(
    'src/components/PlayerApp.tsx',
    """  }, [room?.multiplier, room?.phase]);""",
    """  }, [room]);""",
)

# Timer: avoid capturing the entire timer object while listing only some fields.
Path('src/components/Timer.tsx').write_text("""import { useEffect, useState } from 'react';
import type { TimerState } from '../shared/types';

interface TimerProps { timer: TimerState; serverNow?: number }
interface TimerAnchor { remainingMs: number; localAt: number; running: boolean }

function clampedRemaining(durationMs: number | null, remainingMs: number | null): number {
  if (!durationMs) return 0;
  return Math.max(0, Math.min(durationMs, remainingMs ?? durationMs));
}

export function Timer({ timer, serverNow }: TimerProps) {
  const { running, durationMs, endsAt, remainingMs } = timer;
  const [anchor, setAnchor] = useState<TimerAnchor>(() => ({
    remainingMs: clampedRemaining(durationMs, remainingMs),
    localAt: performance.now(),
    running
  }));
  const [, forceTick] = useState(0);

  useEffect(() => {
    setAnchor({ remainingMs: clampedRemaining(durationMs, remainingMs), localAt: performance.now(), running });
    if (!running) return;
    const id = window.setInterval(() => forceTick((value) => value + 1), 100);
    return () => window.clearInterval(id);
  }, [running, endsAt, remainingMs, durationMs, serverNow]);

  if (!durationMs) return null;
  const elapsed = anchor.running ? performance.now() - anchor.localAt : 0;
  const remaining = Math.max(0, Math.min(durationMs, anchor.remainingMs - elapsed));
  const ratio = Math.max(0, Math.min(1, remaining / durationMs));
  const seconds = Math.min(Math.ceil(durationMs / 1000), Math.ceil(remaining / 1000));
  return <div className={`timer ${ratio < .25 ? 'urgent' : ''}`} aria-live="polite"><span>{seconds}</span><div className="timer-track"><div className="timer-fill" style={{ transform: `scaleX(${ratio})` }} /></div></div>;
}
""")
replace_once('src/App.tsx', "\nexport { menuUrl };", "")

# ----- Persistence status visible in host panel -----
replace_once(
    'src/components/HostEnhancements.tsx',
    """  const [actionMessage, setActionMessage] = useState('');""",
    """  const [actionMessage, setActionMessage] = useState('');
  const [persistenceOk, setPersistenceOk] = useState(() => (window as typeof window & { BLUE_STAGE_PERSISTENCE_OK?: boolean }).BLUE_STAGE_PERSISTENCE_OK !== false);""",
)
replace_once(
    'src/components/HostEnhancements.tsx',
    """  useEffect(() => {
    const onState = (snapshot: RoomSnapshot) => {""",
    """  useEffect(() => {
    const onPersistence = (event: Event) => setPersistenceOk(Boolean((event as CustomEvent<{ ok: boolean }>).detail?.ok));
    window.addEventListener('blue-stage:persistence-status', onPersistence);
    return () => window.removeEventListener('blue-stage:persistence-status', onPersistence);
  }, []);

  useEffect(() => {
    const onState = (snapshot: RoomSnapshot) => {""",
)
replace_once(
    'src/components/HostEnhancements.tsx',
    """        <div><small>AUTO RECOVERY</small><strong>Saved continuously</strong></div>
        <span>{phaseLabel(room)}{room.timer.running ? ' · timer active' : ''}</span>""",
    """        <div><small>{persistenceOk ? 'AUTO RECOVERY' : 'RECOVERY WARNING'}</small><strong>{persistenceOk ? 'Saved continuously' : 'Storage failed · in-memory only'}</strong></div>
        <span>{phaseLabel(room)}{room.timer.running ? ' · timer active' : ''}</span>""",
)

# ----- Audio click de-duplication -----
replace_once(
    'src/lib/audio.ts',
    """  private transitionTimer: number | null = null;
  private generation = 0;""",
    """  private transitionTimer: number | null = null;
  private clickTimer: number | null = null;
  private generation = 0;""",
)
replace_once(
    'src/lib/audio.ts',
    """  cue(name: Cue): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('blue-stage:audio-cue', { detail: name }));
    if (!this.context || !this.effects || this.settings.muted) return;""",
    """  cue(name: Cue): void {
    if (name === 'click') {
      if (this.clickTimer !== null) window.clearTimeout(this.clickTimer);
      this.clickTimer = window.setTimeout(() => {
        this.clickTimer = null;
        this.playCue('click');
      }, 55);
      return;
    }
    if (this.clickTimer !== null) {
      window.clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }
    this.playCue(name);
  }

  private playCue(name: Cue): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('blue-stage:audio-cue', { detail: name }));
    if (!this.context || !this.effects || this.settings.muted) return;""",
)

# ----- Reduce-motion preference applies to Web Animations and Final tension delays -----
replace_once(
    'src/components/ScoreFlight.tsx',
    "import { audio } from '../lib/audio';",
    "import { audio } from '../lib/audio';\nimport { readAccessibility } from '../lib/accessibility';",
)
replace_once(
    'src/components/ScoreFlight.tsx',
    """      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;""",
    """      const reducedMotion = readAccessibility().reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;""",
)
replace_once(
    'src/components/HostAppV3.tsx',
    "import { randomId } from '../lib/ids';",
    "import { randomId } from '../lib/ids';\nimport { readAccessibility } from '../lib/accessibility';",
)
replace_once(
    'src/components/HostAppV3.tsx',
    """  const runRevealTension = async () => {
    if (revealRunningRef.current) return false;
    revealRunningRef.current = true;
    setRevealBeat(1);""",
    """  const runRevealTension = async () => {
    if (revealRunningRef.current) return false;
    revealRunningRef.current = true;
    if (readAccessibility().reduceMotion) {
      setRevealBeat(4);
      return true;
    }
    setRevealBeat(1);""",
)
replace_once(
    'src/components/HostAppV3.tsx',
    """    window.setTimeout(() => {
      setRevealBeat(0);
      revealRunningRef.current = false;
    }, 1150);""",
    """    window.setTimeout(() => {
      setRevealBeat(0);
      revealRunningRef.current = false;
    }, readAccessibility().reduceMotion ? 0 : 1150);""",
)

# ----- Accessibility + local launch polish -----
replace_once(
    'index.html',
    'content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"',
    'content="width=device-width, initial-scale=1.0"',
)
replace_once('src/lib/soundCaptions.ts', "zIndex: '2000',", "zIndex: '20000',")
replace_once(
    'src/components/QrScanner.tsx',
    """    const start = async () => {
      const Detector = detectorConstructor();""",
    """    const start = async () => {
      if (!window.isSecureContext) {
        setStarting(false);
        setError('Camera scanning requires HTTPS on this browser. Enter the room code manually.');
        return;
      }
      const Detector = detectorConstructor();""",
)

# Final All In is a meaningful positive wager, not a duplicate zero choice.
replace_once('src/lib/socket.ts', "const allIn = player.score >= 0 && wager === player.score;", "const allIn = player.score > 0 && wager === player.score;")
replace_once(
    'src/components/PlayerApp.tsx',
    """<button className={`all-in-wager ${selectedFinalWager===me.score && me.score>=0?'selected':''}`} disabled={me.score<0} onClick={()=>setSelectedFinalWager(me.score)}>ALL IN · {me.score.toLocaleString()}</button>""",
    """<button className={`all-in-wager ${selectedFinalWager===me.score && me.score>0?'selected':''}`} disabled={me.score<=0} onClick={()=>setSelectedFinalWager(me.score)}>ALL IN · {me.score.toLocaleString()}</button>""",
)

# Semantic duplicate guard applies within a pack too.
replace_once('src/packs/index.ts', "  if (left.packId === right.packId) return false;\n", "")

# Launchers only install when dependencies are missing/broken.
replace_once(
    'START-WINDOWS.bat',
    """echo Installing locked dependencies...
call npm ci --no-audit --no-fund
if errorlevel 1 goto :fail

echo Building game...""",
    """echo Checking dependencies...
call npm ls --depth=0 >nul 2>nul
if errorlevel 1 (
  echo Installing locked dependencies...
  call npm ci --no-audit --no-fund
  if errorlevel 1 goto :fail
)

echo Building game...""",
)
replace_once(
    'START-MAC.command',
    """echo "Installing locked dependencies..."
npm ci --no-audit --no-fund || exit 1

echo "Building game..."""",
    """echo "Checking dependencies..."
if ! npm ls --depth=0 >/dev/null 2>&1; then
  echo "Installing locked dependencies..."
  npm ci --no-audit --no-fund || exit 1
fi

echo "Building game..."""",
)

# Remove obsolete Socket.IO development proxy while retaining virtual API fallback.
replace_once(
    'vite.config.ts',
    """    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      },
      '/api': 'http://localhost:3000'
    }""",
    """    proxy: {
      '/api': 'http://localhost:3000'
    }""",
)

# Deploy when pack generator changes, and move GitHub actions off deprecated Node-20 action majors.
replace_once(
    '.github/workflows/deploy-pages.yml',
    """      - 'src/**'
      - 'index.html'""",
    """      - 'src/**'
      - 'scripts/generate-pack-registry.mjs'
      - 'index.html'""",
)
for workflow in ['.github/workflows/ci.yml', '.github/workflows/deploy-pages.yml']:
    file = Path(workflow)
    text = file.read_text().replace('actions/checkout@v4', 'actions/checkout@v5').replace('actions/setup-node@v4', 'actions/setup-node@v5')
    file.write_text(text)

# ----- Regression coverage -----
path = Path('tests/roomStorageRecovery.test.ts')
text = path.read_text()
insert = """

  it('prefers the higher state revision when timestamps tie', () => {
    const now = 1_000;
    const primary = { state: { code: 'TIE11', createdAt: 100, expiresAt: 5_000, revision: 3 }, marker: 'stale-primary' };
    const backup = { state: { code: 'TIE11', createdAt: 100, expiresAt: 5_000, revision: 8 }, marker: 'newer-backup' };
    const merged = mergeStoredRooms([primary], [backup], now);
    expect(merged.find((item) => item.state?.code === 'TIE11')?.marker).toBe('newer-backup');
  });
"""
pos = text.rfind('\n});')
if pos < 0: raise SystemExit('roomStorageRecovery test closing marker not found')
path.write_text(text[:pos] + insert + text[pos:])

path = Path('tests/browserGameEngine.test.ts')
text = path.read_text()
insert = """

  it('stores authoritative used-tile value and scoring result for presentation/recovery', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: false });
    const player = addPlayer(engine, host.roomCode, 'Result');
    engine.startGame(host.roomCode, host.hostToken);
    const rooms = (engine as unknown as { rooms: Map<string, { questions: Record<string, { responseMode?: 'buzz' | 'text' }> }> }).rooms;
    const record = rooms.get(host.roomCode)!;
    const tile = engine.snapshot(host.roomCode).board!.questions.find((candidate) => !candidate.used && (record.questions[candidate.questionId].responseMode ?? 'buzz') === 'buzz')!;
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, player.playerId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, true);
    const used = engine.snapshot(host.roomCode).board!.questions.find((candidate) => candidate.questionId === tile.questionId)!;
    expect(used.playedValue).toBeGreaterThan(0);
    expect(used.results?.[0]).toMatchObject({ playerId: player.playerId, correct: true });
    expect(used.results?.[0].delta).toBeGreaterThan(0);
  });
"""
pos = text.rfind('\n});')
if pos < 0: raise SystemExit('browserGameEngine test closing marker not found')
path.write_text(text[:pos] + insert + text[pos:])
