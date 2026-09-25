import type { RoomSnapshot } from '../types';
import { calculateComebackAward, comebackReferenceValue } from '../rules/comebackScoring';

export function ComebackBoostNotice({ room, playerId, surface }: { room: RoomSnapshot; playerId?: string; surface: 'host' | 'player' }) {
  const current = room.currentQuestion;
  const turnPlayerId = current?.turnPlayerId ?? (room.phase === 'board' ? room.turnPlayerId : null);
  const boostedPlayer = turnPlayerId ? room.players.find((player) => player.id === turnPlayerId) : null;
  if (!boostedPlayer) return null;
  if (surface === 'player' && playerId !== boostedPlayer.id) return null;

  if (room.phase === 'board' && room.board) {
    const award = calculateComebackAward(room, boostedPlayer, 1);
    if (award.multiplier === 1) return null;
    const referenceValue = comebackReferenceValue(room);
    const playerLabel = surface === 'host' ? boostedPlayer.name : 'you';

    return <aside className={`comeback-boost-notice comeback-${surface} comeback-board x${award.multiplier}`} role="status" aria-live="polite">
      <div className="comeback-boost-title"><span>COMEBACK BOOST ACTIVE</span><strong>{surface === 'host' ? boostedPlayer.name.toUpperCase() : 'YOUR TURN'} · {award.multiplier}×</strong></div>
      <div className="comeback-boost-values comeback-all-clues"><strong>EVERY ORDINARY CLUE ON THIS TURN SCORES {award.multiplier}× IF {surface === 'host' ? `${boostedPlayer.name.toUpperCase()} GETS` : 'YOU GET'} IT RIGHT</strong></div>
      <div className="comeback-boost-note">Sole last place only · unlocked after every player completes two turns · tier uses the board’s fixed {referenceValue.toLocaleString()}-point reference · other score multipliers stack.</div>
      <small>Only a correct answer by {playerLabel} spends a use · 2× uses left: {award.doubleUsesRemaining} · 3× uses left: {award.tripleUsesRemaining} · Daily Doubles and Final excluded</small>
    </aside>;
  }

  if (!current || current.dailyDouble || (room.phase !== 'question' && room.phase !== 'daily-double-question')) return null;
  const award = calculateComebackAward(room, boostedPlayer, current.effectiveValue);
  if (award.multiplier === 1) return null;

  const normalValue = current.effectiveValue;
  const boostedValue = award.points;
  const playerLabel = surface === 'host' ? boostedPlayer.name : 'you';
  const rightAnswerLabel = surface === 'host' ? `${boostedPlayer.name.toUpperCase()} GETS IT RIGHT` : 'YOU GET IT RIGHT';
  const useLabel = award.multiplier === 3
    ? `${award.tripleUsesRemaining} triple boost${award.tripleUsesRemaining === 1 ? '' : 's'} left`
    : `${award.doubleUsesRemaining} double boost${award.doubleUsesRemaining === 1 ? '' : 's'} left`;

  return <aside className={`comeback-boost-notice comeback-${surface} comeback-question x${award.multiplier}`} role="status" aria-live="polite">
    <div className="comeback-boost-title"><span>COMEBACK BOOST</span><strong>{award.multiplier}× ACTIVE</strong></div>
    <div className="comeback-boost-values"><span>NORMAL {normalValue.toLocaleString()}</span><b>→</b><strong>{boostedValue.toLocaleString()} IF {rightAnswerLabel}</strong></div>
    <div className="comeback-boost-note">Other active score modifiers are already included and stack with this boost. Wrong or no answer: −{normalValue.toLocaleString()}. Other players score the normal {normalValue.toLocaleString()}.</div>
    <small>Only a successful boosted answer by {playerLabel} spends a use · {useLabel} · 2× uses left: {award.doubleUsesRemaining} · 3× uses left: {award.tripleUsesRemaining}</small>
  </aside>;
}
