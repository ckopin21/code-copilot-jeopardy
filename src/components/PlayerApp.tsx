import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ACCENT_COLORS, AVATARS, QUESTION_VALUES } from '../shared/config';
import type { PlayerJoinCredentials, RoomSnapshot } from '../shared/types';
import { emitAck, resumeClientSession, socket, suspendClientSession } from '../lib/socket';
import { audio } from '../lib/audio';
import { menuUrl } from '../lib/resetInstance';
import { Timer } from './Timer';
import { QrScanner } from './QrScanner';

const PLAYER_KEY = 'blue-stage-player';
const FINAL_WAGER_PRESETS = [0, ...QUESTION_VALUES] as const;

function terminalReconnectError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('authorization') || normalized.includes('not found') || normalized.includes('expired');
}

export function PlayerApp() {
  const params = new URLSearchParams(location.search);
  const [roomCode, setRoomCode] = useState((params.get('room') ?? '').toUpperCase());
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [accent, setAccent] = useState(ACCENT_COLORS[0]);
  const [credentials, setCredentials] = useState<PlayerJoinCredentials | null>(null);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState('');
  const [buzzMessage, setBuzzMessage] = useState('');
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedFinalWager, setSelectedFinalWager] = useState<number | null>(null);
  const [finalAnswer, setFinalAnswer] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [hostSuspended, setHostSuspended] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [joining, setJoining] = useState(false);
  const [modifierReveal, setModifierReveal] = useState<2 | 3 | null>(null);
  const syncFailuresRef = useRef(0);
  const lastQuestionIdRef = useRef('');
  const lastMultiplierRef = useRef<1 | 2 | 3 | null>(null);
  const modifierTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onState = (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
      setRecovering(false);
      setHostSuspended(false);
      syncFailuresRef.current = 0;
      setError('');
    };
    const onDisconnect = () => setRecovering(true);
    const onSuspended = () => {
      setHostSuspended(true);
      setRecovering(false);
      setError('');
    };
    const onRemoved = () => {
      localStorage.removeItem(PLAYER_KEY);
      setCredentials(null);
      setRoom(null);
      setRecovering(false);
      setHostSuspended(false);
      setRoomCode('');
      setError('Your seat was permanently removed by the host. You can join again as a new player.');
    };
    socket.on('room:state', onState);
    socket.on('disconnect', onDisconnect);
    socket.on('player:suspended', onSuspended);
    socket.on('player:removed', onRemoved);
    return () => {
      socket.off('room:state', onState);
      socket.off('disconnect', onDisconnect);
      socket.off('player:suspended', onSuspended);
      socket.off('player:removed', onRemoved);
    };
  }, []);

  useEffect(() => {
    const onPageHide = () => suspendClientSession();
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      suspendClientSession();
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(PLAYER_KEY);
    if (!saved) return;
    let parsed: PlayerJoinCredentials;
    try { parsed = JSON.parse(saved) as PlayerJoinCredentials; }
    catch { localStorage.removeItem(PLAYER_KEY); return; }
    if (roomCode && parsed.roomCode !== roomCode) return;

    resumeClientSession();
    setCredentials(parsed);
    setRoomCode(parsed.roomCode);
    setRecovering(true);
    setHostSuspended(false);
    let cancelled = false;
    let retryTimer = 0;

    const reconnect = async () => {
      try {
        const result = await emitAck<PlayerJoinCredentials>('player:reconnect', parsed);
        if (cancelled) return;
        localStorage.setItem(PLAYER_KEY, JSON.stringify(result));
        setCredentials(result);
        setRoomCode(result.roomCode);
        setRecovering(false);
        setError('');
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Could not restore your saved seat';
        if (terminalReconnectError(message)) {
          setRecovering(false);
          setError('That saved seat is no longer available. Choose “Use another seat” to join again.');
          return;
        }
        setRecovering(true);
        setError('Reconnecting to your saved seat…');
        retryTimer = window.setTimeout(reconnect, 1500);
      }
    };

    void reconnect();
    return () => { cancelled = true; window.clearTimeout(retryTimer); };
  }, [roomCode]);

  useEffect(() => {
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
  }, [credentials, room?.code, hostSuspended]);

  const me = useMemo(() => room?.players.find((player) => player.id === credentials?.playerId) ?? null, [room, credentials]);
  const current = room?.currentQuestion;

  useEffect(() => {
    const questionId = current?.questionId ?? '';
    if (questionId === lastQuestionIdRef.current) return;
    lastQuestionIdRef.current = questionId;
    setTextAnswer('');
    setBuzzMessage('');
  }, [current?.questionId]);

  useEffect(() => {
    if (room?.phase !== 'lobby') return;
    setSelectedFinalWager(null);
    setFinalAnswer('');
    setTextAnswer('');
    setBuzzMessage('');
  }, [room?.phase, room?.gameStartedAt]);

  useEffect(() => {
    if (!room) return;
    const nextMultiplier = room.multiplier;
    const previous = lastMultiplierRef.current;
    if (previous === null) {
      lastMultiplierRef.current = nextMultiplier;
      return;
    }
    if (room.phase === 'board' && (nextMultiplier === 2 || nextMultiplier === 3) && nextMultiplier > previous) {
      if (modifierTimerRef.current !== null) window.clearTimeout(modifierTimerRef.current);
      setModifierReveal(nextMultiplier);
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

  const join = async () => {
    if (joining) return;
    setJoining(true);
    setError('');
    try {
      resumeClientSession();
      await audio.unlock();
      const result = await emitAck<PlayerJoinCredentials>('player:join', { roomCode, name, avatar, accent });
      localStorage.setItem(PLAYER_KEY, JSON.stringify(result));
      setCredentials(result);
      setRecovering(false);
      setHostSuspended(false);
      const url = new URL(location.href);
      url.search = `?mode=player&room=${result.roomCode}`;
      history.replaceState(null, '', url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join room');
    } finally {
      setJoining(false);
    }
  };

  const reconnectSeat = async () => {
    if (!credentials) return;
    setError('');
    setHostSuspended(false);
    setRecovering(true);
    resumeClientSession();
    try {
      const result = await emitAck<PlayerJoinCredentials>('player:reconnect', credentials);
      localStorage.setItem(PLAYER_KEY, JSON.stringify(result));
      setCredentials(result);
      setRecovering(false);
    } catch (err) {
      setRecovering(false);
      const message = err instanceof Error ? err.message : 'Could not reconnect';
      if (terminalReconnectError(message)) {
        localStorage.removeItem(PLAYER_KEY);
        setCredentials(null);
        setRoom(null);
        setRoomCode('');
        setError('That reserved seat no longer exists. Join again as a new player.');
      } else {
        setHostSuspended(true);
        setError(message);
      }
    }
  };

  const handleQrResult = useCallback((value: string) => {
    let scannedRoom = '';
    try {
      const url = new URL(value, location.href);
      scannedRoom = url.searchParams.get('room') ?? '';
    } catch { /* fall back to plain room-code text */ }
    if (!scannedRoom) scannedRoom = value.match(/[A-Z0-9]{5,8}/i)?.[0] ?? '';
    const normalized = scannedRoom.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (!normalized) {
      setError('That QR code does not contain a Blue Stage room code.');
      return;
    }
    setRoomCode(normalized);
    setError('Room code scanned. Enter your name, then join.');
    setShowScanner(false);
  }, []);

  const buzz = async () => {
    if (!credentials || !me?.buzzEligible) return;
    setBuzzMessage('');
    try {
      await audio.unlock();
      const result = await emitAck<{ accepted: boolean; reason?: string }>('player:buzz', credentials);
      if (result.accepted) { audio.cue('buzz'); setBuzzMessage('BUZZ REGISTERED'); }
      else { audio.cue('locked'); setBuzzMessage(result.reason ?? 'LOCKED OUT'); }
    } catch (err) {
      setBuzzMessage(err instanceof Error ? err.message : 'Buzz failed');
    }
  };

  const submitText = async () => {
    if (!credentials || !textAnswer.trim()) return;
    setError('');
    try {
      await emitAck('player:text-response', { ...credentials, answer: textAnswer.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not lock response');
    }
  };

  const submitDailyDoubleWager = async (wager: number) => {
    if (!credentials) return;
    setError('');
    try { await emitAck('player:daily-double-wager', { ...credentials, wager }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not lock wager'); }
  };

  const submitFinalWager = async () => {
    if (!credentials || selectedFinalWager === null) return;
    setError('');
    try { await emitAck('player:final-wager', { ...credentials, wager: selectedFinalWager }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not lock wager'); }
  };

  const leaveToMenu = () => {
    suspendClientSession();
    audio.stop();
    location.href = menuUrl();
  };

  const forgetSeat = () => {
    suspendClientSession();
    localStorage.removeItem(PLAYER_KEY);
    setCredentials(null);
    setRecovering(false);
    setHostSuspended(false);
    setRoom(null);
    setRoomCode('');
    setError('');
  };

  if (credentials && hostSuspended) {
    return <main className="phone-shell phone-join"><section className="phone-card reconnect-card"><div className="phone-brand"><span>BLUE STAGE</span><strong>TRIVIA</strong></div><div className="pause-seat-icon">⏸</div><h1>Seat paused</h1><p>The host temporarily disconnected this controller. Your score, stats, and seat are still reserved.</p>{error && <p className="form-error">{error}</p>}<button className="primary-button giant" onClick={() => void reconnectSeat()}>Reconnect to Seat</button><button className="text-button" onClick={leaveToMenu}>Back to menu</button></section></main>;
  }

  if (!room || !me) {
    if (credentials && recovering) {
      return <main className="phone-shell phone-join"><section className="phone-card reconnect-card"><div className="phone-brand"><span>BLUE STAGE</span><strong>TRIVIA</strong></div><div className="pulse-orb"/><h1>Reconnecting</h1><p>Restoring your seat in room <strong>{credentials.roomCode}</strong>.</p><button className="secondary-button" onClick={forgetSeat}>Use another seat</button><button className="text-button" onClick={leaveToMenu}>Back to menu</button></section></main>;
    }
    return <main className="phone-shell phone-join"><section className="phone-card join-form-v2">
      <div className="phone-brand"><span>BLUE STAGE</span><strong>TRIVIA</strong></div>
      {credentials && <div className="saved-seat-notice"><strong>Saved seat: {credentials.roomCode}</strong><button type="button" className="text-button" onClick={forgetSeat}>Use another seat</button></div>}
      <div className="join-code-row"><label>Room code<input value={roomCode} maxLength={8} autoCapitalize="characters" onChange={(event)=>setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} placeholder="ABCDE" /></label><button type="button" className="secondary-button scan-qr-button" onClick={()=>setShowScanner(true)}>Scan QR</button></div>
      <label>Your name<input value={name} maxLength={24} onChange={(event)=>setName(event.target.value)} placeholder="Player name" /></label>
      <fieldset><legend>Avatar</legend><div className="avatar-picker-v2">{AVATARS.map((item)=><button type="button" className={item===avatar?'selected':''} key={item} onClick={()=>setAvatar(item)}>{item}</button>)}</div></fieldset>
      <fieldset><legend>Accent</legend><div className="color-picker-v2">{ACCENT_COLORS.map((item)=><button type="button" aria-label={item} className={item===accent?'selected':''} style={{background:item}} key={item} onClick={()=>setAccent(item)} />)}</div></fieldset>
      {error && <p className={error.startsWith('Room code scanned') ? 'form-success' : 'form-error'}>{error}</p>}
      <button className="primary-button giant" disabled={!roomCode || !name.trim() || Boolean(credentials) || joining} aria-busy={joining} onClick={join}>{joining ? 'Joining…' : 'Join Game'}</button>
      <button className="text-button" onClick={leaveToMenu}>Back to menu</button>
      {showScanner && <QrScanner onResult={handleQrResult} onClose={()=>setShowScanner(false)}/>} 
    </section></main>;
  }

  const buzzerOpen = room.phase === 'question' && current?.responseMode !== 'text' && current?.buzzOpen && me.buzzEligible;
  const winner = current?.buzzWinnerId === me.id;
  const myResponse = current?.textResponses?.[me.id];
  const showFinalWager = room.phase === 'final-wager' || room.phase === 'final-question' || room.phase === 'final-review';
  const questionMultiplier = current ? Math.max(1, Math.round(current.effectiveValue / Math.max(1, current.baseValue))) : 1;
  const pointsAtStake = current ? current.dailyDouble
    ? (current.wager ?? 0) * (room.settings.dailyDoubleStacksWithMultiplier ? questionMultiplier : 1)
    : current.effectiveValue : 0;
  const dailyDoublePlayer = current?.dailyDoublePlayerId ? room.players.find((player) => player.id === current.dailyDoublePlayerId) : null;
  const accuracy = Math.round(me.stats.correct / Math.max(1, me.stats.correct + me.stats.incorrect) * 100);

  return <main className={`player-phone-v2 ${me.onFire?'phone-fire':''} ${me.isCold?'phone-cold':''}`} style={{'--accent':me.accent} as React.CSSProperties}>
    <header className="phone-header-v2"><button className="phone-menu" onClick={leaveToMenu} aria-label="Leave game">←</button><span className="phone-avatar">{me.avatar}</span><div className="phone-identity"><strong>{me.name}</strong><small>{!recovering && socket.connected ? `ROOM ${room.code}` : 'RECONNECTING…'}</small></div><div className="phone-score-stack"><b>{me.score.toLocaleString()}</b>{showFinalWager && me.finalWagerSubmitted && me.finalWager !== null && <small className="phone-wager-pill">WAGER {me.finalWager.toLocaleString()}</small>}</div></header>

    {modifierReveal && <div className={`modifier-reveal-overlay x${modifierReveal}`} aria-live="polite"><div className="modifier-reveal-card"><span>{modifierReveal === 2 ? 'FINAL SIX' : 'FINAL THREE'}</span><strong>{modifierReveal === 2 ? 'DOUBLE POINTS' : 'TRIPLE POINTS'}</strong><p>{modifierReveal === 2 ? 'Every question is now worth 2×.' : 'Every remaining question is now worth 3×.'}</p></div></div>}

    {room.phase === 'lobby' && <section className="phone-state-v2"><div className="ready-ring"><span>{me.avatar}</span></div><div className="section-kicker">CONNECTED</div><h1>{room.gameStartedAt === null ? 'You’re in.' : 'Game reset.'}</h1><p>Your seat is ready. Watch the host screen for the next game.</p></section>}
    {room.phase === 'paused' && <section className="phone-state-v2"><div className="section-kicker">PAUSED</div><h1>Game paused</h1><p>Waiting for the game to resume.</p></section>}
    {room.phase === 'board' && <section className="phone-state-v2"><div className="section-kicker">NEXT QUESTION</div><h1>Ready.</h1><p>Watch the main game screen.</p>{room.multiplier > 1 && <div className={`modifier-banner x${room.multiplier}`}><strong>{room.multiplier === 2 ? '2× DOUBLE POINTS' : '3× TRIPLE POINTS'}</strong></div>}{me.onFire&&<div className="status-badge fire">ON FIRE · {me.positiveStreak}</div>}{me.isCold&&<div className="status-badge cold">COLD STREAK · {me.coldStreak}</div>}</section>}

    {room.phase === 'daily-double-wager' && current?.dailyDoublePlayerId === me.id && <section className="phone-state-v2 final-phone-v2"><div className="section-kicker gold">DAILY DOUBLE · YOUR TURN</div><h1>Choose your wager</h1><p>The same preset choices are shown on the host screen.</p><div className="wager-grid phone fixed-wagers">{QUESTION_VALUES.map((value)=><button key={value} onClick={()=>void submitDailyDoubleWager(value)}>{value.toLocaleString()}</button>)}</div>{error && <p className="form-error">{error}</p>}</section>}
    {room.phase === 'daily-double-wager' && current?.dailyDoublePlayerId !== me.id && <section className="phone-state-v2"><div className="section-kicker gold">DAILY DOUBLE</div><h1>{dailyDoublePlayer?.name}</h1><p>is choosing a wager.</p><div className="spectator-wager-presets" aria-label="Available Daily Double wagers">{QUESTION_VALUES.map((value)=><span key={value}>{value.toLocaleString()}</span>)}</div></section>}

    {(room.phase === 'question' || room.phase === 'daily-double-question') && current && <section className={`phone-question-stage-v2 ${current.answerRevealed ? 'answer-visible' : ''}`}>
      <div className="phone-question-v2"><div className="section-kicker">{current.category}</div>{questionMultiplier > 1 && !current.dailyDouble && <div className={`inline-modifier x${questionMultiplier}`}>{current.baseValue} × {questionMultiplier} = {current.effectiveValue} POINTS</div>}{current.dailyDouble && current.wager !== null && <div className="phone-public-wager"><small>{dailyDoublePlayer?.avatar} {dailyDoublePlayer?.name} LOCKED IN</small><strong>{current.wager.toLocaleString()} WAGER</strong><span>{room.settings.dailyDoubleStacksWithMultiplier && questionMultiplier > 1 ? `${current.wager.toLocaleString()} × ${questionMultiplier} = ` : ''}{pointsAtStake.toLocaleString()} POINTS IN PLAY</span></div>}<h2>{current.text || 'Wager in progress…'}</h2>{!current.answerRevealed && <Timer timer={room.timer} serverNow={room.serverNow}/>}</div>

      {current.responseMode === 'text' && !current.dailyDouble ? <div className="text-response-panel">
        {!current.answerRevealed ? myResponse ? <div className="response-locked"><div className="lock-icon">✓</div><h3>Response locked</h3><p>{myResponse.answer}</p><small>Waiting for the other connected players.</small></div> : <><label>Your answer<textarea value={textAnswer} maxLength={200} onChange={(event)=>setTextAnswer(event.target.value)} placeholder="Type your response" autoFocus /></label><button className="primary-button giant" disabled={!textAnswer.trim()} onClick={() => void submitText()}>Lock Response</button></> : <div className="response-reveal-phone answer-only-phone"><small>CORRECT ANSWER</small><strong>{current.acceptedAnswers?.join(' / ')}</strong>{myResponse ? <><p>Your response: {myResponse.answer}</p><div className={`ruling-badge ${myResponse.resolvedCorrect === true ? 'correct' : myResponse.resolvedCorrect === false ? 'wrong' : ''}`}>{myResponse.resolvedCorrect === true ? 'AWARDED' : myResponse.resolvedCorrect === false ? 'REJECTED' : 'HOST REVIEWING'}</div></> : <p>No response submitted.</p>}</div>}
      </div> : current.answerRevealed ? <div className="response-reveal-phone answer-only-phone"><small>CORRECT ANSWER</small><strong>{current.acceptedAnswers?.[0]}</strong></div> : current.dailyDouble ? (current.dailyDoublePlayerId === me.id ? <div className="spoken-answer-panel"><div className="section-kicker gold">YOU HAVE IT</div><h1>Answer aloud</h1><p>Your <strong>{current.wager?.toLocaleString()}</strong> wager is locked. You are playing for <strong>{pointsAtStake.toLocaleString()}</strong> points.</p></div> : <div className="spoken-answer-panel"><div className="section-kicker">LOCKED</div><h1>Daily Double</h1><p>{dailyDoublePlayer?.name} locked <strong>{current.wager?.toLocaleString()}</strong> and is playing for <strong>{pointsAtStake.toLocaleString()}</strong> points.</p></div>) : <button type="button" className={`buzzer-button-v2 ${buzzerOpen?'open':''} ${winner?'winner':''}`} disabled={!buzzerOpen} onPointerDown={buzz}><span>{winner ? 'YOU’RE IN' : buzzerOpen ? 'BUZZ' : current.buzzWinnerId ? 'LOCKED' : 'GET READY'}</span></button>}

      {buzzMessage && !current.answerRevealed && <div className="buzz-message-v2">{buzzMessage}</div>}
      {error && <p className="form-error">{error}</p>}
    </section>}

    {room.phase === 'final-category' && <section className="phone-state-v2"><div className="section-kicker gold">FINAL ROUND</div><h1>{room.finalRound?.category}</h1><p>Get ready to wager.</p></section>}
    {room.phase === 'final-wager' && <section className="phone-state-v2 final-phone-v2"><div className="section-kicker gold">FINAL WAGER</div><h1>{room.finalRound?.category}</h1>{me.finalWagerSubmitted ? <div className="response-locked"><div className="lock-icon">✓</div><h3>Wager locked</h3><strong className="locked-wager-number">{(me.finalWager ?? 0).toLocaleString()}</strong></div> : <><p>Choose one wager.</p><div className="wager-grid phone fixed-wagers">{FINAL_WAGER_PRESETS.map((value)=><button className={selectedFinalWager===value?'selected':''} key={value} onClick={()=>setSelectedFinalWager(value)}>{value.toLocaleString()}</button>)}<button className={`all-in-wager ${selectedFinalWager===me.score && me.score>0?'selected':''}`} disabled={me.score<=0} onClick={()=>setSelectedFinalWager(me.score)}>ALL IN · {Math.max(0,me.score).toLocaleString()}</button></div><button className="primary-button giant" disabled={selectedFinalWager===null} onClick={()=>void submitFinalWager()}>Lock {selectedFinalWager === null ? 'Wager' : selectedFinalWager.toLocaleString()}</button></>}{error && <p className="form-error">{error}</p>}</section>}
    {room.phase === 'final-question' && <section className="phone-state-v2 final-phone-v2"><div className="section-kicker gold">FINAL QUESTION</div>{me.finalWagerSubmitted && <div className="locked-wager-inline">WAGER {me.finalWager?.toLocaleString()}</div>}<h1>{room.finalRound?.question}</h1><Timer timer={room.timer} serverNow={room.serverNow}/>{me.finalAnswerSubmitted ? <div className="response-locked"><div className="lock-icon">✓</div><h3>Answer locked</h3><p>{me.finalAnswer}</p></div> : <><textarea value={finalAnswer} maxLength={200} onChange={(event)=>setFinalAnswer(event.target.value)} placeholder="Type your answer"/><button className="primary-button giant" disabled={!finalAnswer.trim()} onClick={async()=>{try{await emitAck('player:final-answer',{...credentials,answer:finalAnswer})}catch(err){setError(err instanceof Error?err.message:'Failed')}}}>Lock Answer</button></>}</section>}
    {room.phase === 'final-review' && <section className="phone-state-v2"><div className="section-kicker gold">ANSWER REVEAL</div><div className="locked-wager-inline">WAGER {(me.finalWager ?? 0).toLocaleString()}</div><h1>{room.finalRound?.acceptedAnswers?.[0]}</h1><p>Watch the main screen for scoring.</p></section>}
    {room.phase === 'recap' && <section className="phone-state-v2 phone-recap-v2"><div className="section-kicker gold">YOUR FINAL STATS</div><div className="phone-recap-hero"><span>{me.avatar}</span><h1>{me.score.toLocaleString()}</h1><strong>{me.name}</strong></div><dl className="phone-stats-grid"><dt>Correct</dt><dd>{me.stats.correct}</dd><dt>Incorrect</dt><dd>{me.stats.incorrect}</dd><dt>Accuracy</dt><dd>{accuracy}%</dd><dt>Longest streak</dt><dd>{me.stats.longestStreak}</dd><dt>Fastest buzz</dt><dd>{me.stats.fastestBuzzMs == null ? '—' : `${me.stats.fastestBuzzMs}ms`}</dd><dt>Points gained</dt><dd>{me.stats.pointsGained.toLocaleString()}</dd><dt>Points lost</dt><dd>{me.stats.pointsLost.toLocaleString()}</dd><dt>Biggest wager</dt><dd>{me.stats.biggestWager.toLocaleString()}</dd></dl><button className="secondary-button" onClick={leaveToMenu}>Back to menu</button></section>}
  </main>;
}
