import type { RoomSnapshot } from '../shared/types';
import { Board, type BoardResultMap } from './Board';
import { PlayerAvatar } from './PlayerAvatar';
import { normalizePlayerCustomization } from '../shared/playerCustomization';

export function BoardPresentation({ room, onBack, onSelect, onReview, results = {}, scoreOverrides = {} }: { room: RoomSnapshot; onBack: () => void; onSelect: (id: string) => void; onReview?: (id: string) => void; results?: BoardResultMap; scoreOverrides?: Record<string, number> }) {
  if (!room.board) return null;
  const players = room.players.filter((player) => player.connected);
  return <section className="board-presentation-mode" role="dialog" aria-modal="true" aria-label="Board presentation">
    <header className="board-presentation-header">
      <button className="presentation-back" onClick={onBack}>← Back</button>
      <div className="presentation-name-strip" data-player-count={players.length} aria-label="Player scores">
        {players.length ? players.map((player) => {
          const status = player.onFire
            ? `🔥 ON FIRE · ${player.positiveStreak}`
            : player.isCold
              ? `❄ COLD STREAK · ${player.coldStreak}`
              : player.positiveStreak > 0
                ? `STREAK ${player.positiveStreak}`
                : 'READY';
          const displayedScore = scoreOverrides[player.id] ?? player.score;
          const customization = normalizePlayerCustomization(player);
          return <div data-player-id={player.id} data-score-effect={customization.scoreEffect} className={`presentation-name-card ${room.turnPlayerId === player.id ? 'is-turn' : ''} ${player.onFire ? 'is-fire' : ''} ${player.isCold ? 'is-cold' : ''}`} key={player.id} style={{ '--accent': player.accent } as React.CSSProperties}>
            <span className="presentation-player-avatar"><PlayerAvatar avatarId={player.avatarId} fallback={player.avatar} frameStyle={customization.frameStyle} accent={player.accent} /></span>
            <div className="presentation-player-main"><strong>{player.name}</strong><small>{status}</small></div>
            <b data-player-score={player.id}>{displayedScore.toLocaleString()}</b>
          </div>;
        }) : <div className="presentation-name-card practice"><strong>PRACTICE MODE</strong></div>}
      </div>
    </header>
    {room.multiplier > 1 && <div className={`presentation-modifier x${room.multiplier}`}>{room.multiplier === 2 ? '2× DOUBLE POINTS' : '3× TRIPLE POINTS'}</div>}
    <div className="presentation-board-fill"><Board board={room.board} multiplier={room.multiplier} onSelect={onSelect} onReview={onReview} results={results} /></div>
  </section>;
}
