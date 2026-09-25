import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QUESTION_VALUES } from '../config';
import type { RoomSnapshot } from '../types';
import type { PlayerJoinCredentials } from '../../../platform/rooms/types';
import { emitAck, resumeClientSession, socket, suspendClientSession } from '../../../platform/net/socket';
import { audio } from '../../../platform/audio/audio';
import { menuUrl } from '../../../platform/session/resetInstance';
import { turnIndicatorVisible } from '../ui/gameUiRules';
import { finalWagerRules } from '../rules/finalWagerRules';
import { freeResponseReadingTimer } from '../ui/freeResponseFlow';
import { shouldRefreshAfterHeartbeatFailures } from '../../../platform/net/clientRecoveryPolicy';
import { Timer } from './Timer';
import { QrScanner } from '../../../platform/ui/QrScanner';
import { PlayerAvatar } from '../../../platform/players/PlayerAvatar';
import { PlayerJoinCustomization } from './PlayerJoinCustomization';
import { triggerScoreImpactEffect } from '../../../platform/players/scoreEffects';
import {
  DEFAULT_PLAYER_CUSTOMIZATION,
  PLAYER_ACCENTS,
  getAvatarOption,
  normalizePlayerCustomization,
  type PlayerBuzzerSound,
  type PlayerScoreEffect,
  type PlayerVictoryEffect
} from '../../../platform/players/playerCustomization';

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
  const [avatarId, setAvatarId] = useState<string>(DEFAULT_PLAYER_CUSTOMIZATION.avatarId);
  const [accent, setAccent] = useState<string>(PLAYER_ACCENTS[0].color);
  const [buzzerSound, setBuzzerSound] = useState<PlayerBuzzerSound>(DEFAULT_PLAYER_CUSTOMIZATION.buzzerSound);
  const [scoreEffect, setScoreEffect] = useState<PlayerScoreEffect>(DEFAULT_PLAYER_CUSTOMIZATION.scoreEffect);
  const [victoryEffect, setVictoryEffect] = useState<PlayerVictoryEffect>(DEFAULT_PLAYER_CUSTOMIZATION.victoryEffect);
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
  const scoreTargetRef = useRef<HTMLElement | null>(null);
  const previousScoreRef = useRef<{ playerId: string; score: number } | null>(null);

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
        setError(message);
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
        await emitAck('player:heartbeat', credentials);
        syncFailuresRef.current = 0;
        setRecovering(false);
      } catch (err) {
        syncFailuresRef.current += 1;
        if (shouldRefreshAfterHeartbeatFailures(syncFailuresRef.current)) {
          setRecovering(true);
          setError(err instanceof Error ? `Connection interrupted: ${err.message}. Rebuilding the connection automatically.` : 'Connection interrupted. Rebuilding the connection automatically.');
          resumeClientSession(false, true);
        }
      } finally { syncing = false; }
    };
    const timer = window.setInterval(() => { void sync(); }, 3000);
    return () => window.clearInterval(timer);
  }, [credentials, room?.code, hostSuspended]);

  const me = useMemo(() => room?.players.find((player) => player.id === credentials?.playerId) ?? null, [room, credentials]);
  const current = room?.currentQuestion;

  useEffect(() => {
    if (!me) {
      previousScoreRef.current = null;
      return;
    }
    const previous = previousScoreRef.current;
    if (previous?.playerId === me.id && previous.score !== me.score && scoreTargetRef.current) {
      triggerScoreImpactEffect({
        scoreTarget: scoreTargetRef.current,
        effect: normalizePlayerCustomization(me).scoreEffect,
        delta: me.score - previous.score
      });
    }
    previousScoreRef.current = { playerId: me.id, score: me.score };
  }, [me]);

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
    if (room.phase === 'board') lastMultiplierRef.current = nextMultiplier;
  }, [room]);

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
      const avatar = getAvatarOption(avatarId);
      const result = await emitAck<PlayerJoinCredentials>('player:join', {
        roomCode, name, avatar: avatar.fallback, avatarId, accent, buzzerSound, scoreEffect, victoryEffect
      });
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
    resumeClientSession(true);
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
    if (!credentials || !room || !me?.buzzEligible) return;
    setBuzzMessage('');
    try {
      await audio.unlock();
      const result = await emitAck<{ accepted: boolean; reason?: string }>('player:buzz', { ...credentials, questionId: room.currentQuestion?.questionId, gameStartedAt: room.gameStartedAt });
      if (result.accepted) { audio.playerBuzz(normalizePlayerCustomization(me).buzzerSound); setBuzzMessage('BUZZ REGISTERED'); }
      else { audio.cue('locked'); setBuzzMessage(result.reason ?? 'LOCKED OUT'); }
    } catch (err) {
      setBuzzMessage(err instanceof Error ? err.message : 'Buzz failed');
    }
  };

  const submitText = async () => {
    if (!credentials || !room || !textAnswer.trim()) return;
    setError('');
    try {
      await emitAck('player:text-response', { ...credentials, answer: textAnswer.trim(), questionId: room.currentQuestion?.questionId, gameStartedAt: room.gameStartedAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not lock response');
    }
  };

  const submitDailyDoubleWager = async (wager: number) => {
    if (!credentials || !room) return;
    setError('');
    try { await emitAck('player:daily-double-wager', { ...credentials, wager, questionId: room.currentQuestion?.questionId, gameStartedAt: room.gameStartedAt }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not lock wager'); }
  };

  const submitFinalWager = async () => {
    if (!credentials || !room || selectedFinalWager === null) return;
    setError('');
    try { await emitAck('player:final-wager', { ...credentials, wager: selectedFinalWager, gameStartedAt: room.gameStartedAt }); }
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
      return <main className="phone-shell phone-join"><section className="phone-card reconnect-card"><div className="phone-brand"><span>BLUE STAGE</span><strong>TRIVIA</strong></div><div className="pulse-orb"/><h1>Reconnecting</h1><p>Restoring your seat in room <strong>{credentials.roomCode}</strong>.</p>{error && <p className="form-error" role="status">{error}</p>}<button className="secondary-button" onClick={forgetSeat}>Use another seat</button><button className="text-button" onClick={leaveToMenu}>Back to menu</button></section></main>;
    }
    return <main className="phone-shell phone-join"><section className="phone-card join-form-v2">
      <div className="phone-brand"><span>BLUE STAGE</span><strong>TRIVIA</strong></div>
      {credentials && <div className="saved-seat-notice"><strong>Saved seat: {credentials.roomCode}</strong><button type="button" className="text-button" onClick={forgetSeat}>Use another seat</button></div>}
      <div className="join-code-row"><label>Room code<input value={roomCode} maxLength={8} autoCapitalize="characters" onChange={(event)=>setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} placeholder="ABCDE" /></label><button type="button" className="secondary-button scan-qr-button" onClick={()=>setShowScanner(true)}>Scan QR</button></div>
      <label>Your name<input value={name} maxLength={24} onChange={(event)=>setName(event.target.value)} placeholder="Player name" /></label>
      <PlayerJoinCustomization
        name={name} avatarId={avatarId} accent={accent}
        buzzerSound={buzzerSound} scoreEffect={scoreEffect} victoryEffect={victoryEffect}
        onAvatarId={setAvatarId} onAccent={setAccent}
        onBuzzerSound={setBuzzerSound} onScoreEffect={setScoreEffect} onVictoryEffect={setVictoryEffect}
      />
      {error && <p className={error.startsWith('Room code scanned') ? 'form-success' : 'form-error'}>{error}</p>}
      <button className="primary-button giant" disabled={!roomCode || !name.trim() || Boolean(credentials) || joining} aria-busy={joining} onClick={join}>{joining ? 'Joining…' : 'Join Game'}</button>
      <button className="text-button" onClick={leaveToMenu}>Back to menu</button>
      {showScanner && <QrScanner onResult={handleQrResult} onClose={()=>setShowScanner(false)}/>} 
    </section></main>;
  }

  const customization = normalizePlayerCustomization(me);
  const buzzerOpen = room.phase === 'question' && current?.responseMode !== 'text' && current?.buzzOpen && me.buzzEligible;
  const winner = current?.buzzWinnerId === me.id;
  const myResponse = current?.textResponses?.[me.id];
  const readingTimer = freeResponseReadingTimer(current, room.settings, room.serverNow);
  const isQuestionParticipant = !current?.participantIds || current.participantIds.includes(me.id);
  const isFinalParticipant = Boolean(room.finalRound?.participantIds.includes(me.id));
  const isResultPlayer = room.resultPlayerIds ? room.resultPlayerIds.includes(me.id) : true;
  const showFinalWager = isFinalParticipant && (room.phase === 'final-wager' || room.phase === 'final-question' || room.phase === 'final-review');
  const questionMultiplier = current ? Math.max(1, Math.round(current.effectiveValue / Math.max(1, current.baseValue))) : 1;
  const pointsAtStake = current ? current.dailyDouble
    ? (current.wager ?? 0) * (room.settings.dailyDoubleStacksWithMultiplier ? questionMultiplier : 1)
    : current.effectiveValue : 0;
  const pendingMissPenalty = current?.pendingIncorrectValue ?? pointsAtStake;
  const dailyDoublePlayer = current?.dailyDoublePlayerId ? room.players.find((player) => player.id === current.dailyDoublePlayerId) : null;
  const accuracy = Math.round(me.stats.correct / Math.max(1, me.stats.correct + me.stats.incorrect) * 100);
  const showTurnIndicator = turnIndicatorVisible(room.phase);
  const finalWagerRule = isFinalParticipant ? finalWagerRules(room, me.id) : null;
  const showAllIn = Boolean(finalWagerRule?.allInAllowed && !FINAL_WAGER_PRESETS.some((value) => value === me.score));

  return <main className={`player-phone-v2 ${me.onFire?'phone-fire':''} ${me.isCold?'phone-cold':''}`} data-score-effect={customization.scoreEffect} data-victory-effect={customization.victoryEffect} style={{'--accent':me.accent} as React.CSSProperties}>
    <header className="phone-header-v2"><button className="phone-menu" onClick={leaveToMenu} aria-label="Back to menu">←</button><span className="phone-avatar"><PlayerAvatar avatarId={me.avatarId} fallback={me.avatar} accent={me.accent} /></span><div className="phone-identity"><strong>{me.name}</strong><small className={showTurnIndicator && room.turnPlayerId === me.id ? 'phone-turn-line' : ''}>{!recovering && socket.connected ? `${showTurnIndicator && room.turnPlayerId === me.id ? 'YOUR TURN · ' : ''}ROOM ${room.code}` : 'RECONNECTING…'}</small></div><div className="phone-score-stack"><b ref={scoreTargetRef} data-player-score={me.id}>{me.score.toLocaleString()}</b>{me.onFire && <small className="phone-header-streak fire">🔥 ON FIRE</small>}{me.isCold && <small className="phone-header-streak cold">❄ COLD</small>}{showFinalWager && me.finalWagerSubmitted && me.finalWager !== null && <small className="phone-wager-pill">WAGER {me.finalWager.toLocaleString()}</small>}</div></header>
    {recovering && error && <p className="form-error" role="status">{error}</p>}

    {modifierReveal && <div className={`modifier-reveal-overlay x${modifierReveal}`} aria-live="polite"><div className="modifier-reveal-card"><span>{modifierReveal === 2 ? 'FINAL SIX' : 'FINAL THREE'}</span><strong>{modifierReveal === 2 ? 'DOUBLE POINTS' : 'TRIPLE POINTS'}</strong><p>{modifierReveal === 2 ? 'Every question is now worth 2×.' : 'Every remaining question is now worth 3×.'}</p></div></div>}

    {room.phase === 'lobby' && <section className="phone-state-v2"><div className="ready-ring"><PlayerAvatar avatarId={me.avatarId} fallback={me.avatar} accent={me.accent} /></div><div className="section-kicker">CONNECTED</div><h1>{room.gameStartedAt === null ? 'You’re in.' : 'Game reset.'}</h1><p>Your seat is ready. Watch the host screen for the next game.</p></section>}
    {room.phase === 'paused' && <section className="phone-state-v2"><div className="section-kicker">PAUSED</div><h1>Game paused</h1><p>Waiting for the game to resume.</p></section>}
    {room.phase === 'board' && <section className="phone-state-v2"><div className="section-kicker">{room.turnPlayerId === me.id ? 'YOUR TURN' : 'NEXT QUESTION'}</div><h1>{room.turnPlayerId === me.id ? 'You pick.' : 'Ready.'}</h1><p>{room.turnPlayerId === me.id ? 'Choose the next question on the main game screen.' : 'Watch the main game screen.'}</p>{room.multiplier > 1 && <div className={`modifier-banner x${room.multiplier}`}><strong>{room.multiplier === 2 ? '2× DOUBLE POINTS' : '3× TRIPLE POINTS'}</strong></div>}{me.onFire&&<div className="status-badge fire">ON FIRE · {me.positiveStreak}</div>}{me.isCold&&<div className="status-badge cold">COLD STREAK · {me.coldStreak}</div>}</section>}

    {room.phase === 'daily-double-wager' && current?.dailyDoublePlayerId === me.id && <section className="phone-state-v2 final-phone-v2"><div className="section-kicker gold">DAILY DOUBLE · YOUR TURN</div><h1>Choose your wager</h1><p>The same preset choices are shown on the host screen.</p><div className="wager-grid phone fixed-wagers">{QUESTION_VALUES.map((value)=><button key={value} onClick={()=>void submitDailyDoubleWager(value)}>{value.toLocaleString()}</button>)}</div>{error && <p className="form-error">{error}</p>}</section>}
    {room.phase === 'daily-double-wager' && current?.dailyDoublePlayerId !== me.id && <section className="phone-state-v2"><div className="section-kicker gold">DAILY DOUBLE</div><h1>{dailyDoublePlayer?.name}</h1><p>is choosing a wager.</p><div className="spectator-wager-presets" aria-label="Available Daily Double wagers">{QUESTION_VALUES.map((value)=><span key={value}>{value.toLocaleString()}</span>)}</div></section>}

    {(room.phase === 'question' || room.phase === 'daily-double-question') && current && <section className={`phone-question-stage-v2 ${current.answerRevealed ? 'answer-visible' : ''}`}>
      <div className="phone-question-v2"><div className="section-kicker">{current.category}</div>{questionMultiplier > 1 && !current.dailyDouble && <div className={`inline-modifier x${questionMultiplier}`}>{current.baseValue} × {questionMultiplier} = {current.effectiveValue} POINTS</div>}{current.dailyDouble && current.wager !== null && <div className="phone-public-wager"><small>{dailyDoublePlayer?.avatar} {dailyDoublePlayer?.name} LOCKED IN</small><strong>{current.wager.toLocaleString()} WAGER</strong><span>{room.settings.dailyDoubleStacksWithMultiplier && questionMultiplier > 1 ? `${current.wager.toLocaleString()} × ${questionMultiplier} = ` : ''}{pointsAtStake.toLocaleString()} POINTS IN PLAY</span></div>}<h2>{current.text || 'Wager in progress…'}</h2>{!current.answerRevealed && <Timer timer={room.timer} serverNow={room.serverNow}/>}</div>

      {!isQuestionParticipant && !current.answerRevealed ? <div className="spoken-answer-panel"><div className="section-kicker">NEXT QUESTION</div><h1>Watching this one</h1><p>You joined after this question started. You’ll be active on the next question.</p></div> : current.responseMode === 'text' && !current.dailyDouble ? <div className="text-response-panel">
        {!current.answerRevealed ? readingTimer ? <div className="reading-lock-panel"><div className="section-kicker">READING TIME</div><h3>Read the question first.</h3><Timer timer={readingTimer} serverNow={room.serverNow} /><p>Your answer box opens when the countdown reaches zero.</p></div> : myResponse ? <div className="response-locked"><div className="lock-icon">✓</div><h3>Response locked</h3><p>{myResponse.answer}</p><small>Waiting for the other active players.</small></div> : <><label>Your answer<textarea value={textAnswer} maxLength={200} onChange={(event)=>setTextAnswer(event.target.value)} placeholder="Type your response" autoFocus /></label><button className="primary-button giant" disabled={!textAnswer.trim()} onClick={() => void submitText()}>Lock Response</button></> : <div className="response-reveal-phone answer-only-phone"><small>CORRECT ANSWER</small><strong>{current.acceptedAnswers?.join(' / ')}</strong>{myResponse ? <><p>Your response: {myResponse.answer}</p><div className={`ruling-badge ${myResponse.resolvedCorrect === true ? 'correct' : myResponse.resolvedCorrect === false ? 'wrong' : ''}`}>{myResponse.resolvedCorrect === true ? 'AWARDED' : myResponse.resolvedCorrect === false ? 'REJECTED' : 'HOST REVIEWING'}</div>{myResponse.resolvedCorrect === null && <small>If rejected: -{pendingMissPenalty.toLocaleString()} points</small>}</> : <><p>No response submitted.</p><div className="ruling-badge wrong">PENDING -{pendingMissPenalty.toLocaleString()}</div></>}</div>}
      </div> : current.answerRevealed ? <div className="response-reveal-phone answer-only-phone"><small>CORRECT ANSWER</small><strong>{current.acceptedAnswers?.[0]}</strong></div> : current.dailyDouble ? (current.dailyDoublePlayerId === me.id ? <div className="spoken-answer-panel"><div className="section-kicker gold">YOU HAVE IT</div><h1>Answer aloud</h1><p>Your <strong>{current.wager?.toLocaleString()}</strong> wager is locked. You are playing for <strong>{pointsAtStake.toLocaleString()}</strong> points.</p></div> : <div className="spoken-answer-panel"><div className="section-kicker">LOCKED</div><h1>Daily Double</h1><p>{dailyDoublePlayer?.name} locked <strong>{current.wager?.toLocaleString()}</strong> and is playing for <strong>{pointsAtStake.toLocaleString()}</strong> points.</p></div>) : <button type="button" className={`buzzer-button-v2 ${buzzerOpen?'open':''} ${winner?'winner':''}`} disabled={!buzzerOpen} onPointerDown={buzz}><span>{winner ? 'YOU’RE IN' : buzzerOpen ? 'BUZZ' : current.buzzWinnerId ? 'LOCKED' : 'GET READY'}</span></button>}

      {buzzMessage && !current.answerRevealed && <div className="buzz-message-v2">{buzzMessage}</div>}
      {error && <p className="form-error">{error}</p>}
    </section>}

    {room.phase === 'final-category' && (isFinalParticipant ? <section className="phone-state-v2"><div className="section-kicker gold">FINAL ROUND</div><h1>{room.finalRound?.category}</h1><p>Get ready to wager.</p></section> : <section className="phone-state-v2"><div className="section-kicker gold">FINAL ROUND</div><h1>Watching this Final</h1><p>You joined after the Final roster was locked. Your seat is ready for the next game.</p></section>)}
    {room.phase === 'final-wager' && (isFinalParticipant ? <section className="phone-state-v2 final-phone-v2"><div className="section-kicker gold">FINAL WAGER</div><h1>{room.finalRound?.category}</h1>{me.finalWagerSubmitted ? <div className="response-locked"><div className="lock-icon">✓</div><h3>Wager locked</h3><strong className="locked-wager-number">{(me.finalWager ?? 0).toLocaleString()}</strong></div> : <><p>Choose one wager.</p>{finalWagerRule?.protectedLoss && <div className="final-wager-rule comeback"><strong>COMEBACK PROTECTION</strong><span>Up to {finalWagerRule.maxWager.toLocaleString()}. A miss will not lower your score.</span></div>}{finalWagerRule?.runawayLeaderCap && <div className="final-wager-rule leader"><strong>LEADER CAP</strong><span>Your lead is at least 2× the next score, so Final is capped at {finalWagerRule.maxWager.toLocaleString()}.</span></div>}<div className="wager-grid phone fixed-wagers">{FINAL_WAGER_PRESETS.map((value)=><button className={selectedFinalWager===value?'selected':''} disabled={Boolean(finalWagerRule && value > finalWagerRule.maxWager)} key={value} onClick={()=>setSelectedFinalWager(value)}>{value.toLocaleString()}</button>)}{showAllIn && <button className={`all-in-wager ${selectedFinalWager===me.score?'selected':''}`} onClick={()=>setSelectedFinalWager(me.score)}>ALL IN · {me.score.toLocaleString()}</button>}</div><button className="primary-button giant" disabled={selectedFinalWager===null || Boolean(finalWagerRule && selectedFinalWager > finalWagerRule.maxWager)} onClick={()=>void submitFinalWager()}>Lock {selectedFinalWager === null ? 'Wager' : selectedFinalWager.toLocaleString()}</button></>}{error && <p className="form-error">{error}</p>}</section> : <section className="phone-state-v2"><div className="section-kicker gold">FINAL WAGER</div><h1>Watching this Final</h1><p>The Final roster was already locked when you joined.</p></section>)}
    {room.phase === 'final-question' && (isFinalParticipant ? <section className="phone-state-v2 final-phone-v2"><div className="section-kicker gold">FINAL QUESTION</div>{me.finalWagerSubmitted && <div className="locked-wager-inline">WAGER {me.finalWager?.toLocaleString()}</div>}<h1>{room.finalRound?.question}</h1><Timer timer={room.timer} serverNow={room.serverNow}/>{me.finalAnswerSubmitted ? <div className="response-locked"><div className="lock-icon">✓</div><h3>Answer locked</h3><p>{me.finalAnswer}</p></div> : <><textarea value={finalAnswer} maxLength={200} onChange={(event)=>setFinalAnswer(event.target.value)} placeholder="Type your answer"/><button className="primary-button giant" disabled={!finalAnswer.trim()} onClick={async()=>{try{await emitAck('player:final-answer',{...credentials,answer:finalAnswer,gameStartedAt:room.gameStartedAt})}catch(err){setError(err instanceof Error?err.message:'Failed')}}}>Lock Answer</button></>}</section> : <section className="phone-state-v2"><div className="section-kicker gold">FINAL QUESTION</div><h1>Watch the main screen</h1><p>You are spectating this Final and will play in the next game.</p></section>)}
    {room.phase === 'final-review' && (isFinalParticipant ? <section className="phone-state-v2"><div className="section-kicker gold">ANSWER REVEAL</div><div className="locked-wager-inline">WAGER {(me.finalWager ?? 0).toLocaleString()}</div><h1>{room.finalRound?.acceptedAnswers?.[0]}</h1><p>Watch the main screen for scoring.</p></section> : <section className="phone-state-v2"><div className="section-kicker gold">ANSWER REVEAL</div><h1>Watching the results</h1><p>Your seat is reserved for the next game.</p></section>)}
    {room.phase === 'recap' && (isResultPlayer ? <section className="phone-state-v2 phone-recap-v2"><div className="section-kicker gold">YOUR FINAL STATS</div><div className="phone-recap-hero"><span><PlayerAvatar avatarId={me.avatarId} fallback={me.avatar} accent={me.accent} /></span><h1>{me.score.toLocaleString()}</h1><strong>{me.name}</strong></div><dl className="phone-stats-grid"><dt>Correct</dt><dd>{me.stats.correct}</dd><dt>Incorrect</dt><dd>{me.stats.incorrect}</dd><dt>Accuracy</dt><dd>{accuracy}%</dd><dt>Longest streak</dt><dd>{me.stats.longestStreak}</dd><dt>Fastest buzz</dt><dd>{me.stats.fastestBuzzMs == null ? '—' : `${me.stats.fastestBuzzMs}ms`}</dd><dt>Points gained</dt><dd>{me.stats.pointsGained.toLocaleString()}</dd><dt>Points lost</dt><dd>{me.stats.pointsLost.toLocaleString()}</dd><dt>Biggest wager</dt><dd>{me.stats.biggestWager.toLocaleString()}</dd></dl><button className="secondary-button" onClick={leaveToMenu}>Back to menu</button></section> : <section className="phone-state-v2"><div className="section-kicker gold">GAME COMPLETE</div><h1>Ready for the next game</h1><p>You joined after this game’s results were locked, so you are not included in this scoreboard.</p><button className="secondary-button" onClick={leaveToMenu}>Back to menu</button></section>)}
  </main>;
}
