import type { RoomSnapshot } from '../shared/types';
import { calculateComebackAward } from '../lib/comebackScoring';

export function ComebackBoostNotice({ room, playerId, surface }: { room: RoomSnapshot; playerId?: string; surface: 'host' | 'player' }) {
  const current = room.currentQuestion;
  if (!current || current.dailyDouble || (room.phase !== 'question' && room.phase !== 'daily-double-question')) return null;

  const boostedPlayer = current.turnPlayerId ? room.players.find((player) => player.id === current.turnPlayerId) : null;
  if (!boostedPlayer) return null;
  if (surface === 'player' && playerId !== boostedPlayer.id) return null;

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
    <div className="comeback-boost-note">Wrong or no answer: −{normalValue.toLocaleString()}. Other players score the normal {normalValue.toLocaleString()}. Only a successful boosted answer by {playerLabel} spends a use.</div>
    <small>{useLabel} · 2× uses left: {award.doubleUsesRemaining} · 3× uses left: {award.tripleUsesRemaining}</small>
  </aside>;
}
