import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameSettings, HostRoomCredentials, PackSummary, RoomSnapshot } from '../shared/types';
import { clampDailyDoubleCount, DEFAULT_SETTINGS, QUESTION_VALUES, settingsForGameLength } from '../shared/config';
import { GAME_MODES, gameModeDefinition } from '../shared/gameModes';
import { freeResponseReadingTimer } from '../lib/freeResponseFlow';
import { autoGradeAnswer } from '../shared/validation';
import { emitAck, socket } from '../lib/socket';
import { audio } from '../lib/audio';
import { menuUrl, navigateInApp, resetInstance } from '../lib/resetInstance';
import { calculateComebackAward } from '../lib/comebackScoring';
import { scoreboardWagersVisible, turnIndicatorLabel, turnIndicatorVisible } from '../lib/gameUiRules';
import { PlayerStrip } from './PlayerStrip';
import { Board, type BoardResultMap } from './Board';
import { Timer } from './Timer';
import { AudioMixer } from './AudioMixer';
import { BoardPresentation } from './BoardPresentation';
import { EndgameRecap } from './EndgameRecap';
import { ScoreFlight, type ScoreFlightState } from './ScoreFlight';
import { clearHostCredentials, readActiveHostCredentials, writeHostCredentials } from '../lib/hostCredentials';
import { stripFreshHostFlag } from '../lib/hostSession';
import { randomId } from '../lib/ids';
import { readAccessibility } from '../lib/accessibility';
import { PlayerAvatar } from './PlayerAvatar';
import { normalizePlayerCustomization } from '../shared/playerCustomization';
import { useOutsideDismiss } from '../lib/useOutsideDismiss';
type HostStored = HostRoomCredentials;
type HistoryAttempt = { playerId: string; playerName: string; playerAvatar: string; correct: boolean };
type QuestionHistoryEntry = {
  questionId: string;
  category: string;
  text: string;
  value: number;
  answer: string;
  attempts: HistoryAttempt[];
};

type RevealBeat = 0 | 1 | 2 | 3 | 4;
const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function phaseMusic(state: RoomSnapshot | null) {
  if (!state) return 'lobby' as const;
  if (state.phase.startsWith('final')) return 'final' as const;
  if (state.phase === 'recap') return 'winner' as const;
  if (state.currentQuestion?.dailyDouble) return 'daily-double' as const;
  if (state.phase === 'question') return 'thinking' as const;
  if (state.multiplier === 3) return 'triple' as const;
  if (state.multiplier === 2) return 'double' as const;
  return state.phase === 'lobby' ? 'lobby' as const : 'board' as const;
}

export function HostAppV3() {
  const [credentials, setCredentials] = useState<HostStored | null>(null);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connectionOnline, setConnectionOnline] = useState(socket.connected);
  const [controllerId, setControllerId] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<QuestionHistoryEntry[]>([]);
  const [buzzerCountdown, setBuzzerCountdown] = useState<number | null>(null);
  const [modifierReveal, setModifierReveal] = useState<2 | 3 | null>(null);
  const [scoreFlights, setScoreFlights] = useState<ScoreFlightState[]>([]);
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, number>>({});
  const [revealBeat, setRevealBeat] = useState<RevealBeat>(0);
  const autoBuzzQuestionRef = useRef('');
  const lastMultiplierRef = useRef<1 | 2 | 3 | null>(null);
  const modifierTimerRef = useRef<number | null>(null);
  const revealRunningRef = useRef(false);
  const lastPenaltySnapshotRef = useRef<RoomSnapshot | null>(null);
  const inFlightActionsRef = useRef(new Set<string>());
  const joinModalRef = useRef<HTMLElement | null>(null);
  const joinTriggerRef = useRef<HTMLButtonElement | null>(null);
  const reviewModalRef = useRef<HTMLElement | null>(null);

  useOutsideDismiss(showJoin, () => setShowJoin(false), joinModalRef, joinTriggerRef);
  useOutsideDismiss(Boolean(reviewId), () => setReviewId(null), reviewModalRef);

  const perform = useCallback(async (event: string, payload: Record<string, unknown> = {}): Promise<boolean> => {
    if (!credentials) return false;
    const actionKey = `${event}:${JSON.stringify(payload)}`;
    if (inFlightActionsRef.current.has(actionKey)) return false;
    inFlightActionsRef.current.add(actionKey);
    setError('');
    setBusy(true);
    try {
      await audio.unlock();
      await emitAck(event, { roomCode: credentials.roomCode, hostToken: credentials.hostToken, ...payload });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
      return false;
    } finally {
      inFlightActionsRef.current.delete(actionKey);
      setBusy(false);
    }
  }, [credentials]);

  const rotatePresentationCapability = useCallback(async () => {
    if (!credentials) return;
    setBusy(true);
    setError('');
    try {
      const result = await emitAck<{ presentationToken: string }>('host:rotate-presentation-capability', {
        roomCode: credentials.roomCode,
        hostToken: credentials.hostToken
      });
      const presentationUrl = new URL(credentials.presentationUrl);
      presentationUrl.searchParams.set('display', result.presentationToken);
      const updated = { ...credentials, presentationUrl: presentationUrl.toString() };
      writeHostCredentials(updated);
      setCredentials(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rotate the presentation link');
    } finally {
      setBusy(false);
    }
  }, [credentials]);

  useEffect(() => {
    fetch('/api/packs').then((response) => response.json()).then(setPacks).catch(() => setError('Could not load question packs'));
    const onState = (next: RoomSnapshot) => setRoom(next);
    const onConnect = () => setConnectionOnline(true);
    const onDisconnect = () => setConnectionOnline(false);
    socket.on('room:state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('room:state', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  useEffect(() => {
    const boot = async () => {
      setBusy(true);
      setError('');
      const createFreshRoom = async () => {
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
        const parsed = readActiveHostCredentials();
        if (parsed) {
          try {
            let snapshot = await emitAck<RoomSnapshot>('host:reconnect', { roomCode: parsed.roomCode, hostToken: parsed.hostToken, allowAuthorityTakeover: true });
            if (forceFresh) {
              localStorage.removeItem(`blue-stage-history-${parsed.roomCode}`);
              snapshot = await emitAck<RoomSnapshot>('host:reset-game', { roomCode: parsed.roomCode, hostToken: parsed.hostToken });
              history.replaceState(null, '', stripFreshHostFlag(location.href));
            }
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
              const retryHint = /another host screen/i.test(message)
                ? ''
                : ' Retry when the connection is available.';
              setError(`${message}. Saved room ${parsed.roomCode} was preserved.${retryHint}`);
              return;
            }
            clearHostCredentials(parsed);
          }
        }
        await createFreshRoom();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create room');
      } finally {
        setBusy(false);
      }
    };
    void boot();
    return () => audio.stop();
  }, []);

  useEffect(() => {
    if (!credentials?.joinUrl) return;
    fetch(`/api/qr?value=${encodeURIComponent(credentials.joinUrl)}`)
      .then((response) => response.json())
      .then((data) => setQr(data.dataUrl))
      .catch(() => {});
  }, [credentials?.joinUrl]);

  useEffect(() => {
    if (!room) return;
    const connected = room.players.filter((player) => player.connected);
    const preferred = room.turnPlayerId && connected.some((player) => player.id === room.turnPlayerId) ? room.turnPlayerId : connected[0]?.id ?? '';
    if (preferred !== controllerId) setControllerId(preferred);
  }, [room, controllerId]);

  const musicState = phaseMusic(room);
  useEffect(() => { void audio.setMusic(musicState); }, [musicState]);

  useEffect(() => {
    if (!room || room.phase !== 'lobby' || !credentials) return;
    const updates: Partial<GameSettings> = {};
    if (room.settings.stealsEnabled) updates.stealsEnabled = false;
    if (room.settings.lockRoomOnStart) updates.lockRoomOnStart = false;
    if (room.settings.selectedPackIds.length > 1 || room.settings.mixedPacks) {
      updates.selectedPackIds = [room.settings.selectedPackIds[0] ?? DEFAULT_SETTINGS.selectedPackIds[0]];
      updates.mixedPacks = false;
    }
    if (Object.keys(updates).length) void perform('host:update-settings', { updates });
  }, [room, credentials, perform]);

  useEffect(() => {
    if (!credentials?.roomCode) return;
    try {
      const saved = localStorage.getItem(`blue-stage-history-${credentials.roomCode}`);
      setHistoryEntries(saved ? JSON.parse(saved) as QuestionHistoryEntry[] : []);
    } catch {
      setHistoryEntries([]);
    }
  }, [credentials?.roomCode]);

  const saveHistory = useCallback((updater: (previous: QuestionHistoryEntry[]) => QuestionHistoryEntry[]) => {
    if (!credentials) return;
    setHistoryEntries((previous) => {
      const next = updater(previous);
      localStorage.setItem(`blue-stage-history-${credentials.roomCode}`, JSON.stringify(next));
      return next;
    });
  }, [credentials]);

  useEffect(() => {
    const onScoreUndo = (event: Event) => {
      const restored = (event as CustomEvent<RoomSnapshot>).detail;
      const question = restored?.currentQuestion;
      if (!question) return;
      saveHistory((previous) => previous.map((entry) => entry.questionId === question.questionId
        ? { ...entry, attempts: entry.attempts.slice(0, -1) }
        : entry));
      setScoreFlights([]);
      setScoreOverrides({});
    };
    window.addEventListener('blue-stage:score-undo', onScoreUndo);
    return () => window.removeEventListener('blue-stage:score-undo', onScoreUndo);
  }, [saveHistory]);

  const recordAttempt = useCallback((playerId: string, correct: boolean) => {
    if (!room?.currentQuestion) return;
    const question = room.currentQuestion;
    const player = room.players.find((item) => item.id === playerId);
    if (!player) return;
    saveHistory((previous) => {
      const existing = previous.find((entry) => entry.questionId === question.questionId);
      const base: QuestionHistoryEntry = existing ?? {
        questionId: question.questionId,
        category: question.category,
        text: question.text,
        value: question.effectiveValue,
        answer: question.acceptedAnswers?.[0] ?? '',
        attempts: []
      };
      const attempt = { playerId: player.id, playerName: player.name, playerAvatar: player.avatar, correct };
      const nextEntry = {
        ...base,
        answer: question.acceptedAnswers?.[0] ?? base.answer,
        attempts: [...base.attempts.filter((item) => item.playerId !== player.id), attempt]
      };
      return [...previous.filter((entry) => entry.questionId !== question.questionId), nextEntry];
    });
  }, [room, saveHistory]);

  useEffect(() => {
    const question = room?.currentQuestion;
    if (!question?.answerRevealed) return;
    saveHistory((previous) => {
      const existing = previous.find((entry) => entry.questionId === question.questionId);
      const nextEntry: QuestionHistoryEntry = {
        questionId: question.questionId,
        category: question.category,
        text: question.text,
        value: question.effectiveValue,
        answer: question.acceptedAnswers?.[0] ?? existing?.answer ?? '',
        attempts: existing?.attempts ?? []
      };
      return [...previous.filter((entry) => entry.questionId !== question.questionId), nextEntry];
    });
  }, [room?.currentQuestion, saveHistory]);

  const autoBuzzQuestion = room?.currentQuestion;
  const autoBuzzQuestionId = autoBuzzQuestion?.questionId ?? '';
  const autoBuzzEligible = Boolean(
    autoBuzzQuestionId &&
    room?.phase === 'question' &&
    !autoBuzzQuestion?.dailyDouble &&
    autoBuzzQuestion?.responseMode !== 'text' &&
    !autoBuzzQuestion?.answerRevealed &&
    !autoBuzzQuestion?.buzzOpen &&
    !autoBuzzQuestion?.buzzWinnerId
  );

  useEffect(() => {
    if (!autoBuzzQuestionId) {
      autoBuzzQuestionRef.current = '';
      setBuzzerCountdown(null);
      return;
    }
    if (!autoBuzzEligible) {
      setBuzzerCountdown(null);
      return;
    }
    if (autoBuzzQuestionRef.current === autoBuzzQuestionId) return;
    autoBuzzQuestionRef.current = autoBuzzQuestionId;
    let remaining = 10;
    setBuzzerCountdown(remaining);
    const interval = window.setInterval(() => {
      remaining -= 1;
      setBuzzerCountdown(Math.max(remaining, 0));
    }, 1000);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setBuzzerCountdown(null);
      audio.cue('open');
      void perform('host:open-buzzers');
    }, 10_000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [autoBuzzEligible, autoBuzzQuestionId, perform]);

  useEffect(() => {
    if (!room) return;
    const previous = lastMultiplierRef.current;
    if (previous === null) {
      lastMultiplierRef.current = room.multiplier;
      return;
    }
    if (room.phase !== 'board') return;
    const nextMultiplier = room.multiplier;
    if ((nextMultiplier === 2 || nextMultiplier === 3) && nextMultiplier > previous) {
      if (modifierTimerRef.current !== null) window.clearTimeout(modifierTimerRef.current);
      setModifierReveal(nextMultiplier);
      audio.cue('phase');
      modifierTimerRef.current = window.setTimeout(() => {
        setModifierReveal(null);
        modifierTimerRef.current = null;
      }, 1900);
    }
    lastMultiplierRef.current = nextMultiplier;
  }, [room]);

  useEffect(() => () => {
    if (modifierTimerRef.current !== null) window.clearTimeout(modifierTimerRef.current);
  }, []);

  useEffect(() => {
    if (!room || !room.settings.localBuzzersEnabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || !room.currentQuestion?.buzzOpen) return;
      const seat = Number(event.key);
      const player = room.players.find((candidate) => candidate.connected && candidate.seat === seat);
      if (player) void perform('host:local-buzz', { playerId: player.id });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [room, perform]);

  useEffect(() => {
    if (!room?.settings.controllerBuzzersEnabled || !room.currentQuestion?.buzzOpen) return;
    let frame = 0;
    const previous = new Map<number, boolean[]>();
    const poll = () => {
      navigator.getGamepads?.().forEach((pad, index) => {
        const player = room.players.find((candidate) => candidate.connected && candidate.seat === index + 1);
        if (!pad || !player) return;
        const prev = previous.get(index) ?? [];
        const pressed = pad.buttons.some((button, buttonIndex) => button.pressed && !prev[buttonIndex]);
        previous.set(index, pad.buttons.map((button) => button.pressed));
        if (pressed) void perform('host:local-buzz', { playerId: player.id });
      });
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, [room, perform]);

  useEffect(() => {
    const previous = lastPenaltySnapshotRef.current;
    lastPenaltySnapshotRef.current = room;
    const question = room?.currentQuestion;
    const previousQuestion = previous?.currentQuestion;
    if (!room || !previous || !question?.timedOut || previousQuestion?.questionId !== question.questionId || previousQuestion.timedOut) return;
    const ownerId = question.turnPlayerId;
    if (!ownerId) return;
    const before = previous.players.find((player) => player.id === ownerId);
    const after = room.players.find((player) => player.id === ownerId);
    if (!before || !after || before.score === after.score) return;
    setScoreOverrides((currentOverrides) => ({ ...currentOverrides, [ownerId]: before.score }));
    setScoreFlights((currentFlights) => [...currentFlights, {
      id: randomId('score-flight'),
      questionId: question.questionId,
      playerId: ownerId,
      delta: after.score - before.score,
      correct: false
    }]);
    recordAttempt(ownerId, false);
    audio.cue('wrong');
  }, [room, recordAttempt]);

  const handleScoreImpact = useCallback((flight: ScoreFlightState) => {
    setScoreOverrides((previous) => {
      const next = { ...previous };
      delete next[flight.playerId];
      return next;
    });
  }, []);

  const handleScoreComplete = useCallback((flightId: string) => {
    setScoreFlights((previous) => previous.filter((flight) => flight.id !== flightId));
  }, []);

  const runRevealTension = async () => {
    if (revealRunningRef.current) return false;
    revealRunningRef.current = true;
    if (readAccessibility().reduceMotion) {
      setRevealBeat(4);
      return true;
    }
    setRevealBeat(1);
    audio.cue('phase');
    await sleep(650);
    setRevealBeat(2);
    audio.cue('locked');
    await sleep(750);
    setRevealBeat(3);
    await sleep(750);
    return true;
  };

  const finishRevealTension = () => {
    setRevealBeat(4);
    audio.cue('reveal');
    window.setTimeout(() => {
      setRevealBeat(0);
      revealRunningRef.current = false;
    }, readAccessibility().reduceMotion ? 0 : 1150);
  };

  const cancelRevealTension = () => {
    setRevealBeat(0);
    revealRunningRef.current = false;
  };

  const goMenu = async () => {
    if (room && room.phase !== 'lobby' && room.phase !== 'recap' && room.phase !== 'paused') {
      const paused = await perform('host:pause');
      if (!paused) return;
    }
    audio.stop();
    navigateInApp(menuUrl());
  };
  const resetGame = async (confirmReset = true) => {
    if (!credentials || (confirmReset && !confirm('Start a new game? Players stay connected with the same seats and profiles, while the board, scores, stats, and question history reset.'))) return;
    localStorage.removeItem(`blue-stage-history-${credentials.roomCode}`);
    setHistoryEntries([]);
    setReviewId(null);
    setPresentationMode(false);
    setScoreFlights([]);
    setScoreOverrides({});
    setRevealBeat(0);
    revealRunningRef.current = false;
    autoBuzzQuestionRef.current = '';
    lastMultiplierRef.current = 1;
    await perform('host:reset-game');
  };
  const hardReset = () => {
    if (!confirm('Reset this entire game instance? This clears the room, saved seats, scores, and cached Blue Stage state, then reloads the newest build.')) return;
    audio.stop();
    void resetInstance();
  };

  if (!credentials || !room) {
    return <main className="boot-screen"><div className="brand-mark"><span>BLUE STAGE</span><strong>TRIVIA</strong></div><p>{error || 'Preparing game room…'}</p></main>;
  }

  const current = room.currentQuestion;
  const connectedPlayers = room.players.filter((player) => player.connected);
  const questionParticipants = current?.participantIds
    ? room.players.filter((player) => current.participantIds!.includes(player.id))
    : connectedPlayers;
  const activeQuestionPlayers = questionParticipants.filter((player) => player.connected);
  const reservedSeatCount = room.players.length - connectedPlayers.length;
  const buzzWinner = current?.buzzWinnerId ? room.players.find((player) => player.id === current.buzzWinnerId) : null;
  const dailyPlayer = current?.dailyDoublePlayerId ? room.players.find((player) => player.id === current.dailyDoublePlayerId) : null;
  const spokenPlayer = buzzWinner ?? dailyPlayer ?? null;
  const currentHistory = current ? historyEntries.find((entry) => entry.questionId === current.questionId) : undefined;
  const judgedAttempt = spokenPlayer ? currentHistory?.attempts.find((attempt) => attempt.playerId === spokenPlayer.id) : undefined;
  const reviewPlayerId = room.phase === 'final-review' && room.finalRound
    ? room.finalRound.reviewPlayerId ?? room.finalRound.participantIds[room.finalRound.reviewPlayerIndex]
    : null;
  const reviewPlayer = reviewPlayerId ? room.players.find((player) => player.id === reviewPlayerId) ?? null : null;
  const settings = room.settings;
  const gameMode = gameModeDefinition(settings.gameMode);
  const compatiblePacks = packs.filter((pack) => pack.supportedGameModes.includes(settings.gameMode));
  const updateSettings = (updates: Partial<GameSettings>) => perform('host:update-settings', { updates });
  const selectedPackQuestionCount = compatiblePacks.find((pack) => pack.id === settings.selectedPackIds[0])?.questionCount;
  const dailyDoubleMax = selectedPackQuestionCount ?? Math.max(0, settings.dailyDoubleCount);
  const updateGameLength = (gameLength: GameSettings['gameLength']) => {
    const next = settingsForGameLength(gameLength);
    const dailyDoubleCount = selectedPackQuestionCount === undefined
      ? next.dailyDoubleCount
      : clampDailyDoubleCount(next.dailyDoubleCount, selectedPackQuestionCount);
    return updateSettings({ ...next, dailyDoubleCount, dailyDoublesEnabled: dailyDoubleCount > 0 });
  };
  const textResponses = current?.textResponses ?? {};
  const textResponseCount = activeQuestionPlayers.filter((player) => Boolean(textResponses[player.id])).length;
  const unresolvedTextCount = Object.values(textResponses).filter((response) => response.resolvedCorrect === null).length;
  const missingTextResponseCount = questionParticipants.filter((player) => !textResponses[player.id]).length;
  const pendingTextResultCount = unresolvedTextCount + missingTextResponseCount;
  const groupMissMercyActive = Boolean(
    current?.responseMode === 'text'
    && current.answerRevealed
    && questionParticipants.length > 0
    && questionParticipants.every((player) => {
      const response = textResponses[player.id];
      return !response || !(response.reviewCorrect ?? response.autoCorrect);
    })
  );
  const readingTimer = freeResponseReadingTimer(current, settings, room.serverNow);
  const questionMultiplier = current ? Math.max(1, Math.round(current.effectiveValue / Math.max(1, current.baseValue))) : 1;
  const finalParticipants = room.finalRound
    ? room.players.filter((player) => room.finalRound!.participantIds.includes(player.id))
    : connectedPlayers;
  const pendingFinalWagers = finalParticipants.filter((player) => !player.finalWagerSubmitted).length;
  const resultIds = room.resultPlayerIds ? new Set(room.resultPlayerIds) : null;
  const recapPlayers = resultIds ? room.players.filter((player) => resultIds.has(player.id)) : room.players;
  const pointsAtStake = current ? current.dailyDouble
    ? (current.wager ?? 0) * (settings.dailyDoubleStacksWithMultiplier ? questionMultiplier : 1)
    : current.effectiveValue : 0;
  const boardResults: BoardResultMap = Object.fromEntries(historyEntries.map((entry) => [entry.questionId, entry.attempts.map((attempt) => ({ ...attempt, delta: attempt.correct ? entry.value : -entry.value }))]));
  const showTurnIndicator = turnIndicatorVisible(room.phase);
  const turnLabel = turnIndicatorLabel(room.phase);

  const prepareScoreFlight = (playerId: string, correct: boolean, incorrectPoints = pointsAtStake): ScoreFlightState | null => {
    if (!current) return null;
    const player = room.players.find((item) => item.id === playerId);
    if (!player) return null;
    const comeback = correct && !current.dailyDouble ? calculateComebackAward(room, player, pointsAtStake) : null;
    const awardedPoints = comeback?.points ?? pointsAtStake;
    const signedDelta = correct ? awardedPoints : settings.allowNegativeScores ? -incorrectPoints : -Math.min(Math.max(0, player.score), incorrectPoints);
    // Daily Double scoring is already authoritative when the resolve action returns.
    // Do not visually pin the old score behind the flight animation: a phase transition
    // can interrupt that first flight and make the wager look like it scored nothing.
    if (!current.dailyDouble) {
      setScoreOverrides((previous) => ({ ...previous, [player.id]: player.score }));
    }
    return {
      id: randomId('score-flight'),
      questionId: current.questionId,
      playerId: player.id,
      delta: signedDelta,
      correct,
      comebackBonus: comeback?.bonus ?? 0
    };
  };

  const cancelPreparedScore = (playerId: string) => {
    setScoreOverrides((previous) => {
      const next = { ...previous };
      delete next[playerId];
      return next;
    });
  };

  const resolveSpoken = async (correct: boolean) => {
    if (!spokenPlayer || !current?.answerRevealed) return;
    const flight = prepareScoreFlight(spokenPlayer.id, correct);
    const ok = await perform('host:resolve-answer', { playerId: spokenPlayer.id, correct });
    if (!ok) {
      cancelPreparedScore(spokenPlayer.id);
      return;
    }
    if (flight) setScoreFlights((previous) => [...previous, flight]);
    recordAttempt(spokenPlayer.id, correct);
    audio.cue(correct ? 'correct' : 'wrong');
    await perform('host:advance-board');
  };

  const setTextGrade = async (playerId: string, correct: boolean) => {
    await perform('host:resolve-text', { playerId, correct });
  };

  const confirmTextGrades = async () => {
    const pending = questionParticipants
      .map((player) => {
        const response = textResponses[player.id];
        if (!response) return { playerId: player.id, correct: false };
        if (response.resolvedCorrect !== null) return null;
        return {
          playerId: player.id,
          correct: response.reviewCorrect ?? response.autoCorrect
        };
      })
      .filter((entry): entry is { playerId: string; correct: boolean } => Boolean(entry));
    if (!pending.length) return;

    const missPenalty = groupMissMercyActive ? Math.round(pointsAtStake / 2) : pointsAtStake;
    const prepared = pending.map(({ playerId, correct }) => ({
      playerId,
      correct,
      flight: prepareScoreFlight(playerId, correct, missPenalty)
    }));
    const ok = await perform('host:confirm-text-grades');
    if (!ok) {
      prepared.forEach(({ playerId }) => cancelPreparedScore(playerId));
      return;
    }
    const flights = prepared.flatMap(({ flight }) => flight ? [flight] : []);
    if (flights.length) setScoreFlights((previous) => [...previous, ...flights]);
    prepared.forEach(({ playerId, correct }) => recordAttempt(playerId, correct));
    audio.cue('locked');
  };

  const revealAnswer = async () => {
    if (!current || revealRunningRef.current) return;
    const ok = await perform('host:reveal-answer');
    if (!ok) return;
    audio.cue('reveal');
  };

  const beginFinalReview = async () => {
    if (revealRunningRef.current) return;
    const forceClose = !room.finalRound?.responsesClosed;
    if (forceClose && !confirm('Some Final answers are still being entered. Close submissions and begin review?')) return;
    await runRevealTension();
    const ok = await perform('host:begin-final-review', { forceClose });
    if (!ok) {
      cancelRevealTension();
      return;
    }
    finishRevealTension();
  };

  const selectBoardQuestion = (questionId: string) => {
    void perform('host:select-question', { questionId, dailyDoublePlayerId: controllerId || undefined });
  };

  const permanentlyRemovePlayer = (playerId: string, playerName: string) => {
    if (!confirm(`Permanently remove ${playerName}? Their score, stats, and saved reconnect seat will be erased.`)) return;
    void perform('host:remove-player', { playerId });
  };

  const spectacleText = revealBeat === 1 ? 'LOCK IT IN' : revealBeat === 2 ? 'NO MORE CHANGES' : revealBeat === 3 ? 'THE ANSWER IS…' : 'REVEALED';

  return (
    <main className={`host-shell showcase-host ${presentationMode ? 'host-presentation-mode' : ''}`}>
      <header className="topbar new-topbar showcase-topbar">
        <button className="nav-button" onClick={goMenu}>← Menu</button>
        <div className="mini-brand"><span>BLUE STAGE</span><strong>TRIVIA</strong></div>
        <div className="room-code">ROOM <strong>{room.code}</strong></div>
        <div className={`connection-pill ${connectionOnline ? 'online' : ''}`} role="status" aria-live="polite">{connectionOnline ? 'LIVE' : 'RECONNECTING'}</div>
        <button ref={joinTriggerRef} className="nav-button" onClick={() => setShowJoin(true)}>Join QR</button>
        <button className="nav-button danger-ghost" onClick={() => void resetGame()}>New Game</button>
        <button className="nav-button danger-ghost" onClick={hardReset}>Reset Instance</button>
        <AudioMixer />
      </header>

      {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
      {connectedPlayers.length > 0 && <PlayerStrip players={room.players} activeId={current?.buzzWinnerId ?? current?.dailyDoublePlayerId} turnId={showTurnIndicator ? room.turnPlayerId : null} turnLabel={turnLabel} showWagers={scoreboardWagersVisible(room.phase)} scoreOverrides={scoreOverrides} />}

      {modifierReveal && <div className={`modifier-reveal-overlay x${modifierReveal}`} aria-live="polite"><div className="modifier-reveal-card"><span>{modifierReveal === 2 ? 'FINAL SIX' : 'FINAL THREE'}</span><strong>{modifierReveal === 2 ? 'DOUBLE POINTS' : 'TRIPLE POINTS'}</strong><p>{modifierReveal === 2 ? 'Every question is now worth 2×.' : 'Every remaining question is now worth 3×.'}</p></div></div>}
      {revealBeat > 0 && <div className={`final-reveal-spectacle beat-${revealBeat}`} aria-live="assertive"><div className="final-reveal-card"><small>FINAL ROUND</small><strong>{spectacleText}</strong><div className="reveal-pulse-dots"><i/><i/><i/></div></div></div>}

      {room.phase === 'lobby' && <section className="lobby-layout showcase-lobby">
        <article className="lobby-hero panel-v2">
          <div className="section-kicker">GAME ROOM</div>
          <h1>Take the stage.</h1>
          <p className="lede">{gameMode.id === 'free-response' ? 'Everyone answers each board question at the same time. The player on turn chooses the next question, and the host grades the locked responses after the reveal.' : 'One shared game screen. Phones are controllers. Answers stay hidden until the reveal so the host can play too.'}</p>
          <div className="join-card-v2">
            {qr && <button type="button" className="qr-expand-trigger" onClick={() => setShowJoin(true)} title="Click to enlarge the QR code"><img src={qr} alt="QR code to join the game" /><span>Click to enlarge</span></button>}
            <div><small>SCAN TO JOIN</small><strong>{room.code}</strong><a href={credentials.joinUrl}>{credentials.joinUrl}</a></div>
          </div>
          <div className="player-roster-title"><span>Players</span><b>{connectedPlayers.length}/5 connected</b></div>
          <div className="lobby-players-v2">
            {room.players.length ? room.players.map((player) => {
              const customization = normalizePlayerCustomization(player);
              return <div className={`roster-row ${player.connected ? '' : 'reserved'}`} key={player.id} style={{ '--accent': player.accent } as React.CSSProperties}><span className="roster-avatar"><PlayerAvatar avatarId={player.avatarId} fallback={player.avatar} frameStyle={customization.frameStyle} accent={player.accent} /></span><div><strong>{player.name}</strong><small>{player.connected ? `Seat ${player.seat} · key ${player.seat}` : `Seat ${player.seat} · disconnected · reserved`}</small></div><div className="roster-actions">{player.connected && <button className="seat-pause-button" onClick={() => void perform('host:suspend-player', { playerId: player.id })} title="Temporarily disconnect this controller but keep its seat, score, and reconnect token">Pause seat</button>}<button className="seat-remove-button" onClick={() => permanentlyRemovePlayer(player.id, player.name)} title="Permanently erase this player and reconnect seat">Remove</button></div></div>;
            }) : <div className="empty-roster">No phone players connected. Practice mode still works.</div>}
            {reservedSeatCount > 0 && <div className="reserved-seat-note">{reservedSeatCount} seat{reservedSeatCount === 1 ? '' : 's'} reserved for reconnect.</div>}
          </div>
          <button className="primary-button giant start-button" disabled={busy} onClick={() => void perform('host:start-game')}>Start Game</button>
        </article>

        <article className="settings-card panel-v2">
          <div className="section-kicker">SETUP</div>
          <h2>Game mode</h2>
          <p className="settings-helper">Same board and multiplayer system, different question flow.</p>
          <div className="game-mode-grid-v2">
            {GAME_MODES.map((mode) => {
              const selected = settings.gameMode === mode.id;
              return <button type="button" key={mode.id} aria-pressed={selected} className={`game-mode-card-v2 ${selected ? 'selected' : ''}`} onClick={() => void updateSettings({ gameMode: mode.id })}>
                <strong>{mode.name}</strong><span>{mode.description}</span>
              </button>;
            })}
          </div>
          <h2>Question pack</h2>
          <p className="settings-helper">Choose one pack for this game.</p>
          <div className="pack-grid-v2">{compatiblePacks.map((pack) => {
            const selected = settings.selectedPackIds[0] === pack.id;
            return <button key={pack.id} aria-pressed={selected} className={`pack-card-v2 ${selected ? 'selected' : ''}`} onClick={() => {
              const dailyDoubleCount = clampDailyDoubleCount(settings.dailyDoubleCount, pack.questionCount);
              void updateSettings({ selectedPackIds: [pack.id], mixedPacks: false, dailyDoubleCount, dailyDoublesEnabled: dailyDoubleCount > 0 });
            }}><strong>{pack.title}</strong><span>{pack.theme}</span><small>{pack.questionCount} questions</small></button>;
          })}</div>
          <h2>Rules</h2>
          <div className="settings-grid-v2">
            <label data-tooltip="Quick uses 16 questions, Standard 25, and Marathon 36 including the $1000 row. Changing length resets Daily Doubles to 2, 4, or 6; you can still adjust that count manually afterward.">Game length<select value={settings.gameLength} onChange={(event) => void updateGameLength(event.target.value as GameSettings['gameLength'])}><option value="quick">Quick · 16 questions</option><option value="standard">Standard · 25 questions</option><option value="marathon">Marathon · 36 questions</option></select></label>
            <label data-tooltip="How long players have once answering or buzzing is active. Unlimited disables the countdown.">Answer timer<select value={settings.timerSeconds ?? 'none'} onChange={(event) => void updateSettings({ timerSeconds: event.target.value === 'none' ? null : Number(event.target.value) as GameSettings['timerSeconds'] })}>{[5,10,15,20,30].map((seconds)=><option key={seconds} value={seconds}>{seconds}s</option>)}<option value="none">Unlimited</option></select></label>
            <label data-tooltip={gameMode.id === 'free-response' ? 'How long everyone gets to read the question before answer boxes open.' : 'Reading time only applies to Free Response mode.'}>Reading time<select disabled={gameMode.id !== 'free-response'} value={settings.freeResponseReadSeconds} onChange={(event) => void updateSettings({ freeResponseReadSeconds: Number(event.target.value) })}>{[0,3,5,7,10,15].map((seconds)=><option key={seconds} value={seconds}>{seconds === 0 ? 'Off' : `${seconds}s`}</option>)}</select></label>
            <label data-tooltip="By default, question selection rotates through players in join order. Manual keeps the selected picker until you change it.">Turn rotation<select value={settings.turnOrderMode} onChange={(event) => void updateSettings({ turnOrderMode: event.target.value as GameSettings['turnOrderMode'] })}><option value="join-order">Join order · rotate</option><option value="manual">Manual · host selects</option></select></label>
            <label data-tooltip={gameMode.dailyDoubles ? `How many hidden Daily Doubles are placed on the board. Maximum for this pack: ${dailyDoubleMax}.` : 'Free Response keeps standard board questions open to everyone, so Daily Doubles are disabled in this mode.'}>Daily Doubles<input type="number" min="0" max={dailyDoubleMax} step="1" disabled={!gameMode.dailyDoubles} value={gameMode.dailyDoubles ? settings.dailyDoubleCount : 0} onChange={(event) => void updateSettings({ dailyDoubleCount: Number(event.target.value), dailyDoublesEnabled: Number(event.target.value) > 0 })} onBlur={(event) => {
              const dailyDoubleCount = clampDailyDoubleCount(Number(event.currentTarget.value), dailyDoubleMax);
              if (dailyDoubleCount !== settings.dailyDoubleCount) void updateSettings({ dailyDoubleCount, dailyDoublesEnabled: dailyDoubleCount > 0 });
            }} /></label>
            <label data-tooltip="Misses in a row before the Cold Streak effect appears.">Cold streak<input type="number" min="2" max="8" value={settings.coldStreakThreshold} onChange={(event) => void updateSettings({ coldStreakThreshold: Number(event.target.value) })} /></label>
          </div>
          <div className="toggle-grid-v2">
            <label className="toggle-v2" data-tooltip="Allow incorrect answers to push a player's score below zero."><input type="checkbox" checked={settings.allowNegativeScores} onChange={(event) => void updateSettings({ allowNegativeScores: event.target.checked })} /><span>Negative scores</span></label>
            <label className="toggle-v2" data-tooltip="The last six board questions are worth 2× and the last three are worth 3×."><input type="checkbox" checked={settings.lateGameModifiers} onChange={(event) => void updateSettings({ lateGameModifiers: event.target.checked })} /><span>Double / Triple finale</span></label>
            <label className="toggle-v2" data-tooltip={gameMode.dailyDoubles ? "Late-game 2× and 3× multipliers also multiply Daily Double wagers." : "Daily Doubles are disabled in Free Response mode."}><input type="checkbox" disabled={!gameMode.dailyDoubles} checked={settings.dailyDoubleStacksWithMultiplier} onChange={(event) => void updateSettings({ dailyDoubleStacksWithMultiplier: event.target.checked })} /><span>Stack Daily Double</span></label>
            <label className="toggle-v2" data-tooltip="Show On Fire and Cold Streak effects based on consecutive results."><input type="checkbox" checked={settings.streaksEnabled} onChange={(event) => void updateSettings({ streaksEnabled: event.target.checked })} /><span>Streaks</span></label>
            <label className="toggle-v2" data-tooltip="After the board, play a secret-wager final question."><input type="checkbox" checked={settings.finalRoundEnabled} onChange={(event) => void updateSettings({ finalRoundEnabled: event.target.checked })} /><span>Final Round</span></label>
            <label className="toggle-v2" data-tooltip={gameMode.buzzerControls ? "Use number keys 1 through 5 as local buzzers on the host computer." : "Free Response uses simultaneous phone answers instead of buzzers."}><input type="checkbox" disabled={!gameMode.buzzerControls} checked={settings.localBuzzersEnabled} onChange={(event) => void updateSettings({ localBuzzersEnabled: event.target.checked })} /><span>Keyboard buzzers</span></label>
            <label className="toggle-v2" data-tooltip={gameMode.buzzerControls ? "Allow connected game controllers to buzz for players." : "Free Response uses simultaneous phone answers instead of buzzers."}><input type="checkbox" disabled={!gameMode.buzzerControls} checked={settings.controllerBuzzersEnabled} onChange={(event) => void updateSettings({ controllerBuzzersEnabled: event.target.checked })} /><span>Gamepad buzzers</span></label>
          </div>
          <p className="reveal-first-note">The room stays open throughout the game so disconnected phones can reclaim their reserved seats.</p>
        </article>
      </section>}

      {room.phase === 'board' && room.board && <section className="game-stage board-stage-v2 showcase-board-stage">
        <div className="board-header-v2">
          <div><div className="section-kicker">ROUND IN PROGRESS</div><strong>{room.remainingQuestions} questions left</strong><small className="game-mode-pill">{connectedPlayers.length ? gameMode.name : `PRACTICE · ${gameMode.name}`}</small></div>
          <div className="board-actions">
            {connectedPlayers.length > 0 && <label className="turn-selector">Turn<select value={controllerId} onChange={(event) => { const playerId = event.target.value; setControllerId(playerId); void perform('host:set-turn-player', { playerId }); }}>{connectedPlayers.map((player) => <option key={player.id} value={player.id}>{player.avatar} {player.name}</option>)}</select></label>}
            <button className="nav-button" onClick={() => void perform('host:pause')}>Pause</button>
            <button className="nav-button" onClick={() => setPresentationMode(true)}>Presentation</button>
          </div>
        </div>
        {room.multiplier > 1 && <div className={`modifier-banner x${room.multiplier}`}><span>{room.multiplier === 2 ? 'FINAL SIX' : 'FINAL THREE'}</span><strong>{room.multiplier === 2 ? 'DOUBLE POINTS' : 'TRIPLE POINTS'}</strong></div>}
        <Board board={room.board} multiplier={room.multiplier} onSelect={selectBoardQuestion} onReview={(questionId) => setReviewId(questionId)} results={boardResults} />
        <ScoreControls room={room} onAdjust={(playerId, delta) => void perform('host:adjust-score', { playerId, delta })} />
      </section>}

      {room.phase === 'paused' && <section className="full-state"><div className="state-card"><div className="section-kicker">PAUSED</div><h1>Game paused</h1><button className="primary-button giant" onClick={() => void perform('host:resume')}>Resume</button></div></section>}

      {room.phase === 'daily-double-wager' && current && <section className="question-stage daily-double-v2"><div className="question-card-v2"><div className="daily-double-burst">DAILY DOUBLE</div><h1>{dailyPlayer?.avatar} {dailyPlayer?.name}, choose your wager</h1><p className="helper-copy">Choose a preset here, or let {dailyPlayer?.name ?? 'the player'} choose on their phone.</p><div className="wager-grid fixed-wagers">{QUESTION_VALUES.map((value) => <button key={value} onClick={() => void perform('host:daily-double-wager', { wager: value })}>{value.toLocaleString()}</button>)}</div><button className="text-button" onClick={() => void perform('host:cancel-question')}>Exit question</button></div></section>}

      {(room.phase === 'question' || room.phase === 'daily-double-question') && current && <section className={`question-stage ${current.dailyDouble ? 'daily-double-v2' : ''} ${current.answerRevealed ? 'answer-visible' : ''}`}>
        <article className="question-card-v2 showcase-question-card" data-question-id={current.questionId}>
          <div className="question-meta-v2">
            <span>{current.category}</span>
            {current.dailyDouble ? <strong>{questionMultiplier > 1 && settings.dailyDoubleStacksWithMultiplier ? `WAGER ${(current.wager ?? 0).toLocaleString()} × ${questionMultiplier}` : `WAGER ${(current.wager ?? 0).toLocaleString()}`}</strong> : questionMultiplier > 1 ? <strong className={`inline-modifier x${questionMultiplier}`}>{current.baseValue} × {questionMultiplier} = {current.effectiveValue} POINTS</strong> : <strong>{current.effectiveValue} POINTS</strong>}
            {current.responseMode === 'text' && <em>{gameMode.questionBadge}</em>}
          </div>
          {questionMultiplier > 1 && <div className={`question-modifier-strip x${questionMultiplier}`}>{questionMultiplier === 2 ? 'DOUBLE POINT QUESTION' : 'TRIPLE POINT QUESTION'}</div>}
          {current.dailyDouble && current.wager !== null && <div className="stake-banner-v2 daily-double-stake"><small>{dailyPlayer?.avatar} {dailyPlayer?.name} LOCKED IN</small><strong>{current.wager.toLocaleString()} WAGER</strong><span>{settings.dailyDoubleStacksWithMultiplier && questionMultiplier > 1 ? `${current.wager.toLocaleString()} × ${questionMultiplier} = ` : ''}{pointsAtStake.toLocaleString()} POINTS IN PLAY</span></div>}
          <h1>{current.text}</h1>
          {current.answerRevealed && <div className="answer-reveal-v2"><small>CORRECT ANSWER</small><strong>{current.acceptedAnswers?.join(' / ')}</strong></div>}
          {!current.answerRevealed && <Timer timer={room.timer} serverNow={room.serverNow} />}

          {current.responseMode !== 'text' && !current.answerRevealed && buzzerCountdown !== null && !current.buzzOpen && !current.buzzWinnerId && <div className="countdown-panel"><small>BUZZERS OPEN IN</small><strong>{buzzerCountdown || 'GO'}</strong></div>}
          {current.responseMode !== 'text' && !current.answerRevealed && current.buzzOpen && !current.buzzWinnerId && <div className="buzzer-live-banner">BUZZERS LIVE</div>}
          {buzzWinner && (() => { const customization = normalizePlayerCustomization(buzzWinner); return <div className="winner-chip" style={{ '--accent': buzzWinner.accent } as React.CSSProperties}><PlayerAvatar avatarId={buzzWinner.avatarId} fallback={buzzWinner.avatar} frameStyle={customization.frameStyle} accent={buzzWinner.accent} /><span>{buzzWinner.name}</span><b>BUZZED IN</b></div>; })()}

          {current.responseMode === 'text' && !current.answerRevealed && readingTimer && <div className="reading-countdown-v2"><small>READING TIME · ANSWERS OPEN IN</small><Timer timer={readingTimer} serverNow={room.serverNow} /><span>Answer entry stays locked until this countdown finishes.</span></div>}
          {current.responseMode === 'text' && !current.answerRevealed && !readingTimer && <div className="response-progress"><strong>{textResponseCount}/{activeQuestionPlayers.length}</strong><span>responses locked in</span><small>Answer entry is open. The answer reveals automatically when every active player submits or the answer timer expires.</small></div>}


          {current.responseMode === 'text' && current.answerRevealed && <>
            {groupMissMercyActive && <p className="helper-copy"><strong>GROUP MISS MERCY:</strong> nobody is currently marked correct, so each miss will cost half points.</p>}
            <div className="grading-grid">
            {questionParticipants.map((player) => {
              const response = textResponses[player.id];
              if (!response) {
                const noResponsePenalty = groupMissMercyActive ? Math.round(pointsAtStake / 2) : pointsAtStake;
                return <div className="grading-row muted-row" key={player.id}><span>{player.avatar}</span><div><strong>{player.name}</strong><p>No response</p><small>Counts as an incorrect answer</small></div><b className="grade-wrong">-{noResponsePenalty.toLocaleString()}</b></div>;
              }
              const autoLabel = response.autoCorrect ? 'Auto: likely correct' : 'Auto: likely incorrect';
              const draftCorrect = response.reviewCorrect ?? response.autoCorrect;
              return <div className="grading-row" key={player.id}><span>{player.avatar}</span><div><strong>{player.name}</strong><p>{response.answer || 'Response locked'}</p><small>{autoLabel} · {response.autoConfidence} confidence</small></div>{response.resolvedCorrect === null ? <div className="grade-actions" role="group" aria-label={`Grade ${player.name}`}><button aria-pressed={draftCorrect} className={`correct-button grade-choice ${draftCorrect ? 'selected' : ''}`} onClick={() => void setTextGrade(player.id, true)}>Correct</button><button aria-pressed={!draftCorrect} className={`wrong-button grade-choice ${!draftCorrect ? 'selected' : ''}`} onClick={() => void setTextGrade(player.id, false)}>Incorrect</button></div> : <b className={response.resolvedCorrect ? 'grade-correct' : 'grade-wrong'}>{response.resolvedCorrect ? 'AWARDED' : 'REJECTED'}</b>}</div>;
            })}
            </div>
          </>}

          {current.responseMode !== 'text' && current.answerRevealed && spokenPlayer && !current.timedOut && !judgedAttempt && <div className="judge-after-reveal"><small>NOW JUDGE THE RESPONSE</small><strong>{spokenPlayer.avatar} {spokenPlayer.name}</strong><div><button className="correct-button judge-big" onClick={() => void resolveSpoken(true)}>Correct</button><button className="wrong-button judge-big" onClick={() => void resolveSpoken(false)}>Incorrect</button></div></div>}

          <div className="control-row-v2">
            {current.responseMode !== 'text' && !current.dailyDouble && !current.buzzWinnerId && !current.answerRevealed && <button className="primary-button" onClick={() => { audio.cue('open'); void perform(current.buzzOpen ? 'host:close-buzzers' : 'host:open-buzzers'); }}>{current.buzzOpen ? 'Lock Buzzers' : 'Open Buzzers Now'}</button>}
            {current.responseMode !== 'text' && !current.answerRevealed && <button className="secondary-button reveal-button" disabled={revealBeat > 0} onClick={() => void revealAnswer()}>Reveal Answer</button>}
            {current.responseMode === 'text' && !current.answerRevealed && !readingTimer && <button className="secondary-button reveal-button" disabled={busy} onClick={() => void revealAnswer()}>Close Responses & Reveal</button>}
            {current.answerRevealed && current.responseMode !== 'text' && (!spokenPlayer || current.timedOut) && <button className="primary-button" onClick={() => void perform('host:advance-board')}>Continue to Board</button>}
            {current.answerRevealed && current.responseMode === 'text' && pendingTextResultCount > 0 && <button className="primary-button confirm-grades-button" disabled={busy} onClick={() => void confirmTextGrades()}>Confirm Results</button>}
            {!current.answerRevealed && current.attemptedPlayerIds.length === 0 && Object.keys(current.textResponses ?? {}).length === 0 && current.wager === null && <button className="secondary-button" onClick={() => { autoBuzzQuestionRef.current = ''; void perform('host:cancel-question'); }}>Exit Without Answering</button>}
          </div>
        </article>
      </section>}

      {room.phase === 'final-category' && room.finalRound && <section className="question-stage final-stage"><article className="question-card-v2"><div className="section-kicker gold">FINAL ROUND</div><h1>{room.finalRound.category}</h1><button className="primary-button giant" onClick={() => void perform('host:begin-final-wagers')}>Open Secret Wagers</button></article></section>}
      {room.phase === 'final-wager' && <section className="question-stage final-stage"><article className="question-card-v2"><div className="section-kicker gold">FINAL ROUND</div><h1>Lock in your wagers</h1><SubmissionStatus players={finalParticipants} field="finalWagerSubmitted" />{pendingFinalWagers > 0 && <p className="helper-copy">{pendingFinalWagers} connected player{pendingFinalWagers === 1 ? '' : 's'} still waiting. You can start anyway; missing wagers become 0.</p>}<button className="primary-button giant" disabled={busy} onClick={() => void perform('host:open-final-question')}>Start Final Question</button></article></section>}
      {room.phase === 'final-question' && room.finalRound && <section className="question-stage final-stage"><article className="question-card-v2"><div className="section-kicker gold">FINAL QUESTION · {room.finalRound.category}</div><h1>{room.finalRound.question}</h1><Timer timer={room.timer} serverNow={room.serverNow}/><SubmissionStatus players={finalParticipants} field="finalAnswerSubmitted"/><p className="helper-copy">When you are ready, start the reveal. The answer stays hidden until the host triggers it.</p><button className="secondary-button final-reveal-trigger" disabled={busy || revealBeat > 0} onClick={() => void beginFinalReview()}>Build Tension & Reveal</button></article></section>}
      {room.phase === 'final-review' && reviewPlayer && room.finalRound && <section className="question-stage final-stage"><article className="question-card-v2"><div className="section-kicker gold">FINAL REVIEW {room.finalRound.participantIds.findIndex((playerId) => playerId === reviewPlayer.id) + 1}/{room.finalRound.participantIds.length}</div><div className="answer-reveal-v2"><small>CORRECT ANSWER</small><strong>{room.finalRound.acceptedAnswers.join(' / ')}</strong></div><h1 className="review-player-title"><PlayerAvatar avatarId={reviewPlayer.avatarId} fallback={reviewPlayer.avatar} frameStyle={normalizePlayerCustomization(reviewPlayer).frameStyle} accent={reviewPlayer.accent} /> {reviewPlayer.name}</h1><div className="final-response-v2"><span><small>WAGER</small><strong>{reviewPlayer.finalWager ?? 0}</strong></span><span><small>RESPONSE</small><strong>{reviewPlayer.finalAnswer || '(No answer)'}</strong></span></div>{(() => { const suggestion = autoGradeAnswer(reviewPlayer.finalAnswer ?? '', room.finalRound!.acceptedAnswers); return <div className={`auto-grade ${suggestion.correct ? 'suggest-correct' : 'suggest-wrong'}`}>Auto grade: {suggestion.correct ? 'likely correct' : 'likely incorrect'} · {suggestion.confidence} confidence</div>; })()}<p className="helper-copy">Auto grade is a suggestion. The host has final scoring authority.</p><div className="control-row-v2"><button className="correct-button" onClick={()=>void perform('host:resolve-final',{playerId:reviewPlayer.id,correct:true})}>Award</button><button className="wrong-button" onClick={()=>void perform('host:resolve-final',{playerId:reviewPlayer.id,correct:false})}>Reject</button></div></article></section>}

      {room.phase === 'recap' && <EndgameRecap players={recapPlayers} onNewGame={() => void resetGame(false)} onMenu={goMenu} />}

      {showJoin && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Join game"><section ref={joinModalRef} tabIndex={-1} className="modal-card join-modal-v2 expanded-qr-modal"><button className="modal-close" data-modal-initial-focus onClick={() => setShowJoin(false)} aria-label="Close">×</button><div className="section-kicker">JOIN GAME</div>{qr && <img src={qr} alt="QR code to join or reconnect to the game" />}<strong className="modal-room-code">{room.code}</strong><a href={credentials.joinUrl}>{credentials.joinUrl}</a><p>Returning players reconnect to the same reserved seat on the same phone and browser.</p><div className="presentation-link-controls"><small>DISPLAY LINK · Anyone with this link can view the shared screen.</small><a href={credentials.presentationUrl} target="_blank" rel="noreferrer">Open presentation display</a><button className="secondary-button" disabled={busy} onClick={() => void rotatePresentationCapability()}>Rotate display link</button><p className="helper-copy">Rotating immediately disconnects displays using the old link.</p></div></section></div>}

      {reviewId && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Question review"><section ref={reviewModalRef} tabIndex={-1} className="modal-card review-modal-v2"><button className="modal-close" data-modal-initial-focus onClick={() => setReviewId(null)} aria-label="Close">×</button>{(() => {
        const entry = historyEntries.find((item) => item.questionId === reviewId);
        const tile = room.board?.questions.find((item) => item.questionId === reviewId);
        if (!entry) return <><div className="section-kicker">USED QUESTION</div><h2>{tile?.category}</h2><p>No answer history was recorded for this question.</p></>;
        return <><div className="section-kicker">{entry.category} · {entry.value} POINTS</div><h2>{entry.text}</h2><div className="review-answer-v2"><small>ANSWER</small><strong>{entry.answer || 'Not revealed'}</strong></div><div className="attempt-list">{entry.attempts.length ? entry.attempts.map((attempt) => <div className={`attempt-row ${attempt.correct ? 'correct' : 'wrong'}`} key={attempt.playerId}><span>{attempt.playerAvatar}</span><strong>{attempt.playerName}</strong><b>{attempt.correct ? 'CORRECT' : 'INCORRECT'}</b></div>) : <p className="muted">No player response recorded.</p>}</div></>;
      })()}</section></div>}

      {presentationMode && room.phase === 'board' && <BoardPresentation room={room} onBack={() => setPresentationMode(false)} onSelect={selectBoardQuestion} onReview={(questionId) => setReviewId(questionId)} results={boardResults} scoreOverrides={scoreOverrides} />}
      {scoreFlights[0] && <ScoreFlight flight={scoreFlights[0]} onImpact={handleScoreImpact} onComplete={handleScoreComplete} />}
    </main>
  );
}

function ScoreControls({ room, onAdjust }: { room: RoomSnapshot; onAdjust: (playerId: string, delta: number) => void }) {
  const players = room.players.filter((player) => player.connected);
  if (!players.length) return null;
  return <div className="score-controls-v2">{players.map((player)=><div key={player.id}><span>{player.avatar} {player.name}</span><button onClick={()=>onAdjust(player.id,-100)}>-100</button><button onClick={()=>onAdjust(player.id,100)}>+100</button></div>)}</div>;
}

function SubmissionStatus({ players, field }: { players: RoomSnapshot['players']; field: 'finalWagerSubmitted' | 'finalAnswerSubmitted' }) {
  if (!players.length) return <div className="submission-list-v2"><p className="muted">No connected phone players.</p></div>;
  return <div className="submission-list-v2">{players.map((player)=><div key={player.id} className={player[field] ? 'done' : ''}><span>{player.avatar}</span><strong>{player.name}</strong><small>{player[field] ? field === 'finalWagerSubmitted' ? 'Wager locked' : 'Answer locked' : 'Waiting'}</small></div>)}</div>;
}
