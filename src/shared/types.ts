export const QUESTION_VALUES = [100, 200, 300, 400, 500, 1000] as const;
export type QuestionValue = (typeof QUESTION_VALUES)[number];

export type GamePhase =
  | 'lobby'
  | 'board'
  | 'question'
  | 'daily-double-wager'
  | 'daily-double-question'
  | 'final-category'
  | 'final-wager'
  | 'final-question'
  | 'final-review'
  | 'recap'
  | 'paused';

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';
export type GameLength = 'quick' | 'standard' | 'marathon';
export type GameMode = 'classic' | 'free-response';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';
export type ResponseMode = 'buzz' | 'text';
export type AutoGradeConfidence = 'high' | 'medium' | 'low';
export type QuestionType = 'person' | 'place' | 'time' | 'title' | 'term' | 'number' | 'object' | 'organization' | 'event' | 'general';

export interface Question {
  id: string;
  packId: string;
  category: string;
  text: string;
  acceptedAnswers: string[];
  alternateAnswers?: string[];
  value: QuestionValue;
  difficulty: 'easy' | 'medium' | 'hard';
  /** What kind of knowledge/answer target this clue asks for. */
  questionType: QuestionType;
  /** Catalog-wide identity for the underlying fact. Duplicate fact keys are rejected across packs. */
  factKey: string;
  explanation?: string;
  dailyDoubleEligible?: boolean;
  responseMode?: ResponseMode;
  tags: string[];
}

export interface QuestionPack {
  id: string;
  title: string;
  theme: string;
  description: string;
  difficulty: Difficulty;
  approximateMinutes: number;
  /** Optional visual accent used by pack cards and future themed presentation surfaces. */
  accentColor?: string;
  /** Optional image URL/data URL for pack art. Pack logic never depends on this field. */
  titleArt?: string;
  /** Game modes allowed to use this pack. Omitted legacy packs default to Classic only. */
  supportedGameModes?: GameMode[];
  /** Optional preferred category order. Unlisted categories follow afterward. */
  categoryOrder?: string[];
  /** Optional explicit Final question. It must reference a question inside this pack. */
  finalQuestionId?: string;
  questions: Question[];
}

export interface GameSettings {
  gameMode: GameMode;
  gameLength: GameLength;
  selectedPackIds: string[];
  mixedPacks: boolean;
  randomizeCategories: boolean;
  dailyDoublesEnabled: boolean;
  dailyDoubleCount: number;
  stealsEnabled: boolean;
  allowNegativeScores: boolean;
  timerSeconds: 5 | 10 | 15 | 20 | 30 | null;
  autoCloseBuzzersAtZero: boolean;
  lateGameModifiers: boolean;
  dailyDoubleStacksWithMultiplier: boolean;
  streaksEnabled: boolean;
  coldStreakThreshold: number;
  finalRoundEnabled: boolean;
  lockRoomOnStart: boolean;
  allowRepeatBuzzAfterMiss: boolean;
  allowWagerBeyondScore: boolean;
  maxWager: number;
  localBuzzersEnabled: boolean;
  controllerBuzzersEnabled: boolean;
  /** Join order rotates automatically; manual keeps the host-selected picker until changed. */
  turnOrderMode: 'join-order' | 'manual';
}

export interface PlayerStats {
  correct: number;
  incorrect: number;
  longestStreak: number;
  longestColdStreak: number;
  dailyDoublesFound: number;
  biggestWager: number;
  fastestBuzzMs: number | null;
  pointsGained: number;
  pointsLost: number;
}

export interface Player {
  id: string;
  /** Stable Player 1–5 seat. Disconnecting never changes it; removal frees it. */
  seat: number;
  name: string;
  avatar: string;
  accent: string;
  score: number;
  connected: boolean;
  positiveStreak: number;
  coldStreak: number;
  onFire: boolean;
  isCold: boolean;
  buzzEligible: boolean;
  hasBuzzedThisQuestion: boolean;
  finalWager: number | null;
  finalWagerSubmitted: boolean;
  finalAnswer: string | null;
  finalAnswerSubmitted: boolean;
  finalResolved: boolean;
  stats: PlayerStats;
}

export interface BoardQuestionResult {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  correct: boolean;
  delta: number;
  /** Optional persisted labels for scoring rules that affected this player's result. */
  modifiers?: string[];
}

export interface BoardQuestion {
  questionId: string;
  category: string;
  value: QuestionValue;
  used: boolean;
  dailyDouble: boolean;
  /** Player whose turn selected this clue. Used for exact comeback warmup accounting. */
  turnPlayerId?: string | null;
  /** Actual point value when this tile was played, including late modifiers or DD wager. */
  playedValue?: number;
  /** Optional persisted labels for board-wide scoring rules used on this clue. */
  modifiers?: string[];
  /** Public scoring result stored with the authoritative room so presentation/recovery stay consistent. */
  results?: BoardQuestionResult[];
}

export interface BoardState {
  categories: string[];
  questions: BoardQuestion[];
}

export interface TimerState {
  running: boolean;
  durationMs: number | null;
  endsAt: number | null;
  remainingMs: number | null;
}

export interface TextResponseState {
  answer: string;
  submittedAt: number;
  autoCorrect: boolean;
  autoConfidence: AutoGradeConfidence;
  resolvedCorrect: boolean | null;
}

export interface CurrentQuestionState {
  questionId: string;
  text: string;
  category: string;
  baseValue: number;
  effectiveValue: number;
  explanation?: string;
  answerRevealed: boolean;
  acceptedAnswers?: string[];
  responseMode?: ResponseMode;
  textResponses?: Record<string, TextResponseState>;
  responsesClosed?: boolean;
  dailyDouble: boolean;
  dailyDoublePlayerId: string | null;
  /** Player whose turn selected this question. */
  turnPlayerId: string | null;
  /** Players eligible to answer this question. Late joins wait until the next clue. */
  participantIds?: string[];
  /** True when the answer window expired with no response and the turn owner was penalized. */
  timedOut?: boolean;
  /** Spoken response already judged for the current buzz/answer attempt. Guards retries and double-clicks. */
  resolvedPlayerId?: string | null;
  wager: number | null;
  buzzOpen: boolean;
  buzzWinnerId: string | null;
  buzzOpenedAt: number | null;
  attemptedPlayerIds: string[];
}

export interface FinalRoundState {
  category: string;
  question: string;
  acceptedAnswers: string[];
  explanation?: string;
  /** Index within participantIds. Kept for progress display and persisted-state compatibility. */
  reviewPlayerIndex: number;
  /** Stable identity for the player currently under Final review. */
  reviewPlayerId?: string | null;
  participantIds: string[];
  /** Players who were in the game when Final began. Late joins spectate until the next game. */
  rosterIds?: string[];
  responsesClosed: boolean;
}

export interface RoomState {
  code: string;
  phase: GamePhase;
  previousPhase: GamePhase | null;
  createdAt: number;
  expiresAt: number;
  /** Monotonic authoritative-state revision used to choose the newer recovery snapshot. */
  revision?: number;
  hostConnected: boolean;
  locked: boolean;
  players: Player[];
  settings: GameSettings;
  board: BoardState | null;
  currentQuestion: CurrentQuestionState | null;
  timer: TimerState;
  multiplier: 1 | 2 | 3;
  /** Player currently entitled to choose the next question. */
  turnPlayerId: string | null;
  remainingQuestions: number;
  selectedPackIds: string[];
  finalRound: FinalRoundState | null;
  /** Frozen scoreboard roster used once a game reaches recap. */
  resultPlayerIds?: string[];
  gameStartedAt: number | null;
  gameEndedAt: number | null;
}

export interface RoomSnapshot extends RoomState {
  serverNow: number;
}

export interface HostRoomCredentials {
  roomCode: string;
  hostToken: string;
  joinUrl: string;
  presentationUrl: string;
}

export interface PlayerJoinCredentials {
  playerId: string;
  reconnectToken: string;
  roomCode: string;
}

export interface PackSummary {
  id: string;
  title: string;
  theme: string;
  description: string;
  questionCount: number;
  difficulty: Difficulty;
  approximateMinutes: number;
  supportedGameModes: GameMode[];
  accentColor?: string;
  titleArt?: string;
}
