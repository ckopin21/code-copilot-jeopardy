import { useEffect, useMemo, useState } from 'react';
import type { RoomSnapshot } from '../shared/types';
import { emitAck, socket } from '../lib/socket';
import { Board } from './Board';
import { PlayerStrip } from './PlayerStrip';
import { Timer } from './Timer';
import { audio } from '../lib/audio';

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

  useEffect(() => {
    const onState = (snapshot: RoomSnapshot) => setRoom(snapshot);
    socket.on('room:state', onState);
    void emitAck<RoomSnapshot>('presentation:join', { roomCode }).then(setRoom).catch((err) => setError(err instanceof Error ? err.message : 'Could not join game'));
    return () => { socket.off('room:state', onState); audio.stop(); };
  }, [roomCode]);

  const musicState = room ? musicFor(room) : null;
  useEffect(() => {
    if (!audioReady || !musicState) return;
    void audio.setMusic(musicState);
  }, [audioReady, musicState]);

  const resultPlayers = useMemo(() => {
    if (!room) return [];
    const ids = room.resultPlayerIds?.length ? new Set(room.resultPlayerIds) : null;
    return ids ? room.players.filter((player) => ids.has(player.id)) : room.players;
  }, [room]);
  const winners = useMemo(() => {
    if (!room || room.phase !== 'recap' || !resultPlayers.length) return [];
    const max = Math.max(...resultPlayers.map((player) => player.score));
    return resultPlayers.filter((player) => player.score === max);
  }, [room, resultPlayers]);

  if (!room) return <main className="presentation-shell presentation-boot"><div className="brand-mark"><span>BLUE STAGE</span><strong>TRIVIA</strong></div><p>{error || 'Connecting to game…'}</p></main>;

  const current = room.currentQuestion;
  const active = current?.buzzWinnerId ?? current?.dailyDoublePlayerId;
  const responseCount = Object.keys(current?.textResponses ?? {}).length;
  const connectedPlayers = room.players.filter((player) => player.connected);
  const finalPlayers = room.finalRound ? connectedPlayers.filter((player) => room.finalRound!.participantIds.includes(player.id)) : connectedPlayers;
  const reviewPlayerId = room.phase === 'final-review' && room.finalRound
    ? room.finalRound.reviewPlayerId ?? room.finalRound.participantIds[room.finalRound.reviewPlayerIndex]
    : null;
  const reviewPlayer = reviewPlayerId ? room.players.find((player) => player.id === reviewPlayerId) ?? null : null;

  return <main className="presentation-shell">
    {!audioReady && <button className="presentation-audio-gate" onClick={async () => { await audio.unlock(); setAudioReady(true); }}>Enable game audio</button>}
    <PlayerStrip players={room.players} activeId={active}/>

    {room.phase === 'lobby' && <section className="presentation-center"><div className="brand-mark hero-brand"><span>BLUE STAGE</span><strong>TRIVIA</strong></div><div className="presentation-room"><small>ROOM CODE</small><strong>{room.code}</strong></div><p>Players join from their phones.</p></section>}

    {room.phase === 'board' && room.board && <section className="game-stage presentation-board"><div className="presentation-round-header"><span>{room.remainingQuestions} QUESTIONS LEFT</span>{room.multiplier > 1 && <strong>{room.multiplier === 2 ? 'DOUBLE POINTS' : 'TRIPLE POINTS'}</strong>}</div><Board board={room.board} multiplier={room.multiplier}/></section>}

    {room.phase === 'paused' && <section className="presentation-center"><div className="section-kicker">PAUSED</div><h1>Game paused</h1></section>}

    {room.phase === 'daily-double-wager' && <section className="presentation-center daily-double-v2"><div className="section-kicker gold">DAILY DOUBLE</div><h1>{room.players.find((player) => player.id === current?.dailyDoublePlayerId)?.name}</h1><p>is choosing a wager.</p></section>}

    {(room.phase === 'question' || room.phase === 'daily-double-question') && current && <section className={`presentation-question ${current.dailyDouble ? 'daily-double-v2' : ''}`}><article>
      <div className="question-meta-v2"><span>{current.category}</span><strong>{current.dailyDouble ? `WAGER ${current.wager}` : `${current.effectiveValue} POINTS`}</strong>{current.responseMode === 'text' && <em>FREE RESPONSE</em>}</div>
      <h1>{current.text}</h1>
      <Timer timer={room.timer} serverNow={room.serverNow}/>
      {current.responseMode === 'text' && !current.answerRevealed && <div className="presentation-response-count"><strong>{responseCount}/{connectedPlayers.length}</strong><span>RESPONSES IN</span></div>}
      {current.buzzWinnerId && <div className="winner-chip presentation-winner">{room.players.find((player) => player.id === current.buzzWinnerId)?.avatar}<span>{room.players.find((player) => player.id === current.buzzWinnerId)?.name}</span></div>}
      {current.answerRevealed && <div className="answer-reveal-v2 presentation-answer"><small>CORRECT ANSWER</small><strong>{current.acceptedAnswers?.join(' / ')}</strong></div>}
    </article></section>}

    {room.phase === 'final-category' && <section className="presentation-center final-stage"><div className="section-kicker gold">FINAL ROUND</div><h1>{room.finalRound?.category}</h1></section>}
    {room.phase === 'final-wager' && <section className="presentation-center final-stage"><div className="section-kicker gold">FINAL ROUND</div><h1>Place your wagers</h1><div className="presentation-lock-status">{finalPlayers.map((player)=><span className={player.finalWagerSubmitted?'done':''} key={player.id}>{player.avatar} {player.name}</span>)}</div></section>}
    {room.phase === 'final-question' && <section className="presentation-question final-stage"><article><div className="question-meta-v2"><span>FINAL ROUND</span><strong>{room.finalRound?.category}</strong></div><h1>{room.finalRound?.question}</h1><Timer timer={room.timer} serverNow={room.serverNow}/><div className="presentation-response-count"><strong>{finalPlayers.filter((player)=>player.finalAnswerSubmitted).length}/{finalPlayers.length}</strong><span>RESPONSES IN</span></div></article></section>}
    {room.phase === 'final-review' && room.finalRound && reviewPlayer && <section className="presentation-question final-stage"><article><div className="section-kicker gold">FINAL ANSWER</div><div className="answer-reveal-v2 presentation-answer"><small>CORRECT ANSWER</small><strong>{room.finalRound.acceptedAnswers.join(' / ')}</strong></div><div className="presentation-final-player"><span>{reviewPlayer.avatar}</span><h1>{reviewPlayer.name}</h1><p>{reviewPlayer.finalAnswer || '(No answer)'}</p><strong>WAGER {reviewPlayer.finalWager ?? 0}</strong></div></article></section>}

    {room.phase === 'recap' && <section className="presentation-center presentation-recap"><div className="section-kicker gold">GAME COMPLETE</div><h1>{winners.length === 1 ? `${winners[0].avatar} ${winners[0].name}` : 'TIE GAME'}</h1><div className="presentation-scores-v2">{[...resultPlayers].sort((a,b)=>b.score-a.score).map((player)=><div key={player.id}><span>{player.avatar} {player.name}</span><strong>{player.score.toLocaleString()}</strong></div>)}</div></section>}
  </main>;
}
