import type { RoomRole } from '../../../platform/rooms/types';
import type { DealSnapshot, Phase } from '../types';
import { emptyBuilder } from '../content/dealer';

const OFFERS_PUBLIC: readonly Phase[] = ['reveal', 'break'];
const PREMISE_PUBLIC: readonly Phase[] = ['stage', 'offers', 'reveal', 'break'];

/**
 * The privacy boundary. Bids stay secret until the reveal (a phone sees only its own; who has locked and who is out
 * are public), a product stays on its builder's phone until it goes on stage, and a seat code only ever goes to its
 * own phone.
 */
export function sanitizeDealSnapshot(snapshot: DealSnapshot, role: RoomRole, playerId?: string): DealSnapshot {
  const copy: DealSnapshot = structuredClone(snapshot);
  for (const player of copy.players) {
    if (!(role === 'player' && player.id === playerId)) player.seatCode = null;
  }
  const round = copy.round;
  if (round) {
    const presenter = role === 'player' && playerId === round.presenterId;
    if (!presenter) {
      round.builder = emptyBuilder();
      if (!PREMISE_PUBLIC.includes(copy.phase)) {
        round.premise = null;
      }
    }
    if (!OFFERS_PUBLIC.includes(copy.phase)) {
      const out = new Set(round.out.map((item) => item.sharkId));
      for (const id of Object.keys(round.offers)) {
        // "I'm out" was said out loud, so its $0 is no secret.
        if (!(role === 'player' && id === playerId) && !out.has(id)) round.offers[id] = null;
      }
      round.result = null;
    }
  }
  // Built but not yet on stage: a phone sees only its own product. Everyone else (the TV included) learns only who
  // has locked in.
  copy.upcoming = (copy.upcoming ?? []).map((item) => {
    const own = role === 'player' && item.presenterId === playerId;
    return {
      ...item,
      builder: own ? item.builder : emptyBuilder(),
      premise: own ? item.premise : null
    };
  });
  const votes = copy.votes;
  if (votes && copy.phase === 'vote') {
    for (const id of Object.keys(votes.pitches)) if (!(role === 'player' && id === playerId)) votes.pitches[id] = null;
  }
  const forecast = copy.forecast;
  if (forecast && copy.phase === 'forecast') {
    forecast.answer = null;
    for (const id of Object.keys(forecast.guesses)) {
      if (!(role === 'player' && id === playerId)) forecast.guesses[id] = null;
    }
  }
  return copy;
}
