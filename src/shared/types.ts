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
export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';
export type ResponseMode = 'buzz' | 'text';
export type AutoGradeConfidence = 'high' | 'medium' | 'low';

export interface Question {
  id: string;
  packId: string;
  category: string;
  text: string;
  acceptedAnswers: string[];
  alternateAnswers?: string[];
  value: QuestionValue;
  difficulty: 'easy' | 'medium' | 'hard';
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
  questions: Question[];
}

export interface GameSettings {
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

export interface BoardQuestion {
  questionId: string;
  category: string;
  value: QuestionValue;
  used: boolean;
  dailyDouble: boolean;
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
  reviewPlayerIndex: number;
  participantIds: string[];
  responsesClosed: boolean;
}

export interface RoomState {
  code: string;
  phase: GamePhase;
  previousPhase: GamePhase | null;
  createdAt: number;
  expiresAt: number;
  hostConnected: boolean;
  locked: boolean;
  players: Player[];
  settings: GameSettings;
  board: BoardState | null;
  currentQuestion: CurrentQuestionState | null;
  timer: TimerState;
  multiplier: 1 | 2 | 3;
  remainingQuestions: number;
  selectedPackIds: string[];
  finalRound: FinalRoundState | null;
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
}
