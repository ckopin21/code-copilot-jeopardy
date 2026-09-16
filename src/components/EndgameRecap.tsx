import { useEffect, useState } from 'react';
import type { Player } from '../shared/types';

export function EndgameRecap({ players, onReset, onMenu }: { players: Player[]; onReset: () => void; onMenu: () => void }) {
  const resultKey = players.map((player) => `${player.id}:${player.score}`).join('|');
  const playerCount = players.length;
  const standings = [...players].sort((a, b) => b.score - a.score);
  const [revealed, setRevealed] = useState(0);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    setRevealed(0);
    setShowStats(false);
    const timers: number[] = [];
    for (let index = 0; index < playerCount; index += 1) {
      timers.push(window.setTimeout(() => setRevealed(index + 1), 420 + index * 620));
    }
    timers.push(window.setTimeout(() => setShowStats(true), 420 + playerCount * 620 + 1700));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [resultKey, playerCount]);

  if (showStats) return <section className={`recap-scene-v2 stats-after-podium recap-count-${playerCount}`}>
    <div className="section-kicker gold">GAME STATS</div>
    <h1>Final results</h1>
    <div className="recap-grid-v2">{standings.map((player, index) => <article className="recap-card-v2" key={player.id}>
      <div className="recap-player-heading"><div className="stats-place">#{index + 1}</div><span>{player.avatar}</span><h2>{player.name}</h2><strong>{player.score.toLocaleString()}</strong></div>
      <dl className="recap-stats-list"><dt>Correct</dt><dd>{player.stats.correct}</dd><dt>Incorrect</dt><dd>{player.stats.incorrect}</dd><dt>Accuracy</dt><dd>{Math.round(player.stats.correct / Math.max(1, player.stats.correct + player.stats.incorrect) * 100)}%</dd><dt>Longest streak</dt><dd>{player.stats.longestStreak}</dd><dt>Fastest buzz</dt><dd>{player.stats.fastestBuzzMs == null ? '—' : `${player.stats.fastestBuzzMs}ms`}</dd><dt>Points gained</dt><dd>{player.stats.pointsGained.toLocaleString()}</dd><dt>Points lost</dt><dd>{player.stats.pointsLost.toLocaleString()}</dd></dl>
    </article>)}</div>
    <div className="control-row-v2"><button className="primary-button" onClick={onReset}>Reset Game</button><button className="secondary-button" onClick={onMenu}>Back to Menu</button></div>
  </section>;

  const placeOf = new Map(standings.map((player, index) => [player.id, index + 1]));
  const byPlace = (place: number) => standings[place - 1];
  const visualOrder = standings.length >= 3
    ? [byPlace(2), byPlace(1), byPlace(3), ...standings.slice(3)]
    : standings.length === 2 ? [byPlace(2), byPlace(1)] : standings;

  return <section className="podium-scene" aria-live="polite">
    <div className="podium-glow" aria-hidden="true" />
    <div className="section-kicker gold">FINAL STANDINGS</div>
    <h1>And the winner is…</h1>
    <div className="podium-ranking">{visualOrder.filter(Boolean).map((player) => {
      const place = placeOf.get(player.id) ?? standings.length;
      const revealStep = standings.length - place + 1;
      const isWinner = place === 1;
      return <article className={`podium-card ${isWinner ? 'winner' : ''} ${revealed >= revealStep ? 'reveal' : ''}`} key={player.id}>
        <div className="podium-crown">{isWinner ? '👑' : ''}</div>
        <div className="podium-place">#{place}</div>
        <div className="podium-avatar">{player.avatar}</div>
        <div className="podium-name">{player.name}</div>
        <div className="podium-score">{player.score.toLocaleString()}</div>
        <div className={`podium-pedestal place-${Math.min(place, 4)}`}>{isWinner ? 'WINNER' : `${place}${place === 2 ? 'ND' : place === 3 ? 'RD' : 'TH'}`}</div>
      </article>;
    })}</div>
    {revealed >= standings.length && <div className="podium-confetti" aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <i key={index} style={{ '--i': index } as React.CSSProperties} />)}</div>}
  </section>;
}
