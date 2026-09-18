import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RoomSnapshot } from '../shared/types';
import { emitAck, resumeClientSession, socket, suspendClientSession } from '../lib/socket';
import { Board } from './Board';
import { PlayerStrip } from './PlayerStrip';
import { Timer } from './Timer';
import { audio } from '../lib/audio';
import { scoreboardWagersVisible, turnIndicatorLabel, turnIndicatorVisible } from '../lib/gameUiRules';
import { ScoreFlight, type ScoreFlightState } from './ScoreFlight';
import { randomId } from '../lib/ids';
import { gameModeDefinition } from '../shared/gameModes';

function musicFor(room: RoomSnapshot) {
  if (room.phase.startsWith('final')) return 'final' as const;
  if (room.phase === 'recap') return 'winner' as const;
  if (room.currentQuestion?.dailyDouble) return 'daily-double' as const;
  if (room.phase === 'question') return 'thinking' as const;
  if (room.multiplier === 3) return 'triple' as const;
  if (room.multiplier === 2) return 'double' as const;
  return room.phase === 'lobby' ? 'lobby' as const : 'board' as const;
}

export function PresentationApp() {
  const roomCode = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState('');
  const [audioReady, setAudioReady] = useState(false);
  const [scoreFlights, setScoreFlights] = useState<ScoreFlightState[]>([]);
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, number>>({});
  const latestRoomRef = useRef<RoomSnapshot | null>(null);

  const applySnapshot = useCallback((snapshot: RoomSnapshot) => {
    const previous = latestRoomRef.current;
    if (previous && previous.code === snapshot.code && snapshot.phase !== 'lobby') {
      const nextFlights: ScoreFlightState[] = [];
      const nextOverrides: Record<string, number> = {};
      for (const player of snapshot.players) {
        const before = previous.players.find((candidate) => candidate.id === player.id);
        if (!before || before.score === player.score) continue;
        nextOverrides[player.id] = before.score;
        nextFlights.push({
          id: randomId('presentation-score'),
          questionId: snapshot.currentQuestion?.questionId ?? previous.currentQuestion?.questionId ?? 'presentation-score-change',
          playerId: player.id,
          delta: player.score - before.score,
          correct: player.score > before.score,
          comebackBonus: player.score > before.score && !snapshot.currentQuestion?.dailyDouble
            ? Math.max(0, player.score - before.score - (snapshot.currentQuestion?.effectiveValue ?? previous.currentQuestion?.effectiveValue ?? 0))
            : 0
        });
      }
      if (nextFlights.length) {
        setScoreOverrides((current) => ({ ...current, ...nextOverrides }));
        setScoreFlights((current) => [...current, ...nextFlights]);
      }
    }
    latestRoomRef.current = snapshot;
    setRoom(snapshot);
  }, []);

  const handleScoreImpact = useCallback((flight: ScoreFlightState) => {
    setScoreOverrides((current) => {
      const next = { ...current };
      delete next[flight.playerId];
      return next;
    });
  }, []);
  const handleScoreComplete = useCallback((flightId: string) => setScoreFlights((current) => current.filter((flight) => flight.id !== flightId)), []);

  useEffect(() => {
    resumeClientSession();
    const onState = (snapshot: RoomSnapshot) => applySnapshot(snapshot);
    socket.on('room:state', onState);
    void emitAck<RoomSnapshot>('presentation:join', { roomCode }).then(applySnapshot).catch((err) => setError(err instanceof Error ? err.message : 'Could not join game'));
    return () => {
      socket.off('room:state', onState);
      suspendClientSession();
      audio.stop();
    };
  }, [roomCode, applySnapshot]);

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

  if (!room) return <main className="presentation-shell presentation-boot"><div className="brand-mark"><span>BLUE STAGE</span><strong>TRIVIA</strong></div><p>{error || 'Connecting to game…'}</p></main>;

  const current = room.currentQuestion;
  const gameMode = gameModeDefinition(room.settings.gameMode);
  const active = current?.buzzWinnerId ?? current?.dailyDoublePlayerId;
  const connectedPlayers = room.players.filter((player) => player.connected);
  const activeQuestionPlayers = current?.participantIds
    ? connectedPlayers.filter((player) => current.participantIds!.includes(player.id))
    : connectedPlayers;
  const responseCount = activeQuestionPlayers.filter((player) => Boolean(current?.textResponses?.[player.id])).length;
  const finalPlayers = room.finalRound ? connectedPlayers.filter((player) => room.finalRound!.participantIds.includes(player.id)) : connectedPlayers;
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
      <Timer timer={room.timer} serverNow={room.serverNow}/>
      {current.responseMode === 'text' && !current.answerRevealed && <div className="presentation-response-count"><strong>{responseCount}/{activeQuestionPlayers.length}</strong><span>RESPONSES IN</span></div>}
      {current.buzzWinnerId && <div className="winner-chip presentation-winner">{room.players.find((player) => player.id === current.buzzWinnerId)?.avatar}<span>{room.players.find((player) => player.id === current.buzzWinnerId)?.name}</span></div>}
      {current.answerRevealed && <div className="answer-reveal-v2 presentation-answer"><small>CORRECT ANSWER</small><strong>{current.acceptedAnswers?.join(' / ')}</strong></div>}
    </article></section>}

    {room.phase === 'final-category' && <section className="presentation-center final-stage"><div className="section-kicker gold">FINAL ROUND</div><h1>{room.finalRound?.category}</h1></section>}
    {room.phase === 'final-wager' && <section className="presentation-center final-stage"><div className="section-kicker gold">FINAL ROUND</div><h1>Place your wagers</h1><div className="presentation-lock-status">{finalPlayers.map((player)=><span className={player.finalWagerSubmitted?'done':''} key={player.id}>{player.avatar} {player.name}</span>)}</div></section>}
    {room.phase === 'final-question' && <section className="presentation-question final-stage"><article><div className="question-meta-v2"><span>FINAL ROUND</span><strong>{room.finalRound?.category}</strong></div><h1>{room.finalRound?.question}</h1><Timer timer={room.timer} serverNow={room.serverNow}/><div className="presentation-response-count"><strong>{finalPlayers.filter((player)=>player.finalAnswerSubmitted).length}/{finalPlayers.length}</strong><span>RESPONSES IN</span></div></article></section>}
    {room.phase === 'final-review' && room.finalRound && reviewPlayer && <section className="presentation-question final-stage"><article><div className="section-kicker gold">FINAL ANSWER</div><div className="answer-reveal-v2 presentation-answer"><small>CORRECT ANSWER</small><strong>{room.finalRound.acceptedAnswers.join(' / ')}</strong></div><div className="presentation-final-player"><span>{reviewPlayer.avatar}</span><h1>{reviewPlayer.name}</h1><p>{reviewPlayer.finalAnswer || '(No answer)'}</p><strong>WAGER {reviewPlayer.finalWager ?? 0}</strong></div></article></section>}

    {room.phase === 'recap' && <section className="presentation-center presentation-recap"><div className="section-kicker gold">GAME COMPLETE</div><h1>{winners.length === 1 ? `${winners[0].avatar} ${winners[0].name}` : 'TIE GAME'}</h1><div className="presentation-scores-v2">{[...resultPlayers].sort((a,b)=>b.score-a.score).map((player)=><div key={player.id}><span>{player.avatar} {player.name}</span><strong>{player.score.toLocaleString()}</strong></div>)}</div></section>}
    {scoreFlights[0] && <ScoreFlight flight={scoreFlights[0]} onImpact={handleScoreImpact} onComplete={handleScoreComplete} />}
  </main>;
}
