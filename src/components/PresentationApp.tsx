import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RoomSnapshot } from '../shared/types';
import { emitAck, resumeClientSession, socket, suspendClientSession } from '../lib/socket';
import { Board } from './Board';
import { PlayerStrip } from './PlayerStrip';
import { Timer } from './Timer';
import { audio } from '../lib/audio';
import { scoreboardWagersVisible, turnIndicatorLabel, turnIndicatorVisible } from '../lib/gameUiRules';
import { ScoreFlight, type ScoreFlightState } from './ScoreFlight';
import { gameModeDefinition } from '../shared/gameModes';
import { freeResponseReadingTimer } from '../lib/freeResponseFlow';
import { PlayerAvatar } from './PlayerAvatar';
import { normalizePlayerCustomization } from '../shared/playerCustomization';

function musicFor(room: RoomSnapshot) {
  if (room.phase.startsWith('final')) return 'final' as const;
  if (room.phase === 'recap') return 'winner' as const;
  if (room.currentQuestion?.dailyDouble) return 'daily-double' as const;
  if (room.phase === 'question') return 'thinking' as const;
  if (room.multiplier === 3) return 'triple' as const;
  if (room.multiplier === 2) return 'double' as const;
  return room.phase === 'lobby' ? 'lobby' as const : 'board' as const;
}

type PresentationScoreEvent = {
  roomCode: string;
  playerId: string;
  delta: number;
  previousScore: number;
  nextScore: number;
  questionId: string | null;
  actionId: string;
};

export function PresentationApp() {
  const roomCode = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
  const presentationToken = new URLSearchParams(location.search).get('display') ?? '';
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState('');
  const [audioReady, setAudioReady] = useState(false);
  const [scoreFlights, setScoreFlights] = useState<ScoreFlightState[]>([]);
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, number>>({});
  const [connectionOnline, setConnectionOnline] = useState(socket.connected);
  const pendingFlightsRef = useRef<ScoreFlightState[]>([]);
  const seenScoreEventsRef = useRef(new Set<string>());

  const applySnapshot = useCallback((snapshot: RoomSnapshot) => {
    setRoom(snapshot);
  }, []);

  const handleScoreImpact = useCallback((flight: ScoreFlightState) => {
    const nextScore = flight.nextScore;
    if (nextScore !== undefined) {
      setScoreOverrides((current) => ({ ...current, [flight.playerId]: nextScore }));
    }
  }, []);
  const handleScoreComplete = useCallback((flightId: string) => {
    const completed = pendingFlightsRef.current.find((flight) => flight.id === flightId);
    pendingFlightsRef.current = pendingFlightsRef.current.filter((flight) => flight.id !== flightId);
    setScoreFlights(pendingFlightsRef.current);
    if (completed && !pendingFlightsRef.current.some((flight) => flight.playerId === completed.playerId)) {
      setScoreOverrides((current) => {
        const next = { ...current };
        delete next[completed.playerId];
        return next;
      });
    }
  }, []);

  useEffect(() => {
    resumeClientSession();
    const onState = (snapshot: RoomSnapshot) => applySnapshot(snapshot);
    const onScore = (event: PresentationScoreEvent) => {
      if (event.roomCode !== roomCode || !event.playerId || !Number.isFinite(event.delta) || event.delta === 0 || !Number.isFinite(event.previousScore) || !Number.isFinite(event.nextScore)) return;
      const eventKey = `${event.actionId}:${event.playerId}`;
      if (seenScoreEventsRef.current.has(eventKey)) return;
      seenScoreEventsRef.current.add(eventKey);
      if (seenScoreEventsRef.current.size > 256) {
        const oldest = seenScoreEventsRef.current.values().next().value;
        if (oldest) seenScoreEventsRef.current.delete(oldest);
      }
      const flight: ScoreFlightState = {
        id: eventKey,
        questionId: event.questionId || 'presentation-score-change',
        playerId: event.playerId,
        delta: event.delta,
        correct: event.delta > 0,
        nextScore: event.nextScore
      };
      pendingFlightsRef.current = [...pendingFlightsRef.current, flight];
      setScoreFlights(pendingFlightsRef.current);
      setScoreOverrides((current) => event.playerId in current ? current : { ...current, [event.playerId]: event.previousScore });
    };
    const onConnect = () => { setConnectionOnline(true); setError(''); };
    const onDisconnect = () => {
      setConnectionOnline(false);
      setError('Display disconnected. Check the laptop server, or ask the Host for a new display link.');
      pendingFlightsRef.current = [];
      setScoreFlights([]);
      setScoreOverrides({});
    };
    const onDiagnostic = (diagnostic: { kind?: string }) => {
      if (diagnostic.kind !== 'identity-rejected') return;
      setConnectionOnline(false);
      setError('This display link is no longer valid. Ask the Host for the current display link.');
    };
    socket.on('room:state', onState);
    socket.on('room:score', onScore);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('network:diagnostic', onDiagnostic);
    void emitAck<RoomSnapshot>('presentation:join', { roomCode, presentationToken }).then((snapshot) => { applySnapshot(snapshot); setConnectionOnline(true); setError(''); }).catch((err) => { setConnectionOnline(false); setError(err instanceof Error ? err.message : 'Could not join game'); });
    return () => {
      socket.off('room:state', onState);
      socket.off('room:score', onScore);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('network:diagnostic', onDiagnostic);
      suspendClientSession();
      audio.stop();
    };
  }, [roomCode, presentationToken, applySnapshot]);

  const musicState = room ? musicFor(room) : null;
  useEffect(() => {
    if (!audioReady || !musicState) return;
    void audio.setMusic(musicState);
  }, [audioReady, musicState]);

  const resultPlayers = useMemo(() => {
    if (!room) return [];
    const ids = room.resultPlayerIds ? new Set(room.resultPlayerIds) : null;
    return ids ? room.players.filter((player) => ids.has(player.id)) : room.players;
  }, [room]);
  const winners = useMemo(() => {
    if (!room || room.phase !== 'recap' || !resultPlayers.length) return [];
    const max = Math.max(...resultPlayers.map((player) => player.score));
    return resultPlayers.filter((player) => player.score === max);
  }, [room, resultPlayers]);

  if (!room || !connectionOnline) return <main className="presentation-shell presentation-boot" role="status"><div className="brand-mark"><span>BLUE STAGE</span><strong>TRIVIA</strong></div><p>{error || 'Connecting to game…'}</p></main>;

  const current = room.currentQuestion;
  const gameMode = gameModeDefinition(room.settings.gameMode);
  const active = current?.buzzWinnerId ?? current?.dailyDoublePlayerId;
  const connectedPlayers = room.players.filter((player) => player.connected);
  const activeQuestionPlayers = current?.participantIds
    ? connectedPlayers.filter((player) => current.participantIds!.includes(player.id))
    : connectedPlayers;
  const responseCount = activeQuestionPlayers.filter((player) => Boolean(current?.textResponses?.[player.id])).length;
  const readingTimer = freeResponseReadingTimer(current, room.settings, room.serverNow);
  // Final's roster is frozen at Final entry. A temporarily disconnected player
  // must remain in the wager/answer denominator until the round closes.
  const finalPlayers = room.finalRound ? room.players.filter((player) => room.finalRound!.participantIds.includes(player.id)) : connectedPlayers;
  const reviewPlayerId = room.phase === 'final-review' && room.finalRound
    ? room.finalRound.reviewPlayerId ?? room.finalRound.participantIds[room.finalRound.reviewPlayerIndex]
    : null;
  const reviewPlayer = reviewPlayerId ? room.players.find((player) => player.id === reviewPlayerId) ?? null : null;
  const showTurnIndicator = turnIndicatorVisible(room.phase);
  const turnLabel = turnIndicatorLabel(room.phase);
  const questionMultiplier = current ? Math.max(1, Math.round(current.effectiveValue / Math.max(1, current.baseValue))) : 1;
  const pointsAtStake = current?.dailyDouble
    ? (current.wager ?? 0) * (room.settings.dailyDoubleStacksWithMultiplier ? questionMultiplier : 1)
    : current?.effectiveValue ?? 0;

  return <main className="presentation-shell">
    {!audioReady && <button className="presentation-audio-gate" onClick={async () => { await audio.unlock(); setAudioReady(true); }}>Enable game audio</button>}
    <PlayerStrip players={room.players} activeId={active} turnId={showTurnIndicator ? room.turnPlayerId : null} turnLabel={turnLabel} showWagers={scoreboardWagersVisible(room.phase)} scoreOverrides={scoreOverrides}/>

    {room.phase === 'lobby' && <section className="presentation-center"><div className="brand-mark hero-brand"><span>BLUE STAGE</span><strong>TRIVIA</strong></div><div className="presentation-room"><small>ROOM CODE</small><strong>{room.code}</strong></div><p>Players join from their phones.</p></section>}

    {room.phase === 'board' && room.board && <section className="game-stage presentation-board"><div className="presentation-round-header"><span>{room.remainingQuestions} QUESTIONS LEFT · {gameMode.name.toUpperCase()}</span>{room.multiplier > 1 && <strong>{room.multiplier === 2 ? 'DOUBLE POINTS' : 'TRIPLE POINTS'}</strong>}</div><Board board={room.board} multiplier={room.multiplier}/></section>}

    {room.phase === 'paused' && <section className="presentation-center"><div className="section-kicker">PAUSED</div><h1>Game paused</h1></section>}

    {room.phase === 'daily-double-wager' && <section className="presentation-center daily-double-v2"><div className="section-kicker gold">DAILY DOUBLE</div><h1>{room.players.find((player) => player.id === current?.dailyDoublePlayerId)?.name}</h1><p>is choosing a wager.</p></section>}

    {(room.phase === 'question' || room.phase === 'daily-double-question') && current && <section className={`presentation-question ${current.dailyDouble ? 'daily-double-v2' : ''}`}><article>
      <div className="question-meta-v2"><span>{current.category}</span><strong>{current.dailyDouble ? `${pointsAtStake.toLocaleString()} POINTS IN PLAY` : `${current.effectiveValue} POINTS`}</strong>{current.responseMode === 'text' && <em>{gameMode.questionBadge}</em>}</div>
      <h1>{current.text}</h1>
      {readingTimer ? <div className="presentation-reading-countdown"><small>ANSWERS OPEN IN</small><Timer timer={readingTimer} serverNow={room.serverNow}/></div> : <Timer timer={room.timer} serverNow={room.serverNow}/>}
      {current.responseMode === 'text' && !current.answerRevealed && !readingTimer && <div className="presentation-response-count"><strong>{responseCount}/{activeQuestionPlayers.length}</strong><span>RESPONSES IN</span></div>}
      {current.buzzWinnerId && (() => { const player = room.players.find((candidate) => candidate.id === current.buzzWinnerId); if (!player) return null; const customization = normalizePlayerCustomization(player); return <div className="winner-chip presentation-winner" style={{ '--accent': player.accent } as React.CSSProperties}><PlayerAvatar avatarId={player.avatarId} fallback={player.avatar} frameStyle={customization.frameStyle} accent={player.accent} /><span>{player.name}</span></div>; })()}
      {current.answerRevealed && <div className="answer-reveal-v2 presentation-answer"><small>CORRECT ANSWER</small><strong>{current.acceptedAnswers?.join(' / ')}</strong></div>}
    </article></section>}

    {room.phase === 'final-category' && <section className="presentation-center final-stage"><div className="section-kicker gold">FINAL ROUND</div><h1>{room.finalRound?.category}</h1></section>}
    {room.phase === 'final-wager' && <section className="presentation-center final-stage"><div className="section-kicker gold">FINAL ROUND</div><h1>Place your wagers</h1><div className="presentation-lock-status">{finalPlayers.map((player)=>{ const customization = normalizePlayerCustomization(player); return <span className={player.finalWagerSubmitted?'done':''} key={player.id} style={{ '--accent': player.accent } as React.CSSProperties}><PlayerAvatar avatarId={player.avatarId} fallback={player.avatar} frameStyle={customization.frameStyle} accent={player.accent} /> {player.name}</span>; })}</div></section>}
    {room.phase === 'final-question' && <section className="presentation-question final-stage"><article><div className="question-meta-v2"><span>FINAL ROUND</span><strong>{room.finalRound?.category}</strong></div><h1>{room.finalRound?.question}</h1><Timer timer={room.timer} serverNow={room.serverNow}/><div className="presentation-response-count"><strong>{finalPlayers.filter((player)=>player.finalAnswerSubmitted).length}/{finalPlayers.length}</strong><span>RESPONSES IN</span></div></article></section>}
    {room.phase === 'final-review' && room.finalRound && reviewPlayer && <section className="presentation-question final-stage"><article><div className="section-kicker gold">FINAL ANSWER</div><div className="answer-reveal-v2 presentation-answer"><small>CORRECT ANSWER</small><strong>{room.finalRound.acceptedAnswers.join(' / ')}</strong></div><div className="presentation-final-player" style={{ '--accent': reviewPlayer.accent } as React.CSSProperties}><span><PlayerAvatar avatarId={reviewPlayer.avatarId} fallback={reviewPlayer.avatar} frameStyle={normalizePlayerCustomization(reviewPlayer).frameStyle} accent={reviewPlayer.accent} /></span><h1>{reviewPlayer.name}</h1><p>{reviewPlayer.finalAnswer || '(No answer)'}</p><strong>WAGER {reviewPlayer.finalWager ?? 0}</strong></div></article></section>}

    {room.phase === 'recap' && <section className="presentation-center presentation-recap"><div className="section-kicker gold">GAME COMPLETE</div>{winners.length === 1 ? (() => { const winner = winners[0]; const customization = normalizePlayerCustomization(winner); return <div className="presentation-winner-identity" data-victory-effect={customization.victoryEffect} style={{ '--accent': winner.accent } as React.CSSProperties}><PlayerAvatar avatarId={winner.avatarId} fallback={winner.avatar} frameStyle={customization.frameStyle} accent={winner.accent} /><h1>{winner.name}</h1></div>; })() : <h1>TIE GAME</h1>}<div className="presentation-scores-v2">{[...resultPlayers].sort((a,b)=>b.score-a.score).map((player)=>{ const customization = normalizePlayerCustomization(player); return <div key={player.id} style={{ '--accent': player.accent } as React.CSSProperties}><span><PlayerAvatar avatarId={player.avatarId} fallback={player.avatar} frameStyle={customization.frameStyle} accent={player.accent} /> {player.name}</span><strong>{player.score.toLocaleString()}</strong></div>; })}</div></section>}
    {scoreFlights[0] && <ScoreFlight flight={scoreFlights[0]} onImpact={handleScoreImpact} onComplete={handleScoreComplete} />}
  </main>;
}
