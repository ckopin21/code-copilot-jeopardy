import type { GamePhase } from '../types';

export function turnIndicatorVisible(phase: GamePhase): boolean {
  return phase === 'board' || phase === 'question' || phase === 'daily-double-wager' || phase === 'daily-double-question';
}

export function turnIndicatorLabel(phase: GamePhase): '' | 'ON TURN' {
  return phase === 'board' ? '' : 'ON TURN';
}

/** Full Final wagers stay private on shared scoreboards until the completed recap. */
export function scoreboardWagersVisible(phase: GamePhase): boolean {
  return phase === 'recap';
}
