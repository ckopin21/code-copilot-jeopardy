// Decides what the hosts say when the game changes. Pure functions of two snapshots, so tests can cover them;
// narrator.ts does the playing.
import type { DealSnapshot, Phase, RoundState } from '../types';
import { LIVE_LINES, PER_PLAYER_LINES, speakable, type FixedLineId, type LiveLine } from './narrationLines';

export type Utterance = { fixed: FixedLineId } | { live: LiveLine };

export interface NarrationPlan {
  items: Utterance[];
  /** Cut off whatever is playing (a new phase). Otherwise the plan waits its turn. */
  interrupt: boolean;
  /** Wait this long first, so a music sting lands before the voice. */
  delayMs?: number;
  /** Drop the plan if it cannot start within this long (a stale warning is worse than none). */
  staleMs?: number;
}

/** The name the narrator should say, or null when nothing speakable is left (emoji-only names). */
export function spokenName(room: DealSnapshot, playerId: string | null | undefined): string | null {
  const player = room.players.find((item) => item.id === playerId);
  if (!player) return null;
  return speakable(player.sayAs ?? '') || speakable(player.name) || null;
}

function say(line: LiveLine | null, fallback: FixedLineId): Utterance {
  return line ? { live: line } : { fixed: fallback };
}
/** A line naming a player, spoken with the host's pronunciation but captioned with the name as typed. */
function named(room: DealSnapshot, playerId: string | null | undefined, build: (name: string) => LiveLine, fallback: FixedLineId): Utterance {
  return say(nameLine(room, playerId, build), fallback);
}
function nameLine(room: DealSnapshot, playerId: string | null | undefined, build: (name: string) => LiveLine): LiveLine | null {
  const name = spokenName(room, playerId);
  if (!name) return null;
  const line = build(name);
  const player = room.players.find((item) => item.id === playerId);
  return player?.sayAs ? { ...line, caption: build(player.name).text } : line;
}

/** Which lobby greeting a player gets: their seat, shifted by the room code so each room starts somewhere new. */
export function greetingVariant(room: DealSnapshot, playerId: string): number {
  const seat = Math.max(0, room.players.findIndex((player) => player.id === playerId));
  const shift = [...room.code].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return seat + shift;
}

const ROUND_LINES: readonly FixedLineId[] =['round-1', 'round-2', 'round-3', 'round-4'];

/**
 * "Please welcome Ava, founder of Flakely! Breakfast cereal." The TV says it when the stage opens; the server
 * builds the same line from the full state as soon as the product locks and renders it ahead (voicePrep.ts).
 */
export function pitchLine(room: DealSnapshot, round: RoundState): LiveLine | null {
  const premise = round.premise;
  if (!premise) return null;
  return nameLine(room, round.presenterId, (name) => LIVE_LINES.pitch(name, speakable(premise.businessName) || 'a brand new company', speakable(premise.headline)));
}

/** Unique leader by score, or null on a tie at the top. */
function leaderOf(scores: Map<string, number>): string | null {
  const ranked = [...scores].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || (ranked[1] && ranked[1][1] === ranked[0][1])) return null;
  return ranked[0][0];
}

function breakLine(room: DealSnapshot): Utterance {
  const now = new Map(room.players.map((player) => [player.id, player.score]));
  const leader = leaderOf(now);
  if (!leader) return { fixed: 'neck-and-neck' };
  // Scores before this round: take back the deltas the round just awarded.
  const last = room.history[room.history.length - 1];
  const before = new Map(now);
  for (const score of last?.scores ?? []) before.set(score.playerId, (before.get(score.playerId) ?? 0) - score.delta);
  const build = leaderOf(before) === leader ? LIVE_LINES.stillLeads : LIVE_LINES.leader;
  return named(room, leader, build, 'scores');
}

function phasePlan(before: DealSnapshot, room: DealSnapshot): NarrationPlan | null {
  const round = room.round;
  const presenterId = round?.presenterId;
  switch (room.phase) {
    case 'build': {
      // Everyone builds at once before round 1.
      const items: Utterance[] = [];
      if (before.phase === 'lobby') items.push({ fixed: 'welcome' });
      items.push({ fixed: 'build' });
      return { items, interrupt: true };
    }
    case 'stage': {
      // Each round opens on stage: "Round two! Please welcome Ben, founder of… Sharks, you each get one peek."
      const opener: FixedLineId = ROUND_LINES[Math.min(Math.max(room.roundIndex, 0), ROUND_LINES.length - 1)];
      return { items: [{ fixed: opener }, say(round ? pitchLine(room, round) : null, 'pitch'), { fixed: 'peeks' }], interrupt: true, delayMs: 2_200 };
    }
    case 'offers': return { items: [{ fixed: 'bids' }], interrupt: true };
    case 'offers-reveal': {
      const anyOffer = Object.values(round?.offers ?? {}).some((offer) => (offer ?? 0) > 0);
      return { items: [{ fixed: anyOffer ? 'offers-reveal' : 'no-offers' }], interrupt: true };
    }
    case 'partner': return { items: [named(room, presenterId, LIVE_LINES.pickPartner, 'tie')], interrupt: true };
    case 'reveal': {
      const result = round?.result;
      if (!result) return null;
      const good = result.verdict === 'good';
      const outcome: Utterance = result.deal
        ? named(room, result.deal.sharkId, good ? LIVE_LINES.dealGood : LIVE_LINES.dealBad, good ? 'deal-good' : 'deal-bad')
        : { fixed: good ? 'missed-good' : 'dodged-bad' };
      return { items: [{ fixed: good ? 'verdict-good' : 'verdict-bad' }, outcome], interrupt: true, delayMs: 1_500 };
    }
    case 'break': return { items: [breakLine(room)], interrupt: true, delayMs: 600 };
    case 'final': return { items: [{ fixed: 'final' }], interrupt: true };
    case 'forecast': return { items: [{ fixed: 'tiebreaker' }], interrupt: true };
    case 'gameover': {
      const winner = room.winnerIds.length === 1 ? room.winnerIds[0] : null;
      return { items: [{ fixed: 'winner-is' }, named(room, winner, LIVE_LINES.winner, 'winner')], interrupt: true, delayMs: 800 };
    }
    default: return null;
  }
}

/** What to say for a snapshot change, or null for silence. */
export function planNarration(before: DealSnapshot, room: DealSnapshot): NarrationPlan | null {
  if (before.code !== room.code || room.paused) return null;
  if (before.phase !== room.phase) return phasePlan(before, room);
  if (room.phase === 'lobby') {
    // A player appears in the lobby once their avatar is picked.
    const arrived = room.players.filter((player) => player.lookSet && !before.players.some((old) => old.id === player.id && old.lookSet));
    // Greetings are a bonus: without a speakable name or the live narrator, the lobby stays quiet.
    const items: Utterance[] = arrived.flatMap((player) => {
      const variant = greetingVariant(room, player.id);
      const line = nameLine(room, player.id, (name) => LIVE_LINES.joined(name, variant));
      return line ? [{ live: line }] : [];
    });
    return items.length ? { items, interrupt: false, staleMs: 8_000 } : null;
  }
  return null;
}

interface Warning { at: number; line: FixedLineId; minTotal?: number }
const WARNINGS: Partial<Record<Phase, readonly Warning[]>> = {
  build: [{ at: 10, line: 'build-10' }],
  stage: [{ at: 60, line: 'stage-60', minTotal: 120 }, { at: 30, line: 'stage-30', minTotal: 55 }, { at: 10, line: 'stage-10' }],
  offers: [{ at: 10, line: 'bids-10', minTotal: 15 }],
  forecast: [{ at: 10, line: 'tiebreaker-10', minTotal: 15 }]
};

/**
 * A time warning due now, with a key so it fires once. Only fires inside a short window after the mark,
 * so a resumed or reconnected screen does not announce a warning that is long past.
 */
export function dueWarning(room: DealSnapshot, remainingMs: number): { key: string; line: FixedLineId } | null {
  if (room.paused || !room.clock) return null;
  for (const warning of WARNINGS[room.phase] ?? []) {
    if (warning.minTotal && room.clock.totalMs < warning.minTotal * 1000) continue;
    if (remainingMs <= warning.at * 1000 && remainingMs > (warning.at - 2.5) * 1000) {
      return { key: `${room.code}:${room.gameNumber}:${room.roundIndex}:${room.phase}:${warning.at}`, line: warning.line };
    }
  }
  return null;
}

/** Name lines to render in the lobby so they play instantly during the game. */
export function lobbyPrefetch(room: DealSnapshot): LiveLine[] {
  return room.players.filter((player) => player.lookSet).flatMap((player) => {
    const name = spokenName(room, player.id);
    return name ? PER_PLAYER_LINES.map((kind) => LIVE_LINES[kind](name)) : [];
  });
}
