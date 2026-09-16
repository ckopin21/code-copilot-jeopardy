import { useEffect, useMemo, useRef, useState } from 'react';
import { ACCENT_COLORS, AVATARS, QUESTION_VALUES } from '../shared/config';
import type { PlayerJoinCredentials, RoomSnapshot } from '../shared/types';
import { emitAck, socket } from '../lib/socket';
import { audio } from '../lib/audio';
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
  const [finalWager, setFinalWager] = useState('');
  const [finalAnswer, setFinalAnswer] = useState('');
  const [recovering, setRecovering] = useState(false);
  const syncFailuresRef = useRef(0);

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
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not join room'); }
  };

  const buzz = async () => {
    if (!credentials || !me?.buzzEligible) return;
    setBuzzMessage('');
    try {
      await audio.unlock();
      const result = await emitAck<{ accepted: boolean; reason?: string }>('player:buzz', credentials);
      if (result.accepted) { audio.cue('buzz'); setBuzzMessage('BUZZ REGISTERED'); }
      else { audio.cue('locked'); setBuzzMessage(result.reason ?? 'LOCKED OUT'); }
    } catch (err) { setBuzzMessage(err instanceof Error ? err.message : 'Buzz failed'); }
  };

  if (!room || !me) {
    if (credentials && recovering) {
      return <main className="player-join-screen"><div className="mini-logo big">BLUE STAGE <strong>TRIVIA</strong></div><section className="join-form panel reconnect-card"><div className="pulse-orb"/><h1>Reconnecting…</h1><p>Restoring your seat in room <strong>{credentials.roomCode}</strong>.</p><p className="muted">Your player ID and score are saved on this device.</p><button className="secondary-button" onClick={() => { localStorage.removeItem(PLAYER_KEY); setCredentials(null); setRecovering(false); setRoom(null); setError(''); }}>Forget saved seat</button></section></main>;
    }
    return <main className="player-join-screen"><div className="mini-logo big">BLUE STAGE <strong>TRIVIA</strong></div><section className="join-form panel">
      <label>Room code<input value={roomCode} maxLength={8} autoCapitalize="characters" onChange={(event)=>setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} placeholder="ABCDE" /></label>
      <label>Your name<input value={name} maxLength={24} onChange={(event)=>setName(event.target.value)} placeholder="Player name" /></label>
      <fieldset><legend>Avatar</legend><div className="avatar-picker">{AVATARS.map((item)=><button type="button" className={item===avatar?'selected':''} key={item} onClick={()=>setAvatar(item)}>{item}</button>)}</div></fieldset>
      <fieldset><legend>Accent</legend><div className="color-picker">{ACCENT_COLORS.map((item)=><button type="button" aria-label={item} className={item===accent?'selected':''} style={{background:item}} key={item} onClick={()=>setAccent(item)} />)}</div></fieldset>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button giant" disabled={!roomCode || !name.trim()} onClick={join}>Join Game</button>
    </section></main>;
  }

  const current = room.currentQuestion;
  const buzzerOpen = room.phase === 'question' && current?.buzzOpen && me.buzzEligible;
  const winner = current?.buzzWinnerId === me.id;

  return <main className={`player-phone ${me.onFire?'phone-fire':''} ${me.isCold?'phone-cold':''}`} style={{'--accent':me.accent} as React.CSSProperties}>
    <header className="phone-header"><span>{me.avatar}</span><div><strong>{me.name}</strong><small>{socket.connected && !recovering ? 'Connected' : 'Reconnecting…'}</small></div><b>{me.score.toLocaleString()}</b></header>
    {room.phase === 'lobby' && <section className="phone-state"><div className="pulse-orb"/><h1>You’re in</h1><p>Waiting for the host to start.</p><strong>Room {room.code}</strong></section>}
    {room.phase === 'paused' && <section className="phone-state"><h1>Paused</h1><p>The host paused the game.</p></section>}
    {room.phase === 'board' && <section className="phone-state"><h1>Ready</h1><p>Watch the main board for the next question.</p>{me.onFire&&<div className="status-badge fire">ON FIRE · {me.positiveStreak}</div>}{me.isCold&&<div className="status-badge cold">COLD STREAK · {me.coldStreak}</div>}</section>}
    {room.phase === 'daily-double-wager' && current?.dailyDoublePlayerId === me.id && <section className="phone-state"><div className="eyebrow">DAILY DOUBLE</div><h1>Your wager</h1><p>Choose it on the host screen.</p></section>}
    {room.phase === 'daily-double-wager' && current?.dailyDoublePlayerId !== me.id && <section className="phone-state"><h1>Daily Double</h1><p>{room.players.find((player)=>player.id===current?.dailyDoublePlayerId)?.name} is wagering.</p></section>}
    {(room.phase === 'question' || room.phase === 'daily-double-question') && current && <section className="buzzer-stage">
      <div className="phone-question"><small>{current.category}</small><h2>{current.text || 'Wager in progress…'}</h2><Timer timer={room.timer}/></div>
      {current.dailyDouble ? (current.dailyDoublePlayerId === me.id ? <div className="phone-state compact"><h1>Your answer</h1><p>Say it aloud. The host will mark it correct or incorrect.</p></div> : <div className="phone-state compact"><h1>Locked</h1><p>Daily Double belongs to {room.players.find((player)=>player.id===current.dailyDoublePlayerId)?.name}.</p></div>) : <button type="button" className={`buzzer-button ${buzzerOpen?'open':''} ${winner?'winner':''}`} disabled={!buzzerOpen} onPointerDown={buzz}>{winner ? 'YOU’RE IN!' : buzzerOpen ? 'BUZZ' : current.buzzWinnerId ? 'LOCKED' : 'GET READY'}</button>}
      {buzzMessage && <div className="buzz-message">{buzzMessage}</div>}
      {current.answerRevealed && <div className="phone-answer">Answer: <strong>{current.acceptedAnswers?.[0]}</strong></div>}
    </section>}
    {room.phase === 'final-category' && <section className="phone-state"><div className="eyebrow">FINAL ROUND</div><h1>{room.finalRound?.category}</h1><p>Get ready to wager.</p></section>}
    {room.phase === 'final-wager' && <section className="phone-state final-phone"><div className="eyebrow">FINAL WAGER</div><h1>{room.finalRound?.category}</h1>{me.finalWagerSubmitted ? <div className="locked-card">Wager locked in</div> : <><div className="wager-grid phone">{QUESTION_VALUES.map((value)=><button key={value} onClick={()=>setFinalWager(String(value))}>{value}</button>)}</div><input inputMode="numeric" value={finalWager} onChange={(event)=>setFinalWager(event.target.value.replace(/\D/g,''))} placeholder="Wager"/><button className="primary-button" disabled={finalWager===''} onClick={async()=>{try{await emitAck('player:final-wager',{...credentials,wager:Number(finalWager)})}catch(err){setError(err instanceof Error?err.message:'Failed')}}}>Lock Wager</button></>}</section>}
    {room.phase === 'final-question' && <section className="phone-state final-phone"><div className="eyebrow">FINAL QUESTION</div><h1>{room.finalRound?.question}</h1><Timer timer={room.timer}/>{me.finalAnswerSubmitted ? <div className="locked-card">Answer locked in</div> : <><textarea value={finalAnswer} maxLength={200} onChange={(event)=>setFinalAnswer(event.target.value)} placeholder="Type your answer"/><button className="primary-button" disabled={!finalAnswer.trim()} onClick={async()=>{try{await emitAck('player:final-answer',{...credentials,answer:finalAnswer})}catch(err){setError(err instanceof Error?err.message:'Failed')}}}>Lock Answer</button></>}</section>}
    {room.phase === 'final-review' && <section className="phone-state"><h1>Answer reveal</h1><p>Watch the main screen.</p></section>}
    {room.phase === 'recap' && <section className="phone-state"><div className="eyebrow">FINAL SCORE</div><h1>{me.score.toLocaleString()}</h1><p>{me.stats.correct} correct · {me.stats.incorrect} incorrect</p></section>}
  </main>;
}
