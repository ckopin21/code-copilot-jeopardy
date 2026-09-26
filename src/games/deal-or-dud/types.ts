// Shared types for Deal or Dud. Used by the server engine and the browser screens.

export const GAME_ID = 'deal-or-dud';
export const PLAYER_COUNT = 4;
export const ROUND_COUNT = 4;

export type Tone = 'clean' | 'silly' | 'crude';
export type Complexity = 'simple' | 'standard' | 'challenge';
export type Verdict = 'good' | 'bad';
export type Polarity = 'favorable' | 'unfavorable';

/** What kind of thing the main product is. Fact cards and modifiers declare which forms they suit. */
export type ProductForm = 'food' | 'gadget' | 'goods' | 'pet' | 'service' | 'rental' | 'digital' | 'event';

/** Fixed list of business subjects. Each fact card covers one; sharks ask about subjects out loud. */
export type SubjectId =
  | 'sales' | 'repeat' | 'returns' | 'durability' | 'cost' | 'price' | 'stores' | 'shipping'
  | 'reviews' | 'safety' | 'rivals' | 'team' | 'supplier' | 'sponsor' | 'ads' | 'usage' | 'season';

export type TimerPreset = 'quick' | 'standard' | 'relaxed' | 'custom';

export interface TimerSettings {
  /** Product builder clock (seconds). The key is `prep` so saved settings keep working. */
  prep: number;
  /** One clock for reading the secret file and giving the opening pitch. */
  pitch: number;
  discussion: number;
  offers: number;
  tiebreaker: number;
}

export interface AudioSettings {
  music: number;
  effects: number;
  narration: number;
  muted: boolean;
}

export interface DealSettings {
  timerPreset: TimerPreset;
  timers: TimerSettings;
  complexity: Complexity;
  tone: Tone;
  tutorial: boolean;
  captions: boolean;
  audio: AudioSettings;
}

export type Phase =
  | 'lobby'
  | 'tutorial'
  | 'build'
  | 'pitch'
  | 'discussion'
  | 'offers'
  | 'offers-reveal'
  | 'partner'
  | 'reveal'
  | 'break'
  | 'final'
  | 'forecast'
  | 'forecast-result'
  | 'gameover';

export type PlayerLook =
  | { kind: 'preset'; presetId: string }
  | { kind: 'photo'; photo: string };

export interface DealPlayer {
  id: string;
  name: string;
  connected: boolean;
  look: PlayerLook;
  score: number;
  joinedAt: number;
  /** False until the phone finishes picking an avatar; the lobby hides the player until then. */
  lookSet: boolean;
  /** Four digits that get this seat back on any phone. Only the player's own phone receives it. */
  seatCode: string | null;
  /** How the narrator should pronounce the name, set by the host ("Shiv-awn"). Absent means say the name as typed. */
  sayAs?: string;
}

export interface FactCard {
  id: string;
  subject: SubjectId;
  polarity: Polarity;
  text: string;
}

export type RevealSource = 'opening' | 'presenter' | 'final';

export interface PublicFact extends FactCard {
  source: RevealSource;
  revealedAt: number;
}

/** A presenter's picks in the product builder. Ids refer to the content pools. */
export interface BuilderPicks {
  modifiers: string[];
  products: string[];
  audiences: string[];
  mainProduct: string | null;
  /** Product the game supplied because none was picked. */
  suppliedProduct: string | null;
}

export interface LockedPremise {
  headline: string;
  mainProductId: string;
  addOn: string | null;
  businessName: string;
  form: ProductForm;
}

/** A shark's bid in $K. 0 means no bid ("I'm out"). */
export type OfferChoice = 0 | 100 | 200 | 300 | 400 | 500;
export type DealAmount = Exclude<OfferChoice, 0>;

export interface ClockState {
  /** Server time the clock reaches zero while running. */
  endsAt: number | null;
  /** Remaining time while paused or not yet started. */
  remainingMs: number;
  totalMs: number;
}

export interface RoundScore {
  playerId: string;
  delta: number;
  reason: string;
}

export interface RoundResult {
  verdict: Verdict;
  explanation: string;
  laterLine: string;
  deal: { sharkId: string; amount: DealAmount } | null;
  offers: Record<string, OfferChoice>;
  scores: RoundScore[];
}

export interface RoundState {
  index: number;
  presenterId: string;
  sharkIds: string[];
  builder: BuilderPicks;
  /** Three business-name options the presenter can tap; first is the default. */
  nameOptions: string[];
  premise: LockedPremise | null;
  /** When the presenter locked their product during the build (absent in rooms saved before the shared build). */
  lockedAt?: number | null;
  /** Secret: set when the premise locks. */
  verdict: Verdict | null;
  explanation: string | null;
  dossier: FactCard[];
  publicFacts: PublicFact[];
  offers: Record<string, OfferChoice | null>;
  lockedOffers: string[];
  /** Sharks who tapped "Ready to bid". When all three have, questions end early. */
  readyToBid: string[];
  tiedSharkIds: string[];
  pitchCueIds: string[];
  result: RoundResult | null;
  /** Variant id for recent-history avoidance. */
  profileVariantId: string | null;
}

export interface ForecastCardPublic {
  id: string;
  title: string;
  clues: string[];
  question: string;
}

export interface ForecastState {
  attempt: 1 | 2;
  playerIds: string[];
  card: ForecastCardPublic;
  answer: number | null;
  guesses: Record<string, number | null>;
  submitted: string[];
  winnerId: string | null;
  closestIds: string[];
  randomDraw: boolean;
}

export interface DealSnapshot {
  game: typeof GAME_ID;
  code: string;
  createdAt: number;
  expiresAt: number;
  revision: number;
  serverNow: number;
  phase: Phase;
  paused: boolean;
  pausedAt: number | null;
  pauseReason: 'host' | 'presenter-offline' | null;
  settings: DealSettings;
  players: DealPlayer[];
  hostConnected: boolean;
  /** Player who can use host controls from their phone (first to join). */
  vipId: string | null;
  roundIndex: number;
  round: RoundState | null;
  /**
   * Rounds not yet played, in pitch order. Everyone builds their product at once before round 1, so during the
   * build this holds all four; each round moves to `round` when its pitch starts. A phone only ever sees its own.
   */
  upcoming: RoundState[];
  history: RoundResult[];
  clock: ClockState | null;
  forecast: ForecastState | null;
  winnerIds: string[];
  tutorialRun: number;
  /** Phase to return to after a replayed tutorial. */
  tutorialReturn: Phase | null;
  gameNumber: number;
  joinUrl: string;
}

export const DEFAULT_TIMERS: Record<Exclude<TimerPreset, 'custom'>, TimerSettings> = {
  quick: { prep: 35, pitch: 60, discussion: 120, offers: 30, tiebreaker: 15 },
  standard: { prep: 45, pitch: 90, discussion: 150, offers: 45, tiebreaker: 20 },
  relaxed: { prep: 60, pitch: 120, discussion: 210, offers: 60, tiebreaker: 30 }
};

export const TIMER_LIMITS: Record<keyof TimerSettings, { min: number; max: number; step: number; label: string }> = {
  prep: { min: 20, max: 120, step: 5, label: 'Product builder' },
  pitch: { min: 30, max: 180, step: 5, label: 'Read the file & pitch' },
  discussion: { min: 60, max: 300, step: 10, label: 'Live discussion' },
  offers: { min: 20, max: 90, step: 5, label: 'Offer lock' },
  tiebreaker: { min: 10, max: 40, step: 5, label: 'Tiebreaker guess' }
};

export const DEFAULT_SETTINGS: DealSettings = {
  timerPreset: 'standard',
  timers: { ...DEFAULT_TIMERS.standard },
  complexity: 'standard',
  tone: 'silly',
  tutorial: true,
  captions: true,
  audio: { music: 55, effects: 75, narration: 90, muted: false }
};

/** Fixed rule timings (seconds) that are not host settings. */
export const RULE_TIMINGS = {
  offersReveal: 5,
  partnerChoice: 20,
  reveal: 15,
  breakBetweenRounds: 12,
  forecastResult: 8,
  tutorialSeconds: 56
} as const;

/** Every bid a shark can lock, in $K. */
export const OFFER_CHOICES: readonly OfferChoice[] = [0, 100, 200, 300, 400, 500];

export const TONE_ORDER: Record<Tone, number> = { clean: 0, silly: 1, crude: 2 };
export function toneAllows(setting: Tone, itemTone: Tone | undefined): boolean {
  return TONE_ORDER[itemTone ?? 'clean'] <= TONE_ORDER[setting];
}

/** Plain-language total time estimate in minutes for four rounds. */
export function estimateMinutes(timers: TimerSettings, tutorial: boolean): { low: number; high: number } {
  const perRound = timers.prep + timers.pitch + timers.discussion + timers.offers
    + RULE_TIMINGS.offersReveal + RULE_TIMINGS.reveal + RULE_TIMINGS.breakBetweenRounds;
  const base = perRound * ROUND_COUNT + (tutorial ? RULE_TIMINGS.tutorialSeconds : 0) + 60 /* lobby and final scores */;
  return { low: Math.round((base * 0.9) / 60), high: Math.round((base * 1.12) / 60) };
}
