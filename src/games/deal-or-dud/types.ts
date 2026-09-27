// Shared types for Deal or Dud. Used by the server engine and the browser screens.

export const GAME_ID = 'deal-or-dud';
export const PLAYER_COUNT = 4;
export const ROUND_COUNT = 4;

export type Tone = 'clean' | 'silly' | 'crude';
export type Verdict = 'good' | 'bad';

/** What kind of thing the main product is. Twists and scorecard lines declare which forms they suit. */
export type ProductForm = 'food' | 'gadget' | 'goods' | 'pet' | 'service' | 'rental' | 'digital' | 'event';

/** The four fixed scorecard checks, the same every round. */
export type CategoryId = 'works' | 'demand' | 'money' | 'trouble';
export const CATEGORY_IDS: readonly CategoryId[] = ['works', 'demand', 'money', 'trouble'];

export type TimerPreset = 'quick' | 'standard' | 'relaxed' | 'custom';

export interface TimerSettings {
  /** Product builder clock (seconds). The key is `prep` so saved settings keep working. */
  prep: number;
  /** One clock for the whole time on stage: the pitch and the sharks' questions. */
  stage: number;
  offers: number;
  /** How long "the truth" (the reveal) stays up. */
  reveal: number;
  /** The scores break between rounds. */
  scores: number;
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
  tone: Tone;
  tutorial: boolean;
  captions: boolean;
  audio: AudioSettings;
}

export type Phase =
  | 'lobby'
  | 'tutorial'
  | 'build'
  | 'stage'
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

/** One secret scorecard check: ✅ (ok) or ❌, with a short plain line. */
export interface ScoreRow {
  category: CategoryId;
  ok: boolean;
  text: string;
  /** Content line id, for avoiding repeats. */
  lineId: string;
}

/** A shark's one peek this round. Who peeked at what is public; the row itself only goes to that shark. */
export interface Peek {
  sharkId: string;
  category: CategoryId;
}

export type BuilderColumn = 'products' | 'modifiers' | 'audiences';

/** A player's picks in the three-step card builder. Ids refer to the content pools. */
export interface BuilderPicks {
  product: string | null;
  modifier: string | null;
  audience: string | null;
  /** The four cards currently offered in each step (🔀 deals a new four). */
  hands: Record<BuilderColumn, string[]>;
}

export interface LockedPremise {
  headline: string;
  mainProductId: string;
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
  scorecard: ScoreRow[];
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
  /** When the presenter locked their product during the build. */
  lockedAt?: number | null;
  /** Secret: set when the premise locks. */
  verdict: Verdict | null;
  explanation: string | null;
  /**
   * Secret: the four checks, in category order. The presenter gets all four, a shark only the row it peeked at,
   * and the TV none until the reveal.
   */
  scorecard: ScoreRow[];
  peeks: Peek[];
  offers: Record<string, OfferChoice | null>;
  lockedOffers: string[];
  /** Sharks who tapped "Ready to bid". When all three have, the stage ends early. */
  readyToBid: string[];
  tiedSharkIds: string[];
  pitchCueIds: string[];
  result: RoundResult | null;
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
   * build this holds all four; each round moves to `round` when it goes on stage. A phone only ever sees its own.
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

/** The presets only set the stage clock (pitch and questions). Every other timer has one flat default. */
export const STAGE_PRESETS: Record<Exclude<TimerPreset, 'custom'>, number> = { quick: 120, standard: 180, relaxed: 240 };
export const DEFAULT_TIMERS: TimerSettings = { prep: 75, stage: 180, offers: 45, reveal: 10, scores: 5, tiebreaker: 20 };
/** The timers under "More timers" in the host settings. */
export const OTHER_TIMERS: readonly (keyof TimerSettings)[] = ['prep', 'offers', 'reveal', 'scores', 'tiebreaker'];

export const TIMER_LIMITS: Record<keyof TimerSettings, { min: number; max: number; step: number; label: string }> = {
  prep: { min: 20, max: 180, step: 5, label: 'Product builder' },
  stage: { min: 60, max: 600, step: 30, label: 'On stage (pitch & questions)' },
  offers: { min: 20, max: 90, step: 5, label: 'Offer lock' },
  reveal: { min: 5, max: 30, step: 1, label: 'The truth' },
  scores: { min: 3, max: 20, step: 1, label: 'Scores between rounds' },
  tiebreaker: { min: 10, max: 40, step: 5, label: 'Tiebreaker guess' }
};

/** There is no tone setting: every game uses the full funny set of cards (clean, silly and mild bathroom humor). */
export const GAME_TONE: Tone = 'crude';

export const DEFAULT_SETTINGS: DealSettings = {
  timerPreset: 'standard',
  timers: { ...DEFAULT_TIMERS },
  tone: GAME_TONE,
  tutorial: true,
  captions: true,
  audio: { music: 55, effects: 75, narration: 90, muted: false }
};

/** Fixed rule timings (seconds) that are not host settings. */
export const RULE_TIMINGS = {
  offersReveal: 5,
  partnerChoice: 20,
  forecastResult: 8,
  tutorialSeconds: 48
} as const;

/** Every bid a shark can lock, in $K. */
export const OFFER_CHOICES: readonly OfferChoice[] = [0, 100, 200, 300, 400, 500];

export const TONE_ORDER: Record<Tone, number> = { clean: 0, silly: 1, crude: 2 };
export function toneAllows(setting: Tone, itemTone: Tone | undefined): boolean {
  return TONE_ORDER[itemTone ?? 'clean'] <= TONE_ORDER[setting];
}

/** Plain-language total time estimate in minutes: one shared build, then four rounds. */
export function estimateMinutes(timers: TimerSettings, tutorial: boolean): { low: number; high: number } {
  const perRound = timers.stage + timers.offers + RULE_TIMINGS.offersReveal + timers.reveal + timers.scores;
  const base = timers.prep + perRound * ROUND_COUNT + (tutorial ? RULE_TIMINGS.tutorialSeconds : 0) + 60 /* lobby and final scores */;
  return { low: Math.round((base * 0.85) / 60), high: Math.round((base * 1.05) / 60) };
}
