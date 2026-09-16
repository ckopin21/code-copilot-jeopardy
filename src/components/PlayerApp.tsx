import { useEffect, useMemo, useRef, useState } from 'react';
import { ACCENT_COLORS, AVATARS, QUESTION_VALUES } from '../shared/config';
import type { PlayerJoinCredentials, RoomSnapshot } from '../shared/types';
import { emitAck, socket } from '../lib/socket';
import { audio } from '../lib/audio';
import { menuUrl } from '../lib/resetInstance';
import { Timer } from './Timer';

const PLAYER_KEY = 'blue-stage-player';

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
  const [finalWager, setFinalWager] = useState('');
  const [finalAnswer, setFinalAnswer] = useState('');
  const [recovering, setRecovering] = useState(false);
  const syncFailuresRef = useRef(0);
  const lastQuestionIdRef = useRef('');

  useEffect(() => {
    const onState = (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
      setRecovering(false);
      syncFailuresRef.current = 0;
      setError('');
    };
    const onDisconnect = () => setRecovering(true);
    socket.on('room:state', onState);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('room:state', onState);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(PLAYER_KEY);
    if (!saved) return;
    let parsed: PlayerJoinCredentials;
    try { parsed = JSON.parse(saved) as PlayerJoinCredentials; }
    catch { localStorage.removeItem(PLAYER_KEY); return; }
    if (roomCode && parsed.roomCode !== roomCode) return;

    setCredentials(parsed);
    setRoomCode(parsed.roomCode);
    setRecovering(true);
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
      } catch {
        if (cancelled) return;
        setRecovering(true);
        setError('Reconnecting to your saved seat…');
        retryTimer = window.setTimeout(reconnect, 1500);
      }
    };

    void reconnect();
    return () => { cancelled = true; window.clearTimeout(retryTimer); };
  }, [roomCode]);

  useEffect(() => {
    if (!credentials) return;
    let syncing = false;
    const sync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        await emitAck<PlayerJoinCredentials>('player:reconnect', credentials);
        syncFailuresRef.current = 0;
      } catch {
        syncFailuresRef.current += 1;
        setRecovering(true);
        if (syncFailuresRef.current >= 2 && navigator.onLine) {
          const lastReload = Number(sessionStorage.getItem('blue-stage-player-reload') ?? 0);
          if (Date.now() - lastReload > 15000) {
            sessionStorage.setItem('blue-stage-player-reload', String(Date.now()));
            location.reload();
          }
        }
      } finally { syncing = false; }
    };
    const timer = window.setInterval(() => { void sync(); }, 4000);
    return () => window.clearInterval(timer);
  }, [credentials]);

  const me = useMemo(() => room?.players.find((player) => player.id === credentials?.playerId) ?? null, [room, credentials]);
  const current = room?.currentQuestion;

  useEffect(() => {
    const questionId = current?.questionId ?? '';
    if (questionId === lastQuestionIdRef.current) return;
    lastQuestionIdRef.current = questionId;
    setTextAnswer('');
    setBuzzMessage('');
  }, [current?.questionId]);

  const join = async () => {
    setError('');
    try {
      await audio.unlock();
      const result = await emitAck<PlayerJoinCredentials>('player:join', { roomCode, name, avatar, accent });
      localStorage.setItem(PLAYER_KEY, JSON.stringify(result));
      setCredentials(result);
      setRecovering(false);
      const url = new URL(location.href);
      url.search = `?mode=player&room=${result.roomCode}`;
      history.replaceState(null, '', url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join room');
    }
  };

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

  const leaveToMenu = () => {
    audio.stop();
    localStorage.removeItem(PLAYER_KEY);
    location.href = menuUrl();
  };

  if (!room || !me) {
    if (credentials && recovering) {
      return <main className="phone-shell phone-join"><section className="phone-card reconnect-card"><div className="phone-brand"><span>BLUE STAGE</span><strong>TRIVIA</strong></div><div className="pulse-orb"/><h1>Reconnecting</h1><p>Restoring your seat in room <strong>{credentials.roomCode}</strong>.</p><button className="secondary-button" onClick={() => { localStorage.removeItem(PLAYER_KEY); setCredentials(null); setRecovering(false); setRoom(null); setError(''); }}>Use another seat</button><button className="text-button" onClick={leaveToMenu}>Back to menu</button></section></main>;
    }
    return <main className="phone-shell phone-join"><section className="phone-card join-form-v2">
      <div className="phone-brand"><span>BLUE STAGE</span><strong>TRIVIA</strong></div>
      <label>Room code<input value={roomCode} maxLength={8} autoCapitalize="characters" onChange={(event)=>setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} placeholder="ABCDE" /></label>
      <label>Your name<input value={name} maxLength={24} onChange={(event)=>setName(event.target.value)} placeholder="Player name" /></label>
      <fieldset><legend>Avatar</legend><div className="avatar-picker-v2">{AVATARS.map((item)=><button type="button" className={item===avatar?'selected':''} key={item} onClick={()=>setAvatar(item)}>{item}</button>)}</div></fieldset>
      <fieldset><legend>Accent</legend><div className="color-picker-v2">{ACCENT_COLORS.map((item)=><button type="button" aria-label={item} className={item===accent?'selected':''} style={{background:item}} key={item} onClick={()=>setAccent(item)} />)}</div></fieldset>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button giant" disabled={!roomCode || !name.trim()} onClick={join}>Join Game</button>
      <button className="text-button" onClick={() => { location.href = menuUrl(); }}>Back to menu</button>
    </section></main>;
  }

  const buzzerOpen = room.phase === 'question' && current?.responseMode !== 'text' && current?.buzzOpen && me.buzzEligible;
  const winner = current?.buzzWinnerId === me.id;
  const myResponse = current?.textResponses?.[me.id];

  return <main className={`player-phone-v2 ${me.onFire?'phone-fire':''} ${me.isCold?'phone-cold':''}`} style={{'--accent':me.accent} as React.CSSProperties}>
    <header className="phone-header-v2"><button className="phone-menu" onClick={leaveToMenu} aria-label="Leave game">←</button><span className="phone-avatar">{me.avatar}</span><div className="phone-identity"><strong>{me.name}</strong><small>{socket.connected && !recovering ? `ROOM ${room.code}` : 'RECONNECTING…'}</small></div><b>{me.score.toLocaleString()}</b></header>

    {room.phase === 'lobby' && <section className="phone-state-v2"><div className="ready-ring"><span>{me.avatar}</span></div><div className="section-kicker">CONNECTED</div><h1>You’re in.</h1><p>Keep this screen open. Your phone becomes your controller when the game starts.</p></section>}
    {room.phase === 'paused' && <section className="phone-state-v2"><div className="section-kicker">PAUSED</div><h1>Game paused</h1><p>Waiting for the game to resume.</p></section>}
    {room.phase === 'board' && <section className="phone-state-v2"><div className="section-kicker">NEXT QUESTION</div><h1>Ready.</h1><p>Watch the main game screen.</p>{me.onFire&&<div className="status-badge fire">ON FIRE · {me.positiveStreak}</div>}{me.isCold&&<div className="status-badge cold">COLD STREAK · {me.coldStreak}</div>}</section>}

    {room.phase === 'daily-double-wager' && current?.dailyDoublePlayerId === me.id && <section className="phone-state-v2"><div className="section-kicker gold">DAILY DOUBLE</div><h1>Your wager</h1><p>Choose it on the main game screen.</p></section>}
    {room.phase === 'daily-double-wager' && current?.dailyDoublePlayerId !== me.id && <section className="phone-state-v2"><div className="section-kicker gold">DAILY DOUBLE</div><h1>{room.players.find((player)=>player.id===current?.dailyDoublePlayerId)?.name}</h1><p>is choosing a wager.</p></section>}

    {(room.phase === 'question' || room.phase === 'daily-double-question') && current && <section className="phone-question-stage-v2">
      <div className="phone-question-v2"><div className="section-kicker">{current.category}</div><h2>{current.text || 'Wager in progress…'}</h2><Timer timer={room.timer}/></div>

      {current.responseMode === 'text' && !current.dailyDouble ? <div className="text-response-panel">
        {!current.answerRevealed ? myResponse ? <div className="response-locked"><div className="lock-icon">✓</div><h3>Response locked</h3><p>{myResponse.answer}</p><small>Waiting for everyone else.</small></div> : <><label>Your answer<textarea value={textAnswer} maxLength={200} onChange={(event)=>setTextAnswer(event.target.value)} placeholder="Type your response" autoFocus /></label><button className="primary-button giant" disabled={!textAnswer.trim()} onClick={() => void submitText()}>Lock Response</button></> : <div className="response-reveal-phone"><small>CORRECT ANSWER</small><strong>{current.acceptedAnswers?.join(' / ')}</strong>{myResponse ? <><p>Your response: {myResponse.answer}</p><div className={`ruling-badge ${myResponse.resolvedCorrect === true ? 'correct' : myResponse.resolvedCorrect === false ? 'wrong' : ''}`}>{myResponse.resolvedCorrect === true ? 'AWARDED' : myResponse.resolvedCorrect === false ? 'REJECTED' : 'HOST REVIEWING'}</div></> : <p>No response submitted.</p>}</div>}
      </div> : current.dailyDouble ? (current.dailyDoublePlayerId === me.id ? <div className="spoken-answer-panel"><div className="section-kicker gold">YOU HAVE IT</div><h1>Answer aloud</h1><p>The game will reveal the answer after the ruling.</p></div> : <div className="spoken-answer-panel"><div className="section-kicker">LOCKED</div><h1>Daily Double</h1><p>{room.players.find((player)=>player.id===current.dailyDoublePlayerId)?.name} is answering.</p></div>) : <button type="button" className={`buzzer-button-v2 ${buzzerOpen?'open':''} ${winner?'winner':''}`} disabled={!buzzerOpen} onPointerDown={buzz}><span>{winner ? 'YOU’RE IN' : buzzerOpen ? 'BUZZ' : current.buzzWinnerId ? 'LOCKED' : 'GET READY'}</span></button>}

      {buzzMessage && <div className="buzz-message-v2">{buzzMessage}</div>}
      {current.responseMode !== 'text' && current.answerRevealed && <div className="response-reveal-phone"><small>CORRECT ANSWER</small><strong>{current.acceptedAnswers?.[0]}</strong></div>}
      {error && <p className="form-error">{error}</p>}
    </section>}

    {room.phase === 'final-category' && <section className="phone-state-v2"><div className="section-kicker gold">FINAL ROUND</div><h1>{room.finalRound?.category}</h1><p>Get ready to wager.</p></section>}
    {room.phase === 'final-wager' && <section className="phone-state-v2 final-phone-v2"><div className="section-kicker gold">FINAL WAGER</div><h1>{room.finalRound?.category}</h1>{me.finalWagerSubmitted ? <div className="response-locked"><div className="lock-icon">✓</div><h3>Wager locked</h3></div> : <><div className="wager-grid phone">{QUESTION_VALUES.map((value)=><button key={value} onClick={()=>setFinalWager(String(value))}>{value}</button>)}</div><input inputMode="numeric" value={finalWager} onChange={(event)=>setFinalWager(event.target.value.replace(/\D/g,''))} placeholder="Wager"/><button className="primary-button giant" disabled={finalWager===''} onClick={async()=>{try{await emitAck('player:final-wager',{...credentials,wager:Number(finalWager)})}catch(err){setError(err instanceof Error?err.message:'Failed')}}}>Lock Wager</button></>}</section>}
    {room.phase === 'final-question' && <section className="phone-state-v2 final-phone-v2"><div className="section-kicker gold">FINAL QUESTION</div><h1>{room.finalRound?.question}</h1><Timer timer={room.timer}/>{me.finalAnswerSubmitted ? <div className="response-locked"><div className="lock-icon">✓</div><h3>Answer locked</h3><p>{me.finalAnswer}</p></div> : <><textarea value={finalAnswer} maxLength={200} onChange={(event)=>setFinalAnswer(event.target.value)} placeholder="Type your answer"/><button className="primary-button giant" disabled={!finalAnswer.trim()} onClick={async()=>{try{await emitAck('player:final-answer',{...credentials,answer:finalAnswer})}catch(err){setError(err instanceof Error?err.message:'Failed')}}}>Lock Answer</button></>}</section>}
    {room.phase === 'final-review' && <section className="phone-state-v2"><div className="section-kicker gold">ANSWER REVEAL</div><h1>{room.finalRound?.acceptedAnswers?.[0]}</h1><p>Watch the main screen for scoring.</p></section>}
    {room.phase === 'recap' && <section className="phone-state-v2"><div className="section-kicker gold">FINAL SCORE</div><h1>{me.score.toLocaleString()}</h1><p>{me.stats.correct} correct · {me.stats.incorrect} incorrect</p><button className="secondary-button" onClick={leaveToMenu}>Back to menu</button></section>}
  </main>;
}
