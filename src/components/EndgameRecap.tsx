import { useEffect, useMemo, useState } from 'react';
import type { Player } from '../shared/types';
import { PlayerAvatar } from './PlayerAvatar';
import { normalizePlayerCustomization } from '../shared/playerCustomization';

type Award = { title: string; playerId: string; detail: string };

function competitionPlace(players: Player[], player: Player): number {
  return 1 + players.filter((candidate) => candidate.score > player.score).length;
}

function buildAwards(players: Player[]): Award[] {
  if (!players.length) return [];
  const awards: Award[] = [];
  const withAttempts = players.filter((player) => player.stats.correct + player.stats.incorrect > 0);
  const withBuzz = players.filter((player) => player.stats.fastestBuzzMs !== null);

  const addMax = (title: string, value: (player: Player) => number, detail: (player: Player) => string, eligible = players) => {
    if (!eligible.length) return;
    const best = [...eligible].sort((a, b) => value(b) - value(a))[0];
    if (value(best) <= 0) return;
    awards.push({ title, playerId: best.id, detail: detail(best) });
  };

  if (withBuzz.length) {
    const fastest = [...withBuzz].sort((a, b) => (a.stats.fastestBuzzMs ?? Infinity) - (b.stats.fastestBuzzMs ?? Infinity))[0];
    awards.push({ title: 'FASTEST BUZZER', playerId: fastest.id, detail: `${fastest.stats.fastestBuzzMs}ms` });
  }
  if (withAttempts.length) {
    const accurate = [...withAttempts].sort((a, b) => {
      const aa = a.stats.correct / Math.max(1, a.stats.correct + a.stats.incorrect);
      const ba = b.stats.correct / Math.max(1, b.stats.correct + b.stats.incorrect);
      return ba - aa || b.stats.correct - a.stats.correct;
    })[0];
    const pct = Math.round(accurate.stats.correct / Math.max(1, accurate.stats.correct + accurate.stats.incorrect) * 100);
    awards.push({ title: 'SHARPSHOOTER', playerId: accurate.id, detail: `${pct}% accuracy` });
  }
  addMax('HOT STREAK', (player) => player.stats.longestStreak, (player) => `${player.stats.longestStreak} correct in a row`);
  addMax('HIGH ROLLER', (player) => player.stats.biggestWager, (player) => `${player.stats.biggestWager.toLocaleString()} wager`);
  addMax('POINT MACHINE', (player) => player.stats.pointsGained, (player) => `${player.stats.pointsGained.toLocaleString()} gained`);
  return awards.slice(0, 5);
}

export function EndgameRecap({ players, onNewGame, onMenu }: { players: Player[]; onNewGame: () => void; onMenu: () => void }) {
  const resultKey = players.map((player) => `${player.id}:${player.score}:${player.stats.correct}:${player.stats.incorrect}:${player.stats.longestStreak}:${player.stats.fastestBuzzMs ?? 'n'}:${player.stats.biggestWager}:${player.stats.pointsGained}`).join('|');
  const playerCount = players.length;
  const standings = useMemo(() => [...players].sort((a, b) => b.score - a.score || a.seat - b.seat), [players]);
  const awards = useMemo(() => buildAwards(players), [players]);
  const [showPodium, setShowPodium] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    setShowPodium(false);
    setRevealed(0);
    setShowStats(false);
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setShowPodium(true), 2800));
    for (let index = 0; index < playerCount; index += 1) {
      timers.push(window.setTimeout(() => setRevealed(index + 1), 3300 + index * 850));
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [resultKey, playerCount]);

  if (playerCount === 0) return <section className="recap-scene-v2 stats-after-podium recap-count-0">
    <div className="section-kicker gold">PRACTICE COMPLETE</div>
    <h1>Board complete</h1>
    <p className="helper-copy">Practice mode has no player standings. Start another game on the same room or return to the menu.</p>
    <div className="control-row-v2"><button className="primary-button" onClick={onNewGame}>Start New Game</button><button className="secondary-button" onClick={onMenu}>Back to Menu</button></div>
  </section>;

  if (!showPodium) return <section className="podium-scene endgame-hold" aria-live="polite">
    <div className="podium-glow" aria-hidden="true" />
    <div className="section-kicker gold">FINAL SCORES LOCKED</div>
    <h1>Results are in.</h1>
    <p className="helper-copy">Get ready for the final standings.</p>
    <div className="endgame-hold-pulse" aria-hidden="true"><i/><i/><i/></div>
  </section>;

  if (showStats) return <section className={`recap-scene-v2 stats-after-podium recap-count-${playerCount}`}>
    <div className="section-kicker gold">GAME STATS</div>
    <h1>Final results</h1>
    {awards.length > 0 && <div className="recap-grid-v2 postgame-awards" aria-label="Game awards">{awards.map((award) => {
      const player = players.find((candidate) => candidate.id === award.playerId)!;
      const customization = normalizePlayerCustomization(player);
      return <article className="recap-card-v2" key={`${award.title}-${award.playerId}`} style={{ '--accent': player.accent } as React.CSSProperties}><div className="section-kicker gold">{award.title}</div><div className="recap-player-heading"><PlayerAvatar avatarId={player.avatarId} fallback={player.avatar} frameStyle={customization.frameStyle} accent={player.accent} /><h2>{player.name}</h2></div><strong>{award.detail}</strong></article>;
    })}</div>}
    <div className="recap-grid-v2 standings-grid">{standings.map((player) => {
      const place = competitionPlace(standings, player);
      const playerAwards = awards.filter((award) => award.playerId === player.id);
      const customization = normalizePlayerCustomization(player);
      return <article className="recap-card-v2" key={player.id} style={{ '--accent': player.accent } as React.CSSProperties}>
        <div className="recap-player-heading"><div className="stats-place">#{place}</div><PlayerAvatar avatarId={player.avatarId} fallback={player.avatar} frameStyle={customization.frameStyle} accent={player.accent} /><h2>{player.name}</h2><strong>{player.score.toLocaleString()}</strong></div>
        {playerAwards.length > 0 && <div className="player-award-pills">{playerAwards.map((award) => <span className="player-wager-pill" key={award.title}>{award.title}</span>)}</div>}
        <dl className="recap-stats-list"><dt>Correct</dt><dd>{player.stats.correct}</dd><dt>Incorrect</dt><dd>{player.stats.incorrect}</dd><dt>Accuracy</dt><dd>{Math.round(player.stats.correct / Math.max(1, player.stats.correct + player.stats.incorrect) * 100)}%</dd><dt>Longest streak</dt><dd>{player.stats.longestStreak}</dd><dt>Fastest buzz</dt><dd>{player.stats.fastestBuzzMs == null ? '—' : `${player.stats.fastestBuzzMs}ms`}</dd><dt>Points gained</dt><dd>{player.stats.pointsGained.toLocaleString()}</dd><dt>Points lost</dt><dd>{player.stats.pointsLost.toLocaleString()}</dd><dt>Biggest wager</dt><dd>{player.stats.biggestWager.toLocaleString()}</dd></dl>
      </article>;
    })}</div>
    <div className="control-row-v2"><button className="primary-button" onClick={onNewGame}>Start New Game</button><button className="secondary-button" onClick={onMenu}>Back to Menu</button></div>
  </section>;

  const places = new Map(standings.map((player) => [player.id, competitionPlace(standings, player)]));
  const tiedWinner = standings.filter((player) => places.get(player.id) === 1).length > 1;
  const byPlace = (place: number) => standings.find((player) => places.get(player.id) === place);
  const uniqueClassicPlaces = !tiedWinner && standings.length >= 3 && byPlace(1) && byPlace(2) && byPlace(3);
  const visualOrder = uniqueClassicPlaces
    ? [byPlace(2)!, byPlace(1)!, byPlace(3)!, ...standings.filter((player) => (places.get(player.id) ?? 99) > 3)]
    : standings;

  return <section className="podium-scene" aria-live="polite">
    <div className="podium-glow" aria-hidden="true" />
    <div className="section-kicker gold">FINAL STANDINGS</div>
    <h1>{tiedWinner ? 'We have co-winners!' : 'And the winner is…'}</h1>
    <div className={`podium-ranking ${tiedWinner ? 'tie-ranking' : ''}`}>{visualOrder.map((player, index) => {
      const place = places.get(player.id) ?? standings.length;
      const revealStep = index + 1;
      const isWinner = place === 1;
      const customization = normalizePlayerCustomization(player);
      return <article className={`podium-card ${isWinner ? 'winner' : ''} ${revealed >= revealStep ? 'reveal' : ''}`} key={player.id} data-victory-effect={customization.victoryEffect} style={{ '--accent': player.accent } as React.CSSProperties}>
        <div className="podium-crown">{isWinner ? '👑' : ''}</div>
        <div className="podium-place">#{place}</div>
        <div className="podium-avatar"><PlayerAvatar avatarId={player.avatarId} fallback={player.avatar} frameStyle={customization.frameStyle} accent={player.accent} /></div>
        <div className="podium-name">{player.name}</div>
        <div className="podium-score">{player.score.toLocaleString()}</div>
        <div className={`podium-pedestal place-${Math.min(place, 4)}`}>{isWinner ? tiedWinner ? 'CO-WINNER' : 'WINNER' : `${place}${place === 2 ? 'ND' : place === 3 ? 'RD' : 'TH'}`}</div>
      </article>;
    })}</div>
    {revealed >= standings.length && <>
      <div className="podium-confetti" aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <i key={index} style={{ '--i': index } as React.CSSProperties} />)}</div>
      <div className="podium-action-row"><button className="primary-button podium-stats-button" onClick={() => setShowStats(true)}>View Game Stats</button><button className="secondary-button podium-new-game-button" onClick={onNewGame}>Start New Game</button></div>
    </>}
  </section>;
}
