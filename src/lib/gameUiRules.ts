import type { GamePhase } from '../shared/types';

export function turnIndicatorVisible(phase: GamePhase): boolean {
  return phase === 'board' || phase === 'question' || phase === 'daily-double-wager' || phase === 'daily-double-question';
}

export function turnIndicatorLabel(phase: GamePhase): 'SELECTS NEXT' | 'ON TURN' {
  return phase === 'board' ? 'SELECTS NEXT' : 'ON TURN';
}

/** Full Final wagers stay private on shared scoreboards until the completed recap. */
export function scoreboardWagersVisible(phase: GamePhase): boolean {
  return phase === 'recap';
}
