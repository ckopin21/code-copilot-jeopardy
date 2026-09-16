import type { Player } from '../shared/types';

export function PlayerStrip({ players, activeId }: { players: Player[]; activeId?: string | null }) {
  if (!players.length) return <div className="practice-chip">PRACTICE / PRESENTATION MODE</div>;
  return (
    <div className="player-strip" aria-label="Scores">
      {players.map((player) => (
        <section key={player.id} className={`player-card ${activeId === player.id ? 'is-active' : ''} ${player.onFire ? 'is-fire' : ''} ${player.isCold ? 'is-cold' : ''}`} style={{ '--accent': player.accent } as React.CSSProperties}>
          <div className="player-name"><span>{player.avatar}</span><strong>{player.name}</strong>{!player.connected && <small>offline</small>}</div>
          <div className="score">{player.score.toLocaleString()}</div>
          <div className="streak" aria-label="streak status">{player.onFire ? `🔥 ${player.positiveStreak}` : player.isCold ? `❄ ${player.coldStreak}` : player.positiveStreak > 0 ? `Streak ${player.positiveStreak}` : ' '}</div>
        </section>
      ))}
    </div>
  );
}
