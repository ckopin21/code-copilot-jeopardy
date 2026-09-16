import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameSettings, HostRoomCredentials, PackSummary, RoomSnapshot } from '../shared/types';
import { DEFAULT_SETTINGS, QUESTION_VALUES } from '../shared/config';
import { emitAck, socket } from '../lib/socket';
import { audio } from '../lib/audio';
import { PlayerStrip } from './PlayerStrip';
import { Board } from './Board';
import { Timer } from './Timer';
import { AudioMixer } from './AudioMixer';

const HOST_KEY = 'blue-stage-host-room';
type HostStored = HostRoomCredentials;
type QuestionHistoryEntry = {
  questionId: string;
  category: string;
  text: string;
  value: number;
  answer: string;
  playerId: string | null;
  playerName: string | null;
  playerAvatar: string | null;
  correct: boolean | null;
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

export function HostApp() {
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
  const [history, setHistory] = useState<QuestionHistoryEntry[]>([]);
  const [buzzerCountdown, setBuzzerCountdown] = useState<number | null>(null);
  const lastPhaseRef = useRef('');
  const autoBuzzQuestionRef = useRef('');

  const perform = useCallback(async (event: string, payload: Record<string, unknown> = {}) => {
    if (!credentials) return;
    setError('');
    setBusy(true);
    try {
      await audio.unlock();
      await emitAck(event, { roomCode: credentials.roomCode, hostToken: credentials.hostToken, ...payload });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
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
      try {
        const saved = localStorage.getItem(HOST_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as HostStored;
          const snapshot = await emitAck<RoomSnapshot>('host:reconnect', { roomCode: parsed.roomCode, hostToken: parsed.hostToken });
          setCredentials(parsed);
          setRoom(snapshot);
          return;
        }
        const network = await fetch('/api/network').then((response) => response.json()) as { baseUrl: string };
        const created = await emitAck<HostRoomCredentials>('room:create', { settings: DEFAULT_SETTINGS, baseUrl: network.baseUrl });
        localStorage.setItem(HOST_KEY, JSON.stringify(created));
        setCredentials(created);
      } catch (err) {
        localStorage.removeItem(HOST_KEY);
        setError(err instanceof Error ? err.message : 'Could not create room');
      } finally {
        setBusy(false);
      }
    };
    void boot();
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
    if (!controllerId && room.players[0]) setControllerId(room.players[0].id);
    if (lastPhaseRef.current && lastPhaseRef.current !== room.phase) audio.cue('phase');
    lastPhaseRef.current = room.phase;
    void audio.setMusic(phaseMusic(room));
  }, [room, controllerId]);

  useEffect(() => {
    if (!credentials?.roomCode) return;
    try {
      const saved = localStorage.getItem(`blue-stage-history-${credentials.roomCode}`);
      setHistory(saved ? JSON.parse(saved) as QuestionHistoryEntry[] : []);
    } catch {
      setHistory([]);
    }
  }, [credentials?.roomCode]);

  const recordHistory = useCallback((correct: boolean | null, playerId?: string | null) => {
    if (!credentials || !room?.currentQuestion) return;
    const currentQuestion = room.currentQuestion;
    const player = playerId ? room.players.find((item) => item.id === playerId) : null;
    setHistory((previous) => {
      const existing = previous.find((entry) => entry.questionId === currentQuestion.questionId);
      const nextEntry: QuestionHistoryEntry = {
        questionId: currentQuestion.questionId,
        category: currentQuestion.category,
        text: currentQuestion.text,
        value: currentQuestion.effectiveValue,
        answer: currentQuestion.acceptedAnswers?.[0] ?? existing?.answer ?? '',
        playerId: player?.id ?? existing?.playerId ?? null,
        playerName: player?.name ?? existing?.playerName ?? null,
        playerAvatar: player?.avatar ?? existing?.playerAvatar ?? null,
        correct: player ? correct : existing?.correct ?? correct
      };
      const next = [...previous.filter((entry) => entry.questionId !== currentQuestion.questionId), nextEntry];
      localStorage.setItem(`blue-stage-history-${credentials.roomCode}`, JSON.stringify(next));
      return next;
    });
  }, [credentials, room]);

  useEffect(() => {
    const currentQuestion = room?.currentQuestion;
    if (!currentQuestion || room?.phase !== 'question' || currentQuestion.dailyDouble || currentQuestion.answerRevealed || currentQuestion.buzzOpen || currentQuestion.buzzWinnerId) {
      setBuzzerCountdown(null);
      return;
    }
    if (autoBuzzQuestionRef.current === currentQuestion.questionId) return;
    autoBuzzQuestionRef.current = currentQuestion.questionId;
    let remaining = 3;
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
    }, 3000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [room?.currentQuestion?.questionId, room?.currentQuestion?.buzzOpen, room?.currentQuestion?.buzzWinnerId, room?.currentQuestion?.answerRevealed, room?.phase, perform]);

  useEffect(() => {
    if (!room || !room.settings.localBuzzersEnabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || !room.currentQuestion?.buzzOpen) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < room.players.length) void perform('host:local-buzz', { playerId: room.players[index].id });
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
        if (!pad || !room.players[index]) return;
        const prev = previous.get(index) ?? [];
        const pressed = pad.buttons.some((button, buttonIndex) => button.pressed && !prev[buttonIndex]);
        previous.set(index, pad.buttons.map((button) => button.pressed));
        if (pressed) void perform('host:local-buzz', { playerId: room.players[index].id });
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

  if (!credentials || !room) {
    return <main className="center-screen"><div className="logo-lockup"><span>BLUE STAGE</span><strong>TRIVIA</strong></div><p>{error || 'Creating game room…'}</p></main>;
  }

  const current = room.currentQuestion;
  const buzzWinner = current?.buzzWinnerId ? room.players.find((player) => player.id === current.buzzWinnerId) : null;
  const dailyPlayer = current?.dailyDoublePlayerId ? room.players.find((player) => player.id === current.dailyDoublePlayerId) : null;
  const reviewPlayer = room.phase === 'final-review' && room.finalRound ? room.players[room.finalRound.reviewPlayerIndex] : null;
  const settings = room.settings;
  const updateSettings = (updates: Partial<GameSettings>) => perform('host:update-settings', { updates });

  return (
    <main className="host-shell">
      <header className="topbar">
        <div className="mini-logo">BLUE STAGE <strong>TRIVIA</strong></div>
        <div className="room-code">ROOM <strong>{room.code}</strong></div>
        <div className={`connection-pill ${room.hostConnected ? 'online' : ''}`}>{socket.connected ? 'Connected' : 'Reconnecting'}</div>
        <button className="small-button join-toggle" onClick={() => setShowJoin((value) => !value)}>Join / Reconnect</button>
        <AudioMixer />
      </header>

      {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
      <PlayerStrip players={room.players} activeId={current?.buzzWinnerId ?? current?.dailyDoublePlayerId} />

      {room.phase === 'lobby' && <section className="lobby-grid">
        <div className="panel join-panel">
          <h1>Game Lobby</h1>
          <div className="join-card">{qr && <img src={qr} alt="QR code to join the game" />}<div><small>JOIN ON YOUR PHONE</small><strong>{room.code}</strong><a href={credentials.joinUrl}>{credentials.joinUrl}</a></div></div>
          <h2>Players <span>{room.players.length}/5</span></h2>
          <div className="lobby-players">{room.players.length ? room.players.map((player, index) => <div className="lobby-player" key={player.id}><span>{player.avatar}</span><strong>{player.name}</strong><small>Key {index + 1}</small><button className="icon-button danger" onClick={() => perform('host:remove-player', { playerId: player.id })} aria-label={`Remove ${player.name}`}>×</button></div>) : <p className="muted">No players required. Start now for practice mode.</p>}</div>
          <button className="primary-button giant" disabled={busy} onClick={() => perform('host:start-game')}>Start Game</button>
        </div>

        <div className="panel settings-panel">
          <h2>Question Packs</h2>
          <div className="pack-grid">{packs.map((pack) => {
            const selected = settings.selectedPackIds.includes(pack.id);
            return <button key={pack.id} className={`pack-card ${selected ? 'selected' : ''}`} onClick={() => {
              const ids = selected ? settings.selectedPackIds.filter((id) => id !== pack.id) : [...settings.selectedPackIds, pack.id];
              if (ids.length) void updateSettings({ selectedPackIds: ids, mixedPacks: ids.length > 1 });
            }}><strong>{pack.title}</strong><span>{pack.theme}</span><small>{pack.questionCount} questions · ~{pack.approximateMinutes} min</small></button>;
          })}</div>
          <h2>Rules</h2>
          <div className="settings-grid">
            <label>Length<select value={settings.gameLength} onChange={(event) => updateSettings({ gameLength: event.target.value as GameSettings['gameLength'] })}><option value="quick">Quick</option><option value="standard">Standard</option><option value="marathon">Marathon</option></select></label>
            <label>Answer timer<select value={settings.timerSeconds ?? 'none'} onChange={(event) => updateSettings({ timerSeconds: event.target.value === 'none' ? null : Number(event.target.value) as GameSettings['timerSeconds'] })}>{[5,10,15,20,30].map((seconds)=><option key={seconds} value={seconds}>{seconds}s</option>)}<option value="none">Unlimited</option></select></label>
            <label>Daily Doubles<input type="number" min="0" max="6" value={settings.dailyDoubleCount} onChange={(event) => updateSettings({ dailyDoubleCount: Number(event.target.value), dailyDoublesEnabled: Number(event.target.value) > 0 })} /></label>
            <label>Cold streak<input type="number" min="2" max="8" value={settings.coldStreakThreshold} onChange={(event) => updateSettings({ coldStreakThreshold: Number(event.target.value) })} /></label>
          </div>
          <div className="toggle-grid">{([['Steals', 'stealsEnabled'], ['Negative scores', 'allowNegativeScores'], ['Double / Triple finale', 'lateGameModifiers'], ['Stack Daily Double', 'dailyDoubleStacksWithMultiplier'], ['Streaks', 'streaksEnabled'], ['Final Round', 'finalRoundEnabled'], ['Lock room on start', 'lockRoomOnStart'], ['Keyboard buzzers', 'localBuzzersEnabled'], ['Gamepad buzzers', 'controllerBuzzersEnabled']] as [string, keyof GameSettings][]).map(([label, key]) => <label className="toggle" key={key}><input type="checkbox" checked={Boolean(settings[key])} onChange={(event) => updateSettings({ [key]: event.target.checked } as Partial<GameSettings>)} /><span>{label}</span></label>)}</div>
        </div>
      </section>}

      {room.phase === 'board' && room.board && <section className="game-stage">
        {room.multiplier > 1 && <div className={`modifier-banner x${room.multiplier}`}>{room.multiplier === 2 ? 'DOUBLE POINTS' : 'TRIPLE POINTS'}</div>}
        <div className="stage-toolbar"><span>{room.remainingQuestions} questions left</span>{room.players.length > 0 && <label>Daily Double player<select value={controllerId} onChange={(event) => setControllerId(event.target.value)}>{room.players.map((player)=><option value={player.id} key={player.id}>{player.name}</option>)}</select></label>}<button className="small-button" onClick={() => perform('host:pause')}>Pause</button><button className="small-button" onClick={() => setShowJoin(true)}>Show QR</button><a className="small-button" href={credentials.presentationUrl} target="_blank" rel="noreferrer">Presentation view</a></div>
        <Board board={room.board} onSelect={(questionId) => perform('host:select-question', { questionId, dailyDoublePlayerId: controllerId || undefined })} onReview={(questionId) => setReviewId(questionId)} />
        <ScoreControls room={room} onAdjust={(playerId, delta) => perform('host:adjust-score', { playerId, delta })} />
      </section>}

      {room.phase === 'paused' && <section className="center-screen overlay-state"><h1>Game Paused</h1><button className="primary-button giant" onClick={() => perform('host:resume')}>Resume</button></section>}

      {room.phase === 'daily-double-wager' && current && <section className="center-screen question-scene daily-double-scene"><div className="burst-label">DAILY DOUBLE</div><h1>{dailyPlayer?.avatar} {dailyPlayer?.name}, choose your wager</h1><div className="wager-grid">{QUESTION_VALUES.map((value) => <button key={value} onClick={() => perform('host:daily-double-wager', { wager: value })}>{value}</button>)}</div><div className="custom-wager"><input inputMode="numeric" value={customWager} onChange={(event)=>setCustomWager(event.target.value.replace(/\D/g,''))} placeholder="Custom wager" /><button onClick={() => perform('host:daily-double-wager', { wager: Number(customWager) })}>Lock In</button></div></section>}

      {(room.phase === 'question' || room.phase === 'daily-double-question') && current && <section className={`center-screen question-scene ${current.dailyDouble ? 'daily-double-scene' : ''}`}>
        <div className="question-meta"><span>{current.category}</span><strong>{current.dailyDouble ? `WAGER ${current.wager}` : `${current.effectiveValue} POINTS`}</strong></div>
        <h1>{current.text}</h1>
        <div className="host-answer">Host answer: <strong>{current.acceptedAnswers?.join(' / ')}</strong></div>
        <Timer timer={room.timer} />
        {buzzerCountdown !== null && !current.buzzOpen && !current.buzzWinnerId && <div className="buzzer-countdown"><small>BUZZERS OPEN IN</small><strong>{buzzerCountdown || 'GO!'}</strong></div>}
        {buzzWinner && <div className="buzz-winner" style={{ '--accent': buzzWinner.accent } as React.CSSProperties}>{buzzWinner.avatar} {buzzWinner.name}</div>}
        <div className="control-row">
          {!current.dailyDouble && !current.buzzWinnerId && !current.answerRevealed && <button className="primary-button" onClick={() => { audio.cue('open'); void perform(current.buzzOpen ? 'host:close-buzzers' : 'host:open-buzzers'); }}>{current.buzzOpen ? 'Lock Buzzers' : 'Open Buzzers Now'}</button>}
          {(buzzWinner || dailyPlayer) && !current.answerRevealed && <><button className="correct-button" onClick={() => { const player = (buzzWinner ?? dailyPlayer)!; audio.cue('correct'); recordHistory(true, player.id); setControllerId(player.id); void perform('host:resolve-answer', { playerId: player.id, correct: true }); }}>Correct</button><button className="wrong-button" onClick={() => { const player = (buzzWinner ?? dailyPlayer)!; audio.cue('wrong'); recordHistory(false, player.id); void perform('host:resolve-answer', { playerId: player.id, correct: false }); }}>Incorrect</button></>}
          {!current.answerRevealed && <button className="small-button" onClick={() => { recordHistory(null, null); void perform('host:reveal-answer'); }}>Reveal Answer</button>}
          {!current.answerRevealed && <button className="small-button exit-question" onClick={() => perform('host:advance-board')}>Exit Question</button>}
          {current.answerRevealed && <button className="primary-button" onClick={() => perform('host:advance-board')}>{room.remainingQuestions ? 'Back to Board' : 'Finish Board'}</button>}
          <button className="small-button" onClick={() => setShowJoin(true)}>Show QR</button>
        </div>
        {current.answerRevealed && <div className="revealed-answer">{current.acceptedAnswers?.[0]}</div>}
      </section>}

      {room.phase === 'final-category' && room.finalRound && <section className="center-screen final-scene"><div className="eyebrow">FINAL ROUND</div><h1>{room.finalRound.category}</h1><button className="primary-button giant" onClick={() => perform('host:begin-final-wagers')}>Open Secret Wagers</button></section>}
      {room.phase === 'final-wager' && <section className="center-screen final-scene"><div className="eyebrow">FINAL ROUND</div><h1>Lock in your wagers</h1><SubmissionStatus players={room.players} field="finalWagerSubmitted" /><button className="primary-button" disabled={!room.players.every((player)=>player.finalWagerSubmitted)} onClick={() => perform('host:open-final-question')}>Reveal Final Question</button></section>}
      {room.phase === 'final-question' && room.finalRound && <section className="center-screen final-scene"><div className="eyebrow">FINAL QUESTION · {room.finalRound.category}</div><h1>{room.finalRound.question}</h1><div className="host-answer">Host answer: <strong>{room.finalRound.acceptedAnswers.join(' / ')}</strong></div><Timer timer={room.timer}/><SubmissionStatus players={room.players} field="finalAnswerSubmitted"/><button className="primary-button" onClick={() => perform('host:begin-final-review')}>Review Answers</button></section>}
      {room.phase === 'final-review' && reviewPlayer && <section className="center-screen final-scene"><div className="eyebrow">FINAL ANSWER {room.finalRound!.reviewPlayerIndex + 1}/{room.players.length}</div><h1>{reviewPlayer.avatar} {reviewPlayer.name}</h1><div className="final-response"><small>WAGER</small><strong>{reviewPlayer.finalWager ?? 0}</strong><small>ANSWER</small><strong>{reviewPlayer.finalAnswer || '(No answer)'}</strong></div><div className="control-row"><button className="correct-button" onClick={()=>perform('host:resolve-final',{playerId:reviewPlayer.id,correct:true})}>Correct</button><button className="wrong-button" onClick={()=>perform('host:resolve-final',{playerId:reviewPlayer.id,correct:false})}>Incorrect</button></div></section>}
      {room.phase === 'recap' && <section className="recap-scene"><Confetti/><div className="eyebrow">GAME COMPLETE</div><h1>{winner?.length === 1 ? `${winner[0].avatar} ${winner[0].name} wins!` : 'Tie game!'}</h1><div className="recap-grid">{[...room.players].sort((a,b)=>b.score-a.score).map((player)=><article className="recap-card" key={player.id}><span>{player.avatar}</span><h2>{player.name}</h2><strong>{player.score.toLocaleString()}</strong><dl><dt>Correct</dt><dd>{player.stats.correct}</dd><dt>Incorrect</dt><dd>{player.stats.incorrect}</dd><dt>Accuracy</dt><dd>{Math.round(player.stats.correct / Math.max(1, player.stats.correct + player.stats.incorrect) * 100)}%</dd><dt>Longest streak</dt><dd>{player.stats.longestStreak}</dd><dt>Cold streak</dt><dd>{player.stats.longestColdStreak}</dd><dt>Daily Doubles</dt><dd>{player.stats.dailyDoublesFound}</dd><dt>Biggest wager</dt><dd>{player.stats.biggestWager}</dd><dt>Fastest buzz</dt><dd>{player.stats.fastestBuzzMs == null ? '—' : `${player.stats.fastestBuzzMs}ms`}</dd></dl></article>)}</div><button className="small-button" onClick={()=>{ localStorage.removeItem(HOST_KEY); location.href='./'; }}>New Room</button></section>}

      {showJoin && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Join game"><section className="show-modal join-modal"><button className="modal-close" onClick={() => setShowJoin(false)} aria-label="Close">×</button><div className="eyebrow">JOIN OR RECONNECT</div>{qr && <img src={qr} alt="QR code to join or reconnect to the game" />}<strong className="modal-room-code">{room.code}</strong><a href={credentials.joinUrl}>{credentials.joinUrl}</a><p>Returning players should scan with the same phone and browser. Their saved seat reconnects automatically.</p></section></div>}

      {reviewId && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Question review"><section className="show-modal review-modal"><button className="modal-close" onClick={() => setReviewId(null)} aria-label="Close">×</button>{(() => {
        const entry = history.find((item) => item.questionId === reviewId);
        const tile = room.board?.questions.find((item) => item.questionId === reviewId);
        if (!entry) return <><div className="eyebrow">USED QUESTION</div><h2>{tile?.category}</h2><p>This question was exited or completed before review history was recorded.</p></>;
        return <><div className="eyebrow">{entry.category} · {entry.value} POINTS</div><h2>{entry.text}</h2><div className="review-answer">Answer: <strong>{entry.answer || 'Not revealed'}</strong></div><div className={`review-result ${entry.correct === true ? 'correct' : entry.correct === false ? 'wrong' : ''}`}>{entry.playerName ? <>{entry.playerAvatar} {entry.playerName} · {entry.correct === true ? 'Correct' : entry.correct === false ? 'Incorrect' : 'Answered'}</> : 'No player answer recorded'}</div></>;
      })()}</section></div>}
    </main>
  );
}

function ScoreControls({ room, onAdjust }: { room: RoomSnapshot; onAdjust: (playerId: string, delta: number) => void }) {
  if (!room.players.length) return null;
  return <div className="score-controls">{room.players.map((player)=><div key={player.id}><span>{player.avatar} {player.name}</span><button onClick={()=>onAdjust(player.id,-100)}>-100</button><button onClick={()=>onAdjust(player.id,100)}>+100</button></div>)}</div>;
}

function SubmissionStatus({ players, field }: { players: RoomSnapshot['players']; field: 'finalWagerSubmitted' | 'finalAnswerSubmitted' }) {
  return <div className="submission-list">{players.map((player)=><div key={player.id} className={player[field] ? 'done' : ''}><span>{player.avatar}</span><strong>{player.name}</strong><small>{player[field] ? 'Locked in' : 'Waiting…'}</small></div>)}</div>;
}

function Confetti() {
  return <div className="confetti" aria-hidden="true">{Array.from({length:36},(_,index)=><i key={index} style={{'--i':index} as React.CSSProperties}/>)}</div>;
}
