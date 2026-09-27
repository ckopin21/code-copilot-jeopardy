import type { RoomRole } from '../../../platform/rooms/types';
import type { DealSnapshot, Phase } from '../types';
import { emptyBuilder } from '../content/dealer';

const OFFERS_PUBLIC: readonly Phase[] = ['offers-reveal', 'partner', 'reveal'];
const PREMISE_PUBLIC: readonly Phase[] = ['stage', 'offers', 'offers-reveal', 'partner', 'reveal', 'break'];
const SCORECARD_PUBLIC: readonly Phase[] = ['reveal', 'break'];

/**
 * The privacy boundary. Before the reveal, only the presenter's phone gets the verdict and the full scorecard.
 * A shark's phone gets just the one row it peeked at; everyone sees who peeked at which check, never the answer.
 * The TV (host and presentation) gets no rows at all, other sharks' bids stay hidden until everyone locks, and a
 * seat code only ever goes to its own phone.
 */
export function sanitizeDealSnapshot(snapshot: DealSnapshot, role: RoomRole, playerId?: string): DealSnapshot {
  const copy: DealSnapshot = structuredClone(snapshot);
  for (const player of copy.players) {
    if (!(role === 'player' && player.id === playerId)) player.seatCode = null;
  }
  const round = copy.round;
  if (round) {
    const presenter = role === 'player' && playerId === round.presenterId;
    const revealed = SCORECARD_PUBLIC.includes(copy.phase);
    if (!presenter && !revealed) {
      round.verdict = null;
      round.explanation = null;
      const peeked = round.peeks.filter((item) => role === 'player' && item.sharkId === playerId).map((item) => item.category);
      round.scorecard = round.scorecard.filter((row) => peeked.includes(row.category));
    }
    if (!presenter) {
      round.builder = emptyBuilder();
      if (!PREMISE_PUBLIC.includes(copy.phase)) {
        round.nameOptions = [];
        round.premise = null;
      }
      round.pitchCueIds = [];
    }
    if (!OFFERS_PUBLIC.includes(copy.phase)) {
      for (const id of Object.keys(round.offers)) {
        if (!(role === 'player' && id === playerId)) round.offers[id] = null;
      }
    }
    if (!revealed) round.result = null;
  }
  // Built but not yet on stage: a phone sees only its own product, and nobody sees the verdict or scorecard until
  // that round starts. Everyone else (the TV included) learns only who has locked in.
  copy.upcoming = (copy.upcoming ?? []).map((item) => {
    const own = role === 'player' && item.presenterId === playerId;
    return {
      ...item,
      builder: own ? item.builder : emptyBuilder(),
      nameOptions: own ? item.nameOptions : [],
      premise: own ? item.premise : null,
      verdict: null, explanation: null, scorecard: [], peeks: [], pitchCueIds: []
    };
  });
  const forecast = copy.forecast;
  if (forecast && copy.phase === 'forecast') {
    forecast.answer = null;
    for (const id of Object.keys(forecast.guesses)) {
      if (!(role === 'player' && id === playerId)) forecast.guesses[id] = null;
    }
  }
  return copy;
}
