import type { RoomSnapshot } from '../shared/types';
import { calculateComebackAward } from '../lib/comebackScoring';

export function ComebackBoostNotice({ room, playerId, surface }: { room: RoomSnapshot; playerId?: string; surface: 'host' | 'player' }) {
  const current = room.currentQuestion;
  const turnPlayerId = current?.turnPlayerId ?? (room.phase === 'board' ? room.turnPlayerId : null);
  const boostedPlayer = turnPlayerId ? room.players.find((player) => player.id === turnPlayerId) : null;
  if (!boostedPlayer) return null;
  if (surface === 'player' && playerId !== boostedPlayer.id) return null;

  if (room.phase === 'board' && room.board) {
    const normalValues = [...new Set(room.board.questions
      .filter((tile) => !tile.used)
      .map((tile) => tile.value * room.multiplier))].sort((a, b) => a - b);
    const activeValues = normalValues.map((normalValue) => ({ normalValue, award: calculateComebackAward(room, boostedPlayer, normalValue) }))
      .filter(({ award }) => award.multiplier > 1);
    if (!activeValues.length) return null;

    const sample = activeValues[0].award;
    return <aside className={`comeback-boost-notice comeback-${surface} comeback-board`} role="status" aria-live="polite">
      <div className="comeback-boost-title"><span>COMEBACK BOOSTS ACTIVE</span><strong>{surface === 'host' ? boostedPlayer.name.toUpperCase() : 'YOUR TURN'}</strong></div>
      <div className="comeback-boost-values comeback-value-list">{activeValues.map(({ normalValue, award }) => <span key={normalValue}><small>{normalValue.toLocaleString()}</small><b>→</b><strong>{award.points.toLocaleString()} ({award.multiplier}×)</strong></span>)}</div>
      <div className="comeback-boost-note">Only the sole last-place player can qualify, after two full rounds have been completed. Only a correct answer by {surface === 'host' ? boostedPlayer.name : 'you'} spends a use.</div>
      <small>Miss / no answer / another player buzzes: boost stays unused · 2× uses left: {sample.doubleUsesRemaining} · 3× uses left: {sample.tripleUsesRemaining} · Daily Doubles and Final excluded</small>
    </aside>;
  }

  if (!current || current.dailyDouble || (room.phase !== 'question' && room.phase !== 'daily-double-question')) return null;
  const award = calculateComebackAward(room, boostedPlayer, current.effectiveValue);
  if (award.multiplier === 1) return null;

  const normalValue = current.effectiveValue;
  const boostedValue = award.points;
  const playerLabel = surface === 'host' ? boostedPlayer.name : 'you';
  const useLabel = award.multiplier === 3
    ? `${award.tripleUsesRemaining} triple boost${award.tripleUsesRemaining === 1 ? '' : 's'} left`
    : `${award.doubleUsesRemaining} double boost${award.doubleUsesRemaining === 1 ? '' : 's'} left`;

  return <aside className={`comeback-boost-notice comeback-${surface} x${award.multiplier}`} role="status" aria-live="polite">
    <div className="comeback-boost-title"><span>COMEBACK BOOST</span><strong>{award.multiplier}× ACTIVE</strong></div>
    <div className="comeback-boost-values"><span>NORMAL {normalValue.toLocaleString()}</span><b>→</b><strong>{boostedValue.toLocaleString()} IF {surface === 'host' ? boostedPlayer.name.toUpperCase() : 'YOU'} GET IT RIGHT</strong></div>
    <div className="comeback-boost-note">Sole last place only · available after two full rounds. Wrong or no answer: −{normalValue.toLocaleString()}. Other players score the normal {normalValue.toLocaleString()}. Only a successful boosted answer by {playerLabel} spends a use.</div>
    <small>{useLabel} · 2× uses left: {award.doubleUsesRemaining} · 3× uses left: {award.tripleUsesRemaining}</small>
  </aside>;
}
