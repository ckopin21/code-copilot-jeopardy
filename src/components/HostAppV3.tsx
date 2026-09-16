import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameSettings, HostRoomCredentials, PackSummary, RoomSnapshot } from '../shared/types';
import { DEFAULT_SETTINGS, QUESTION_VALUES } from '../shared/config';
import { autoGradeAnswer } from '../shared/validation';
import { emitAck, socket } from '../lib/socket';
import { audio } from '../lib/audio';
import { menuUrl, resetInstance } from '../lib/resetInstance';
import { PlayerStrip } from './PlayerStrip';
import { Board } from './Board';
import { Timer } from './Timer';
import { AudioMixer } from './AudioMixer';

const HOST_KEY = 'blue-stage-host-room';
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
  const [controllerId, setControllerId] = useState('');
  const [customWager, setCustomWager] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<QuestionHistoryEntry[]>([]);
  const [buzzerCountdown, setBuzzerCountdown] = useState<number | null>(null);
  const [modifierReveal, setModifierReveal] = useState<2 | 3 | null>(null);
  const autoBuzzQuestionRef = useRef('');
  const lastMultiplierRef = useRef<1 | 2 | 3 | null>(null);
  const modifierTimerRef = useRef<number | null>(null);

  const perform = useCallback(async (event: string, payload: Record<string, unknown> = {}): Promise<boolean> => {
    if (!credentials) return false;
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
      setBusy(false);
    }
  }, [credentials]);

  useEffect(() => {
    fetch('/api/packs').then((response) => response.json()).then(setPacks).catch(() => setError('Could not load question packs'));
    const onState = (next: RoomSnapshot) => setRoom(next);
    socket.on('room:state', onState);
    return () => socket.off('room:state', onState);
  }, []);

  useEffect(() => {
    const boot = async () => {
      setBusy(true);
      setError('');
      const createFreshRoom = async () => {
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
    if (!connected.some((player) => player.id === controllerId)) setControllerId(connected[0]?.id ?? '');
  }, [room, controllerId]);

  const musicState = phaseMusic(room);
  useEffect(() => { void audio.setMusic(musicState); }, [musicState]);

  useEffect(() => {
    if (!room || room.phase !== 'lobby' || !room.settings.stealsEnabled || !credentials) return;
    void perform('host:update-settings', { updates: { stealsEnabled: false } });
  }, [room?.phase, room?.settings.stealsEnabled, credentials, perform]);

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
  }, [room?.currentQuestion?.answerRevealed, room?.currentQuestion?.questionId, room?.currentQuestion?.acceptedAnswers, saveHistory]);

  useEffect(() => {
    const current = room?.currentQuestion;
    if (!current) {
      autoBuzzQuestionRef.current = '';
      setBuzzerCountdown(null);
      return;
    }
    if (room?.phase !== 'question' || current.dailyDouble || current.responseMode === 'text' || current.answerRevealed || current.buzzOpen || current.buzzWinnerId) {
      setBuzzerCountdown(null);
      return;
    }
    if (autoBuzzQuestionRef.current === current.questionId) return;
    autoBuzzQuestionRef.current = current.questionId;
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
  }, [room?.currentQuestion?.questionId, room?.currentQuestion?.buzzOpen, room?.currentQuestion?.buzzWinnerId, room?.currentQuestion?.answerRevealed, room?.currentQuestion?.responseMode, room?.phase, perform]);

  useEffect(() => {
    if (!room) return;
    const previous = lastMultiplierRef.current;
    if (previous === null) {
      lastMultiplierRef.current = room.multiplier;
      return;
    }
    if (room.phase !== 'board') {
      setModifierReveal(null);
      lastMultiplierRef.current = room.multiplier;
      return;
    }
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
  }, [room?.multiplier, room?.phase]);

  useEffect(() => () => {
    if (modifierTimerRef.current !== null) window.clearTimeout(modifierTimerRef.current);
  }, []);

  useEffect(() => {
    if (!room || !room.settings.localBuzzersEnabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || !room.currentQuestion?.buzzOpen) return;
      const activePlayers = room.players.filter((player) => player.connected);
      const index = Number(event.key) - 1;
      if (index >= 0 && index < activePlayers.length) void perform('host:local-buzz', { playerId: activePlayers[index].id });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [room, perform]);

  useEffect(() => {
    if (!room?.settings.controllerBuzzersEnabled || !room.currentQuestion?.buzzOpen) return;
    let frame = 0;
    const previous = new Map<number, boolean[]>();
    const activePlayers = room.players.filter((player) => player.connected);
    const poll = () => {
      navigator.getGamepads?.().forEach((pad, index) => {
        if (!pad || !activePlayers[index]) return;
        const prev = previous.get(index) ?? [];
        const pressed = pad.buttons.some((button, buttonIndex) => button.pressed && !prev[buttonIndex]);
        previous.set(index, pad.buttons.map((button) => button.pressed));
        if (pressed) void perform('host:local-buzz', { playerId: activePlayers[index].id });
      });
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, [room, perform]);

  const winner = useMemo(() => {
    if (!room?.players.length) return null;
    const max = Math.max(...room.players.map((player) => player.score));
    return room.players.filter((player) => player.score === max);
  }, [room]);

  const goMenu = () => { audio.stop(); location.href = menuUrl(); };
  const resetGame = async () => {
    if (!credentials || !confirm('Reset this game? Players stay in the room, but the board, scores, and history will reset.')) return;
    localStorage.removeItem(`blue-stage-history-${credentials.roomCode}`);
    setHistoryEntries([]);
    setReviewId(null);
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
  const reservedSeatCount = room.players.length - connectedPlayers.length;
  const buzzWinner = current?.buzzWinnerId ? room.players.find((player) => player.id === current.buzzWinnerId) : null;
  const dailyPlayer = current?.dailyDoublePlayerId ? room.players.find((player) => player.id === current.dailyDoublePlayerId) : null;
  const spokenPlayer = buzzWinner ?? dailyPlayer ?? null;
  const currentHistory = current ? historyEntries.find((entry) => entry.questionId === current.questionId) : undefined;
  const judgedAttempt = spokenPlayer ? currentHistory?.attempts.find((attempt) => attempt.playerId === spokenPlayer.id) : undefined;
  const reviewPlayer = room.phase === 'final-review' && room.finalRound ? room.players[room.finalRound.reviewPlayerIndex] : null;
  const settings = room.settings;
  const updateSettings = (updates: Partial<GameSettings>) => perform('host:update-settings', { updates });
  const showJoinControl = room.phase === 'lobby' || room.phase === 'board';
  const textResponses = current?.textResponses ?? {};
  const textResponseCount = connectedPlayers.filter((player) => Boolean(textResponses[player.id])).length;
  const unresolvedTextCount = Object.values(textResponses).filter((response) => response.resolvedCorrect === null).length;
  const questionMultiplier = current ? Math.max(1, Math.round(current.effectiveValue / Math.max(1, current.baseValue))) : 1;
  const pendingFinalWagers = connectedPlayers.filter((player) => !player.finalWagerSubmitted).length;

  const resolveSpoken = async (correct: boolean) => {
    if (!spokenPlayer || !current?.answerRevealed) return;
    const ok = await perform('host:resolve-answer', { playerId: spokenPlayer.id, correct });
    if (!ok) return;
    recordAttempt(spokenPlayer.id, correct);
    setControllerId(spokenPlayer.id);
    audio.cue(correct ? 'correct' : 'wrong');
    if (!correct && !current.dailyDouble && room.settings.stealsEnabled) await perform('host:close-buzzers');
  };

  const resolveText = async (playerId: string, correct: boolean) => {
    const ok = await perform('host:resolve-text', { playerId, correct });
    if (!ok) return;
    recordAttempt(playerId, correct);
    audio.cue(correct ? 'correct' : 'wrong');
  };

  const revealAnswer = async () => {
    const ok = await perform('host:reveal-answer');
    if (ok) audio.cue('reveal');
  };

  const canReturnToBoard = Boolean(current?.answerRevealed) && (
    current?.responseMode === 'text'
      ? unresolvedTextCount === 0
      : !spokenPlayer || Boolean(judgedAttempt)
  );

  return (
    <main className="host-shell showcase-host">
      <header className="topbar new-topbar showcase-topbar">
        <button className="nav-button" onClick={goMenu}>← Menu</button>
        <div className="mini-brand"><span>BLUE STAGE</span><strong>TRIVIA</strong></div>
        <div className="room-code">ROOM <strong>{room.code}</strong></div>
        <div className={`connection-pill ${socket.connected ? 'online' : ''}`}>{socket.connected ? 'LIVE' : 'RECONNECTING'}</div>
        {showJoinControl && <button className="nav-button" onClick={() => setShowJoin(true)}>Join QR</button>}
        <button className="nav-button danger-ghost" onClick={() => void resetGame()}>Reset Game</button>
        <button className="nav-button danger-ghost" onClick={hardReset}>Reset Instance</button>
        <AudioMixer />
      </header>

      {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
      <PlayerStrip players={room.players} activeId={current?.buzzWinnerId ?? current?.dailyDoublePlayerId} />

      {modifierReveal && <div className={`modifier-reveal-overlay x${modifierReveal}`} aria-live="polite"><div className="modifier-reveal-card"><span>{modifierReveal === 2 ? 'FINAL SIX' : 'FINAL THREE'}</span><strong>{modifierReveal === 2 ? 'DOUBLE POINTS' : 'TRIPLE POINTS'}</strong><p>{modifierReveal === 2 ? 'Every clue is now worth 2×.' : 'Every remaining clue is now worth 3×.'}</p></div></div>}

      {room.phase === 'lobby' && <section className="lobby-layout showcase-lobby">
        <article className="lobby-hero panel-v2">
          <div className="section-kicker">GAME ROOM</div>
          <h1>Take the stage.</h1>
          <p className="lede">One shared game screen. Phones are controllers. Answers stay hidden until the reveal so the host can play too.</p>
          <div className="join-card-v2">
            {qr && <img src={qr} alt="QR code to join the game" />}
            <div><small>SCAN TO JOIN</small><strong>{room.code}</strong><a href={credentials.joinUrl}>{credentials.joinUrl}</a></div>
          </div>
          <div className="player-roster-title"><span>Players</span><b>{connectedPlayers.length}/5</b></div>
          <div className="lobby-players-v2">
            {connectedPlayers.length ? connectedPlayers.map((player, index) => <div className="roster-row" key={player.id}><span className="roster-avatar">{player.avatar}</span><div><strong>{player.name}</strong><small>Connected · key {index + 1}</small></div><button className="icon-button danger" onClick={() => void perform('host:remove-player', { playerId: player.id })} aria-label={`Remove ${player.name}`}>×</button></div>) : <div className="empty-roster">No phone players connected. Practice mode still works.</div>}
            {reservedSeatCount > 0 && <div className="reserved-seat-note">{reservedSeatCount} seat{reservedSeatCount === 1 ? '' : 's'} reserved for reconnect.</div>}
          </div>
          <button className="primary-button giant start-button" disabled={busy} onClick={() => void perform('host:start-game')}>Start Game</button>
        </article>

        <article className="settings-card panel-v2">
          <div className="section-kicker">SETUP</div>
          <h2>Question pack</h2>
          <div className="pack-grid-v2">{packs.map((pack) => {
            const selected = settings.selectedPackIds.includes(pack.id);
            return <button key={pack.id} className={`pack-card-v2 ${selected ? 'selected' : ''}`} onClick={() => {
              const ids = selected ? settings.selectedPackIds.filter((id) => id !== pack.id) : [...settings.selectedPackIds, pack.id];
              if (ids.length) void updateSettings({ selectedPackIds: ids, mixedPacks: ids.length > 1 });
            }}><strong>{pack.title}</strong><span>{pack.theme}</span><small>{pack.questionCount} questions</small></button>;
          })}</div>
          <h2>Rules</h2>
          <div className="settings-grid-v2">
            <label>Game length<select value={settings.gameLength} onChange={(event) => void updateSettings({ gameLength: event.target.value as GameSettings['gameLength'] })}><option value="quick">Quick</option><option value="standard">Standard</option><option value="marathon">Marathon</option></select></label>
            <label>Answer timer<select value={settings.timerSeconds ?? 'none'} onChange={(event) => void updateSettings({ timerSeconds: event.target.value === 'none' ? null : Number(event.target.value) as GameSettings['timerSeconds'] })}>{[5,10,15,20,30].map((seconds)=><option key={seconds} value={seconds}>{seconds}s</option>)}<option value="none">Unlimited</option></select></label>
            <label>Daily Doubles<input type="number" min="0" max="6" value={settings.dailyDoubleCount} onChange={(event) => void updateSettings({ dailyDoubleCount: Number(event.target.value), dailyDoublesEnabled: Number(event.target.value) > 0 })} /></label>
            <label>Cold streak<input type="number" min="2" max="8" value={settings.coldStreakThreshold} onChange={(event) => void updateSettings({ coldStreakThreshold: Number(event.target.value) })} /></label>
          </div>
          <div className="toggle-grid-v2">{([['Negative scores', 'allowNegativeScores'], ['Double / Triple finale', 'lateGameModifiers'], ['Stack Daily Double', 'dailyDoubleStacksWithMultiplier'], ['Streaks', 'streaksEnabled'], ['Final Round', 'finalRoundEnabled'], ['Lock room on start', 'lockRoomOnStart'], ['Keyboard buzzers', 'localBuzzersEnabled'], ['Gamepad buzzers', 'controllerBuzzersEnabled']] as [string, keyof GameSettings][]).map(([label, key]) => <label className="toggle-v2" key={key}><input type="checkbox" checked={Boolean(settings[key])} onChange={(event) => void updateSettings({ [key]: event.target.checked } as Partial<GameSettings>)} /><span>{label}</span></label>)}</div>
          <p className="reveal-first-note">Spoken answers use reveal-first judging: reveal the answer, then award or reject the player.</p>
        </article>
      </section>}

      {room.phase === 'board' && room.board && <section className="game-stage board-stage-v2 showcase-board-stage">
        <div className="board-header-v2">
          <div><div className="section-kicker">ROUND IN PROGRESS</div><strong>{room.remainingQuestions} questions left</strong></div>
          <div className="board-actions">
            {connectedPlayers.length > 0 && <label>Daily Double player<select value={controllerId} onChange={(event) => setControllerId(event.target.value)}>{connectedPlayers.map((player)=><option value={player.id} key={player.id}>{player.name}</option>)}</select></label>}
            <button className="nav-button" onClick={() => void perform('host:pause')}>Pause</button>
            <button className="nav-button" onClick={() => setShowJoin(true)}>Join QR</button>
            <a className="nav-button" href={credentials.presentationUrl} target="_blank" rel="noreferrer">Presentation</a>
          </div>
        </div>
        {room.multiplier > 1 && <div className={`modifier-banner x${room.multiplier}`}><span>{room.multiplier === 2 ? 'FINAL SIX' : 'FINAL THREE'}</span><strong>{room.multiplier === 2 ? 'DOUBLE POINTS' : 'TRIPLE POINTS'}</strong></div>}
        <Board board={room.board} multiplier={room.multiplier} onSelect={(questionId) => void perform('host:select-question', { questionId, dailyDoublePlayerId: controllerId || undefined })} onReview={(questionId) => setReviewId(questionId)} />
        <ScoreControls room={room} onAdjust={(playerId, delta) => void perform('host:adjust-score', { playerId, delta })} />
      </section>}

      {room.phase === 'paused' && <section className="full-state"><div className="state-card"><div className="section-kicker">PAUSED</div><h1>Game paused</h1><button className="primary-button giant" onClick={() => void perform('host:resume')}>Resume</button></div></section>}

      {room.phase === 'daily-double-wager' && current && <section className="question-stage daily-double-v2"><div className="question-card-v2"><div className="daily-double-burst">DAILY DOUBLE</div><h1>{dailyPlayer?.avatar} {dailyPlayer?.name}, choose your wager</h1><div className="wager-grid">{QUESTION_VALUES.map((value) => <button key={value} onClick={() => void perform('host:daily-double-wager', { wager: value })}>{value}</button>)}</div><div className="custom-wager"><input inputMode="numeric" value={customWager} onChange={(event)=>setCustomWager(event.target.value.replace(/\D/g,''))} placeholder="Custom wager" /><button className="primary-button" onClick={() => void perform('host:daily-double-wager', { wager: Number(customWager) })}>Lock In</button></div><button className="text-button" onClick={() => void perform('host:cancel-question')}>Exit question</button></div></section>}

      {(room.phase === 'question' || room.phase === 'daily-double-question') && current && <section className={`question-stage ${current.dailyDouble ? 'daily-double-v2' : ''}`}>
        <article className="question-card-v2 showcase-question-card">
          <div className="question-meta-v2">
            <span>{current.category}</span>
            {current.dailyDouble ? <strong>{questionMultiplier > 1 && settings.dailyDoubleStacksWithMultiplier ? `WAGER ${current.wager} × ${questionMultiplier}` : `WAGER ${current.wager}`}</strong> : questionMultiplier > 1 ? <strong className={`inline-modifier x${questionMultiplier}`}>{current.baseValue} × {questionMultiplier} = {current.effectiveValue} POINTS</strong> : <strong>{current.effectiveValue} POINTS</strong>}
            {current.responseMode === 'text' && <em>FREE RESPONSE</em>}
          </div>
          {questionMultiplier > 1 && <div className={`question-modifier-strip x${questionMultiplier}`}>{questionMultiplier === 2 ? 'DOUBLE POINT QUESTION' : 'TRIPLE POINT QUESTION'}</div>}
          <h1>{current.text}</h1>
          <Timer timer={room.timer} serverNow={room.serverNow} />

          {current.responseMode !== 'text' && buzzerCountdown !== null && !current.buzzOpen && !current.buzzWinnerId && <div className="countdown-panel"><small>BUZZERS OPEN IN</small><strong>{buzzerCountdown || 'GO'}</strong></div>}
          {current.responseMode !== 'text' && current.buzzOpen && !current.buzzWinnerId && <div className="buzzer-live-banner">BUZZERS LIVE</div>}
          {buzzWinner && <div className="winner-chip" style={{ '--accent': buzzWinner.accent } as React.CSSProperties}>{buzzWinner.avatar}<span>{buzzWinner.name}</span><b>BUZZED IN</b></div>}

          {current.responseMode === 'text' && !current.answerRevealed && <div className="response-progress"><strong>{textResponseCount}/{connectedPlayers.length}</strong><span>responses locked in</span><small>The answer reveals automatically when every connected player submits or the timer expires.</small></div>}

          {current.answerRevealed && <div className="answer-reveal-v2"><small>CORRECT ANSWER</small><strong>{current.acceptedAnswers?.join(' / ')}</strong></div>}

          {current.responseMode === 'text' && current.answerRevealed && <div className="grading-grid">
            {room.players.map((player) => {
              const response = textResponses[player.id];
              if (!response) return <div className="grading-row muted-row" key={player.id}><span>{player.avatar}</span><div><strong>{player.name}</strong><p>No response</p></div><b>NO SCORE</b></div>;
              const autoLabel = response.autoCorrect ? 'Auto: likely correct' : 'Auto: likely incorrect';
              return <div className="grading-row" key={player.id}><span>{player.avatar}</span><div><strong>{player.name}</strong><p>{response.answer || 'Response locked'}</p><small>{autoLabel} · {response.autoConfidence} confidence</small></div>{response.resolvedCorrect === null ? <div className="grade-actions"><button className="correct-button" onClick={() => void resolveText(player.id, true)}>Award</button><button className="wrong-button" onClick={() => void resolveText(player.id, false)}>Reject</button></div> : <b className={response.resolvedCorrect ? 'grade-correct' : 'grade-wrong'}>{response.resolvedCorrect ? 'AWARDED' : 'REJECTED'}</b>}</div>;
            })}
          </div>}

          {current.responseMode !== 'text' && current.answerRevealed && spokenPlayer && !judgedAttempt && <div className="judge-after-reveal"><small>NOW JUDGE THE RESPONSE</small><strong>{spokenPlayer.avatar} {spokenPlayer.name}</strong><div><button className="correct-button judge-big" onClick={() => void resolveSpoken(true)}>Correct</button><button className="wrong-button judge-big" onClick={() => void resolveSpoken(false)}>Incorrect</button></div></div>}
          {current.responseMode !== 'text' && judgedAttempt && <div className={`judged-result ${judgedAttempt.correct ? 'correct' : 'wrong'}`}>{judgedAttempt.correct ? '✓ CORRECT' : '✕ INCORRECT'} · {judgedAttempt.playerAvatar} {judgedAttempt.playerName}</div>}

          <div className="control-row-v2">
            {current.responseMode !== 'text' && !current.dailyDouble && !current.buzzWinnerId && !current.answerRevealed && <button className="primary-button" onClick={() => { audio.cue('open'); void perform(current.buzzOpen ? 'host:close-buzzers' : 'host:open-buzzers'); }}>{current.buzzOpen ? 'Lock Buzzers' : 'Open Buzzers Now'}</button>}
            {current.responseMode !== 'text' && !current.answerRevealed && <button className="secondary-button reveal-button" onClick={() => void revealAnswer()}>Reveal Answer</button>}
            {!current.answerRevealed && current.attemptedPlayerIds.length === 0 && Object.keys(current.textResponses ?? {}).length === 0 && current.wager === null && <button className="secondary-button" onClick={() => { autoBuzzQuestionRef.current = ''; void perform('host:cancel-question'); }}>Exit Without Answering</button>}
            {canReturnToBoard && <button className="primary-button" onClick={() => void perform('host:advance-board')}>{room.remainingQuestions ? 'Back to Board' : 'Finish Board'}</button>}
          </div>
        </article>
      </section>}

      {room.phase === 'final-category' && room.finalRound && <section className="question-stage final-stage"><article className="question-card-v2"><div className="section-kicker gold">FINAL ROUND</div><h1>{room.finalRound.category}</h1><button className="primary-button giant" onClick={() => void perform('host:begin-final-wagers')}>Open Secret Wagers</button></article></section>}
      {room.phase === 'final-wager' && <section className="question-stage final-stage"><article className="question-card-v2"><div className="section-kicker gold">FINAL ROUND</div><h1>Lock in your wagers</h1><SubmissionStatus players={connectedPlayers} field="finalWagerSubmitted" />{pendingFinalWagers > 0 && <p className="helper-copy">{pendingFinalWagers} connected player{pendingFinalWagers === 1 ? '' : 's'} still waiting. You can start anyway; missing wagers become 0.</p>}<button className="primary-button giant" disabled={busy} onClick={() => void perform('host:open-final-question')}>Start Final Question</button></article></section>}
      {room.phase === 'final-question' && room.finalRound && <section className="question-stage final-stage"><article className="question-card-v2"><div className="section-kicker gold">FINAL QUESTION · {room.finalRound.category}</div><h1>{room.finalRound.question}</h1><Timer timer={room.timer} serverNow={room.serverNow}/><SubmissionStatus players={connectedPlayers} field="finalAnswerSubmitted"/><p className="helper-copy">The answer reveals automatically when every connected response is in or the timer expires.</p><button className="secondary-button" disabled={busy} onClick={() => void perform('host:begin-final-review')}>Start Review Now</button></article></section>}
      {room.phase === 'final-review' && reviewPlayer && room.finalRound && <section className="question-stage final-stage"><article className="question-card-v2"><div className="section-kicker gold">FINAL REVIEW {room.finalRound.reviewPlayerIndex + 1}/{room.players.length}</div><div className="answer-reveal-v2"><small>CORRECT ANSWER</small><strong>{room.finalRound.acceptedAnswers.join(' / ')}</strong></div><h1 className="review-player-title">{reviewPlayer.avatar} {reviewPlayer.name}</h1><div className="final-response-v2"><span><small>WAGER</small><strong>{reviewPlayer.finalWager ?? 0}</strong></span><span><small>RESPONSE</small><strong>{reviewPlayer.finalAnswer || '(No answer)'}</strong></span></div>{(() => { const suggestion = autoGradeAnswer(reviewPlayer.finalAnswer ?? '', room.finalRound!.acceptedAnswers); return <div className={`auto-grade ${suggestion.correct ? 'suggest-correct' : 'suggest-wrong'}`}>Auto grade: {suggestion.correct ? 'likely correct' : 'likely incorrect'} · {suggestion.confidence} confidence</div>; })()}<p className="helper-copy">Auto grade is a suggestion. The host has final scoring authority.</p><div className="control-row-v2"><button className="correct-button" onClick={()=>void perform('host:resolve-final',{playerId:reviewPlayer.id,correct:true})}>Award</button><button className="wrong-button" onClick={()=>void perform('host:resolve-final',{playerId:reviewPlayer.id,correct:false})}>Reject</button></div></article></section>}

      {room.phase === 'recap' && <section className="recap-scene-v2"><div className="section-kicker gold">GAME COMPLETE</div><h1>{winner?.length === 1 ? `${winner[0].avatar} ${winner[0].name} wins` : 'Tie game'}</h1><div className="recap-grid-v2">{[...room.players].sort((a,b)=>b.score-a.score).map((player)=><article className="recap-card-v2" key={player.id}><span>{player.avatar}</span><h2>{player.name}</h2><strong>{player.score.toLocaleString()}</strong><dl><dt>Correct</dt><dd>{player.stats.correct}</dd><dt>Incorrect</dt><dd>{player.stats.incorrect}</dd><dt>Accuracy</dt><dd>{Math.round(player.stats.correct / Math.max(1, player.stats.correct + player.stats.incorrect) * 100)}%</dd><dt>Longest streak</dt><dd>{player.stats.longestStreak}</dd><dt>Fastest buzz</dt><dd>{player.stats.fastestBuzzMs == null ? '—' : `${player.stats.fastestBuzzMs}ms`}</dd></dl></article>)}</div><div className="control-row-v2"><button className="primary-button" onClick={() => void resetGame()}>Reset Game</button><button className="secondary-button" onClick={goMenu}>Back to Menu</button></div></section>}

      {showJoin && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Join game"><section className="modal-card join-modal-v2"><button className="modal-close" onClick={() => setShowJoin(false)} aria-label="Close">×</button><div className="section-kicker">JOIN GAME</div>{qr && <img src={qr} alt="QR code to join or reconnect to the game" />}<strong className="modal-room-code">{room.code}</strong><a href={credentials.joinUrl}>{credentials.joinUrl}</a><p>Returning players reconnect to the same reserved seat on the same phone and browser.</p></section></div>}

      {reviewId && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Question review"><section className="modal-card review-modal-v2"><button className="modal-close" onClick={() => setReviewId(null)} aria-label="Close">×</button>{(() => {
        const entry = historyEntries.find((item) => item.questionId === reviewId);
        const tile = room.board?.questions.find((item) => item.questionId === reviewId);
        if (!entry) return <><div className="section-kicker">USED QUESTION</div><h2>{tile?.category}</h2><p>No answer history was recorded for this question.</p></>;
        return <><div className="section-kicker">{entry.category} · {entry.value} POINTS</div><h2>{entry.text}</h2><div className="review-answer-v2"><small>ANSWER</small><strong>{entry.answer || 'Not revealed'}</strong></div><div className="attempt-list">{entry.attempts.length ? entry.attempts.map((attempt) => <div className={`attempt-row ${attempt.correct ? 'correct' : 'wrong'}`} key={attempt.playerId}><span>{attempt.playerAvatar}</span><strong>{attempt.playerName}</strong><b>{attempt.correct ? 'CORRECT' : 'INCORRECT'}</b></div>) : <p className="muted">No player response recorded.</p>}</div></>;
      })()}</section></div>}
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
  return <div className="submission-list-v2">{players.map((player)=><div key={player.id} className={player[field] ? 'done' : ''}><span>{player.avatar}</span><strong>{player.name}</strong><small>{player[field] ? 'Locked in' : 'Waiting'}</small></div>)}</div>;
}
