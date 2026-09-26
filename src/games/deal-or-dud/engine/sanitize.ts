import type { RoomRole } from '../../../platform/rooms/types';
import type { DealSnapshot, Phase } from '../types';

const OFFERS_PUBLIC: readonly Phase[] = ['offers-reveal', 'partner', 'reveal'];
const PREMISE_PUBLIC: readonly Phase[] = ['pitch', 'discussion', 'offers', 'offers-reveal', 'partner', 'reveal', 'break'];

/**
 * The privacy boundary. The TV (host and presentation) and sharks never receive the verdict,
 * the hidden cards, other sharks' bids before the reveal, or anyone else's seat code.
 * Only the presenter's own phone gets the dossier, and only once their pitch starts.
 */
export function sanitizeDealSnapshot(snapshot: DealSnapshot, role: RoomRole, playerId?: string): DealSnapshot {
  const copy: DealSnapshot = structuredClone(snapshot);
  for (const player of copy.players) {
    if (!(role === 'player' && player.id === playerId)) player.seatCode = null;
  }
  const round = copy.round;
  if (round) {
    const presenter = role === 'player' && playerId === round.presenterId;
    const revealed = copy.phase === 'reveal' || copy.phase === 'break';
    if (!presenter) {
      if (!revealed) { round.verdict = null; round.explanation = null; }
      round.dossier = [];
      if (!PREMISE_PUBLIC.includes(copy.phase)) {
        round.builder = { modifiers: [], products: [], audiences: [], mainProduct: null, suppliedProduct: null };
        round.nameOptions = [];
        round.premise = null;
      }
      round.profileVariantId = null;
      round.pitchCueIds = [];
    }
    if (!OFFERS_PUBLIC.includes(copy.phase)) {
      for (const id of Object.keys(round.offers)) {
        if (!(role === 'player' && id === playerId)) round.offers[id] = null;
      }
    }
    if (!revealed) round.result = null;
  }
  // Built but not yet pitched: a phone sees only its own product, and nobody sees the verdict or file until that
  // round's pitch. Everyone else (the TV included) learns only who has locked in.
  copy.upcoming = (copy.upcoming ?? []).map((item) => {
    const own = role === 'player' && item.presenterId === playerId;
    return {
      ...item,
      builder: own ? item.builder : { modifiers: [], products: [], audiences: [], mainProduct: null, suppliedProduct: null },
      nameOptions: own ? item.nameOptions : [],
      premise: own ? item.premise : null,
      verdict: null, explanation: null, dossier: [], profileVariantId: null, pitchCueIds: []
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
