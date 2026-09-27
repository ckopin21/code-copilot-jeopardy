import type { DealPlayer, DealSnapshot, OfferChoice, Phase } from '../types';
import { NARRATION_SECONDS } from '../narrationDurations';
import { TUTORIAL_STEPS } from '../tutorialScript';

export const PHASE_LABEL: Record<Phase, string> = {
  lobby: 'Lobby',
  tutorial: 'How to play',
  build: 'Everyone builds',
  stage: 'On stage',
  offers: 'Bids',
  'offers-reveal': 'Bids revealed',
  partner: 'Choose a partner',
  reveal: 'The truth',
  break: 'Scores',
  final: 'Final scores',
  forecast: 'Tiebreaker',
  'forecast-result': 'Tiebreaker',
  gameover: 'Winner'
};

export function offerLabel(choice: OfferChoice | null | undefined): string {
  if (choice == null) return '—';
  return choice === 0 ? '$0 (out)' : `$${choice}K`;
}

export function playerById(room: DealSnapshot, id: string | null | undefined): DealPlayer | undefined {
  return room.players.find((player) => player.id === id);
}

export function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

/** Tutorial timing shared by the TV and a remote display, so both show the same step. */
export const TUTORIAL_GAP = 0.35;
export const TUTORIAL_TIMELINE = (() => {
  let start = 0.6;
  return TUTORIAL_STEPS.map((step) => {
    const seconds = NARRATION_SECONDS[step.id] ?? step.seconds;
    const item = { step, start, seconds };
    start += seconds + TUTORIAL_GAP;
    return item;
  });
})();
export const TUTORIAL_LENGTH = TUTORIAL_TIMELINE[TUTORIAL_TIMELINE.length - 1].start + TUTORIAL_TIMELINE[TUTORIAL_TIMELINE.length - 1].seconds + 0.6;

/** Highest score first; a tiebreaker winner goes ahead of the players they tied with. */
export function standings(room: DealSnapshot): DealPlayer[] {
  const won = (player: DealPlayer) => (room.winnerIds.includes(player.id) ? 1 : 0);
  return [...room.players].sort((a, b) => b.score - a.score || won(b) - won(a) || a.joinedAt - b.joinedAt);
}

/** Place in the standings; equal scores share a place unless a tiebreaker separated them. */
export function rankOf(room: DealSnapshot, player: DealPlayer): number {
  const won = (other: DealPlayer) => room.winnerIds.includes(other.id);
  return 1 + room.players.filter((other) => other.score > player.score || (other.score === player.score && won(other) && !won(player))).length;
}
