import type { RoomSnapshot } from '../shared/types';
import { Board } from './Board';

export function BoardPresentation({ room, onBack }: { room: RoomSnapshot; onBack: () => void }) {
  if (!room.board) return null;
  const players = room.players.filter((player) => player.connected);
  return <section className="board-presentation-mode" role="dialog" aria-modal="true" aria-label="Board presentation">
    <header className="board-presentation-header">
      <button className="presentation-back" onClick={onBack}>← Back</button>
      <div className="presentation-name-strip" aria-label="Player scores">
        {players.length ? players.map((player) => <div className="presentation-name-card" key={player.id} style={{ '--accent': player.accent } as React.CSSProperties}>
          <span>{player.avatar}</span><strong>{player.name}</strong><b>{player.score.toLocaleString()}</b>
        </div>) : <div className="presentation-name-card practice"><strong>PRACTICE MODE</strong></div>}
      </div>
    </header>
    {room.multiplier > 1 && <div className={`presentation-modifier x${room.multiplier}`}>{room.multiplier === 2 ? '2× DOUBLE POINTS' : '3× TRIPLE POINTS'}</div>}
    <div className="presentation-board-fill"><Board board={room.board} multiplier={room.multiplier} disabled /></div>
  </section>;
}
