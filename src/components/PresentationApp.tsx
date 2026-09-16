import { useEffect, useState } from 'react';
import type { RoomSnapshot } from '../shared/types';
import { emitAck, socket } from '../lib/socket';
import { Board } from './Board';
import { PlayerStrip } from './PlayerStrip';
import { Timer } from './Timer';
import { audio } from '../lib/audio';

export function PresentationApp() {
  const roomCode = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const onState = (snapshot: RoomSnapshot) => setRoom(snapshot);
    socket.on('room:state', onState);
    void emitAck<RoomSnapshot>('presentation:join', { roomCode }).then(setRoom).catch((error) => setError(error instanceof Error ? error.message : 'Could not join'));
    return () => { socket.off('room:state', onState); };
  }, [roomCode]);
  useEffect(() => {
    if (!room) return;
    const state = room.phase.startsWith('final') ? 'final' : room.phase === 'recap' ? 'winner' : room.multiplier === 3 ? 'triple' : room.multiplier === 2 ? 'double' : room.phase === 'lobby' ? 'lobby' : room.phase === 'question' ? 'thinking' : 'board';
    const unlock = () => { void audio.setMusic(state); window.removeEventListener('pointerdown', unlock); };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, [room]);
  if (!room) return <main className="center-screen"><h1>{error || 'Connecting to game…'}</h1></main>;
  const current = room.currentQuestion;
  const active = current?.buzzWinnerId ?? current?.dailyDoublePlayerId;
  const winners = room.phase === 'recap' && room.players.length ? room.players.filter((player) => player.score === Math.max(...room.players.map((item) => item.score))) : [];
  return <main className="presentation-shell"><PlayerStrip players={room.players} activeId={active}/>
    {room.phase === 'lobby' && <section className="center-screen"><div className="logo-lockup"><span>BLUE STAGE</span><strong>TRIVIA</strong></div><h2>Room {room.code}</h2><p>Players join from their phones.</p></section>}
    {room.phase === 'board' && room.board && <section className="game-stage presentation">{room.multiplier > 1 && <div className={`modifier-banner x${room.multiplier}`}>{room.multiplier === 2 ? 'DOUBLE POINTS' : 'TRIPLE POINTS'}</div>}<Board board={room.board}/></section>}
    {room.phase === 'paused' && <section className="center-screen"><h1>PAUSED</h1></section>}
    {room.phase === 'daily-double-wager' && <section className="center-screen daily-double-scene"><div className="burst-label">DAILY DOUBLE</div><h1>{room.players.find((player) => player.id === current?.dailyDoublePlayerId)?.name} is wagering</h1></section>}
    {(room.phase === 'question' || room.phase === 'daily-double-question') && current && <section className={`center-screen question-scene ${current.dailyDouble ? 'daily-double-scene' : ''}`}><div className="question-meta"><span>{current.category}</span><strong>{current.dailyDouble ? `WAGER ${current.wager}` : `${current.effectiveValue} POINTS`}</strong></div><h1>{current.text}</h1><Timer timer={room.timer}/>{current.buzzWinnerId && <div className="buzz-winner">{room.players.find((player) => player.id === current.buzzWinnerId)?.avatar} {room.players.find((player) => player.id === current.buzzWinnerId)?.name}</div>}{current.answerRevealed && <div className="revealed-answer">{current.acceptedAnswers?.[0]}</div>}</section>}
    {room.phase === 'final-category' && <section className="center-screen final-scene"><div className="eyebrow">FINAL ROUND</div><h1>{room.finalRound?.category}</h1></section>}
    {room.phase === 'final-wager' && <section className="center-screen final-scene"><div className="eyebrow">FINAL ROUND</div><h1>Place your wagers</h1></section>}
    {room.phase === 'final-question' && <section className="center-screen final-scene"><div className="eyebrow">FINAL QUESTION · {room.finalRound?.category}</div><h1>{room.finalRound?.question}</h1><Timer timer={room.timer}/></section>}
    {room.phase === 'final-review' && room.finalRound && <section className="center-screen final-scene"><div className="eyebrow">FINAL ANSWER</div><h1>{room.players[room.finalRound.reviewPlayerIndex]?.name}</h1><div className="final-response"><small>WAGER</small><strong>{room.players[room.finalRound.reviewPlayerIndex]?.finalWager}</strong><small>ANSWER</small><strong>{room.players[room.finalRound.reviewPlayerIndex]?.finalAnswer || '(No answer)'}</strong></div></section>}
    {room.phase === 'recap' && <section className="center-screen recap-scene"><div className="eyebrow">WINNER</div><h1>{winners.length === 1 ? `${winners[0].avatar} ${winners[0].name}` : 'TIE GAME'}</h1><div className="presentation-scores">{[...room.players].sort((a,b)=>b.score-a.score).map((player)=><div key={player.id}><span>{player.avatar} {player.name}</span><strong>{player.score.toLocaleString()}</strong></div>)}</div></section>}
  </main>;
}
