import type { Player } from '../shared/types';
import { PlayerAvatar } from './PlayerAvatar';
import { normalizePlayerCustomization } from '../shared/playerCustomization';

export function PlayerStrip({ players, activeId, turnId, turnLabel = '', showWagers = false, scoreOverrides = {} }: { players: Player[]; activeId?: string | null; turnId?: string | null; turnLabel?: string; showWagers?: boolean; scoreOverrides?: Record<string, number> }) {
  const visiblePlayers = players.filter((player) => player.connected);
  if (!visiblePlayers.length) return <div className="practice-chip">PRACTICE / PRESENTATION MODE</div>;
  return (
    <div className="player-strip showcase-player-strip" data-player-count={visiblePlayers.length} aria-label="Scores">
      {visiblePlayers.map((player) => {
        const displayedScore = scoreOverrides[player.id] ?? player.score;
        const customization = normalizePlayerCustomization(player);
        const isTurn = turnId === player.id;
        const hasStreakStatus = player.onFire || player.isCold;
        const streakBadge = player.onFire
          ? <div className="streak-ribbon fire"><span>🔥</span><b>ON FIRE</b><em>{player.positiveStreak} straight</em></div>
          : player.isCold
            ? <div className="streak-ribbon cold"><span>❄</span><b>COLD STREAK</b><em>{player.coldStreak} misses</em></div>
            : null;
        const turnBadge = isTurn
          ? <span className={`turn-beacon ${turnLabel ? '' : 'star-only'}`}><i>★</i>{turnLabel && <b>{turnLabel}</b>}</span>
          : null;
        return (
          <section data-player-id={player.id} key={player.id} data-score-effect={customization.scoreEffect} data-frame={customization.frameStyle} className={`player-card showcase-player-card ${activeId === player.id ? 'is-active' : ''} ${isTurn ? 'is-turn' : ''} ${player.onFire ? 'is-fire' : ''} ${player.isCold ? 'is-cold' : ''}`} style={{ '--accent': player.accent } as React.CSSProperties}>
            {hasStreakStatus && <div className="player-status-stack">{streakBadge}{turnBadge}</div>}
            <div className="player-avatar-large"><PlayerAvatar avatarId={player.avatarId} fallback={player.avatar} frameStyle={customization.frameStyle} accent={player.accent} /></div>
            <div className="player-card-main"><div className="player-name"><strong title={player.name}>{player.name}</strong></div><div className="score" data-player-score={player.id}>{displayedScore.toLocaleString()}</div>{showWagers && player.finalWagerSubmitted && player.finalWager !== null && <div className="player-wager-pill">WAGER {player.finalWager.toLocaleString()}</div>}</div>
            {isTurn && !hasStreakStatus
              ? turnBadge
              : !isTurn && !hasStreakStatus && !player.finalWagerSubmitted && <div className="streak neutral">{player.positiveStreak > 0 ? `STREAK ${player.positiveStreak}` : 'READY'}</div>}
          </section>
        );
      })}
    </div>
  );
}
