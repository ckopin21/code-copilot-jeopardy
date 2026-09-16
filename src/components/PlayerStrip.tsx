import type { Player } from '../shared/types';

export function PlayerStrip({ players, activeId }: { players: Player[]; activeId?: string | null }) {
  const visiblePlayers = players.filter((player) => player.connected);
  if (!visiblePlayers.length) return <div className="practice-chip">PRACTICE / PRESENTATION MODE</div>;
  return (
    <div className="player-strip showcase-player-strip" aria-label="Scores">
      {visiblePlayers.map((player) => (
        <section key={player.id} className={`player-card showcase-player-card ${activeId === player.id ? 'is-active' : ''} ${player.onFire ? 'is-fire' : ''} ${player.isCold ? 'is-cold' : ''}`} style={{ '--accent': player.accent } as React.CSSProperties}>
          {player.onFire && <div className="streak-ribbon fire"><span>🔥</span><b>ON FIRE</b><em>{player.positiveStreak} straight</em></div>}
          {player.isCold && <div className="streak-ribbon cold"><span>❄</span><b>COLD STREAK</b><em>{player.coldStreak} misses</em></div>}
          <div className="player-avatar-large">{player.avatar}</div>
          <div className="player-card-main"><div className="player-name"><strong>{player.name}</strong></div><div className="score">{player.score.toLocaleString()}</div>{player.finalWagerSubmitted && player.finalWager !== null && <div className="player-wager-pill">WAGER {player.finalWager.toLocaleString()}</div>}</div>
          {!player.onFire && !player.isCold && !player.finalWagerSubmitted && <div className="streak neutral">{player.positiveStreak > 0 ? `STREAK ${player.positiveStreak}` : 'READY'}</div>}
        </section>
      ))}
    </div>
  );
}
