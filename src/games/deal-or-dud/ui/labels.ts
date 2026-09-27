import type { DealPlayer, DealSnapshot, OfferChoice, Phase } from '../types';
import { pitchSeconds } from '../types';
import { NARRATION_SECONDS } from '../narrationDurations';
import { TUTORIAL_STEPS } from '../tutorialScript';

export const PHASE_LABEL: Record<Phase, string> = {
  lobby: 'Lobby',
  tutorial: 'How to play',
  build: 'Everyone builds',
  stage: 'On stage',
  offers: 'Bids',
  reveal: 'The reveal',
  break: 'Scores',
  final: 'Final scores',
  forecast: 'Tiebreaker',
  'forecast-result': 'Tiebreaker',
  gameover: 'Winner'
};

export function offerLabel(choice: OfferChoice | null | undefined): string {
  if (choice == null) return '—';
  return choice === 0 ? '$0' : `$${choice}K`;
}

/** How each bid feels, from 🙅 no way to 🔥 take my money. */
export const BID_LABELS: Record<OfferChoice, { emoji: string; text: string }> = {
  0: { emoji: '🙅', text: 'No way' },
  100: { emoji: '🤏', text: 'A little' },
  200: { emoji: '🙂', text: 'Maybe' },
  300: { emoji: '👍', text: 'I like it' },
  400: { emoji: '😍', text: 'Love it' },
  500: { emoji: '🔥', text: 'Take my money' }
};

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

/**
 * When the reveal shows each thing, in seconds after it starts: one flip per shark (lowest bid first), then the total
 * and who is in. The default 10 s reveal uses the full timing; a shorter one squeezes it.
 */
export interface RevealSchedule { flips: number[]; total: number }
export function revealSchedule(totalMs: number): RevealSchedule {
  const scale = Math.min(1, Math.max(0.3, (totalMs / 1000 - 1) / 7.2));
  return { flips: [1.4, 3, 4.6].map((at) => at * scale), total: 6.2 * scale };
}

/** Seconds since the current phase's clock started (frozen while paused). */
export function clockElapsed(room: DealSnapshot, now: number, offset: number): number {
  const clock = room.clock;
  if (!clock) return 0;
  const remaining = clock.endsAt === null ? clock.remainingMs : Math.max(0, clock.endsAt - (room.paused && room.pausedAt ? room.pausedAt : now + offset));
  return (clock.totalMs - remaining) / 1000;
}

/** The host's skip button: what it skips to right now. */
export function skipLabel(room: DealSnapshot): string {
  if (room.phase === 'tutorial') return 'Skip tutorial';
  if (room.phase === 'build') return 'Lock everyone in ▶▶';
  if (room.phase === 'stage') return room.round?.questionsOpen ? 'Skip to bids ▶▶' : 'Skip to questions ▶▶';
  return 'Skip ▶▶';
}

/** Seconds of pitch time left on stage, given the stage clock's seconds left; null once questions are open. */
export function pitchSecondsLeft(room: DealSnapshot, secondsLeft: number): number | null {
  const round = room.round;
  if (room.phase !== 'stage' || !round || round.questionsOpen || !room.clock) return null;
  const total = room.clock.totalMs / 1000;
  return Math.max(0, secondsLeft - (total - pitchSeconds(total)));
}
