import { DEFAULT_SETTINGS } from '../shared/config';
import type { BoardQuestion, Player, QuestionValue, RoomSnapshot } from '../shared/types';
import { calculateComebackAward } from './comebackScoring';
import { finalWagerRules } from './finalWagerRules';

export type DevPlayerCount = 2 | 3 | 4 | 5;
export type DevLateMultiplier = 1 | 2 | 3;

export interface DevScenarioInput {
  playerCount: DevPlayerCount;
  scores: number[];
  selectedSeat: number;
  clueValue: QuestionValue;
  lateMultiplier: DevLateMultiplier;
  doubleBoostsSpent: 0 | 1 | 2;
  tripleBoostsSpent: 0 | 1;
}

export interface DevScenarioAnalysis {
  room: RoomSnapshot;
  player: Player;
  leaderScore: number;
  lastPlaceScore: number;
  deficit: number;
  isLastPlace: boolean;
  normalValue: number;
  correctValue: number;
  wrongValue: number;
  otherPlayerCorrectValue: number;
  comeback: ReturnType<typeof calculateComebackAward>;
  finalRules: ReturnType<typeof finalWagerRules>;
}

const DEV_AVATARS = ['🧪', '🚀', '⭐', '🎮', '🦊'];
const DEV_ACCENTS = ['#ffd166', '#5eead4', '#93c5fd', '#f9a8d4', '#c4b5fd'];

function stats() {
  return {
    correct: 0,
    incorrect: 0,
    longestStreak: 0,
    longestColdStreak: 0,
    dailyDoublesFound: 0,
    biggestWager: 0,
    fastestBuzzMs: null,
    pointsGained: 0,
    pointsLost: 0
  };
}

function playerForSeat(seat: number, score: number): Player {
  return {
    id: `dev-player-${seat}`,
    seat,
    name: `Test Player ${seat}`,
    avatar: DEV_AVATARS[seat - 1] ?? '🧪',
    accent: DEV_ACCENTS[seat - 1] ?? '#ffd166',
    score,
    connected: true,
    positiveStreak: 0,
    coldStreak: 0,
    onFire: false,
    isCold: false,
    buzzEligible: false,
    hasBuzzedThisQuestion: false,
    finalWager: null,
    finalWagerSubmitted: false,
    finalAnswer: null,
    finalAnswerSubmitted: false,
    finalResolved: false,
    stats: stats()
  };
}

function spentBoostQuestion(player: Player, index: number, multiplier: 2 | 3): BoardQuestion {
  const normalValue = 100;
  return {
    questionId: `dev-spent-${multiplier}-${index}`,
    category: 'DEV HISTORY',
    value: 100,
    used: true,
    dailyDouble: false,
    playedValue: normalValue,
    results: [{
      playerId: player.id,
      playerName: player.name,
      playerAvatar: player.avatar,
      correct: true,
      delta: normalValue * multiplier
    }]
  };
}

export function buildDevScenario(input: DevScenarioInput): RoomSnapshot {
  const count = Math.min(5, Math.max(2, input.playerCount)) as DevPlayerCount;
  const players = Array.from({ length: count }, (_, index) => playerForSeat(index + 1, Number(input.scores[index] ?? 0)));
  const selectedSeat = Math.min(count, Math.max(1, input.selectedSeat));
  const selected = players[selectedSeat - 1];
  const normalValue = input.clueValue * input.lateMultiplier;
  const history: BoardQuestion[] = [];

  for (let index = 0; index < input.doubleBoostsSpent; index += 1) history.push(spentBoostQuestion(selected, index, 2));
  for (let index = 0; index < input.tripleBoostsSpent; index += 1) history.push(spentBoostQuestion(selected, index, 3));

  history.push({
    questionId: 'dev-question',
    category: 'DEV QUESTION',
    value: input.clueValue,
    used: true,
    dailyDouble: false,
    playedValue: normalValue,
    results: []
  });

  return {
    code: 'DEV00',
    phase: 'question',
    previousPhase: 'board',
    createdAt: 0,
    expiresAt: Number.MAX_SAFE_INTEGER,
    revision: 1,
    hostConnected: true,
    locked: false,
    players,
    settings: { ...DEFAULT_SETTINGS },
    board: { categories: ['DEV QUESTION'], questions: history },
    currentQuestion: {
      questionId: 'dev-question',
      text: 'Developer test question',
      category: 'DEV QUESTION',
      baseValue: input.clueValue,
      effectiveValue: normalValue,
      answerRevealed: false,
      acceptedAnswers: ['Test answer'],
      responseMode: 'buzz',
      textResponses: {},
      responsesClosed: false,
      dailyDouble: false,
      dailyDoublePlayerId: null,
      turnPlayerId: selected.id,
      participantIds: players.map((player) => player.id),
      timedOut: false,
      resolvedPlayerId: null,
      wager: null,
      buzzOpen: true,
      buzzWinnerId: null,
      buzzOpenedAt: null,
      attemptedPlayerIds: []
    },
    timer: { running: false, durationMs: null, endsAt: null, remainingMs: null },
    multiplier: input.lateMultiplier,
    turnPlayerId: selected.id,
    remainingQuestions: 10,
    selectedPackIds: DEFAULT_SETTINGS.selectedPackIds,
    finalRound: null,
    resultPlayerIds: players.map((player) => player.id),
    gameStartedAt: 1,
    gameEndedAt: null,
    serverNow: Date.now()
  };
}

export function analyzeDevScenario(input: DevScenarioInput): DevScenarioAnalysis {
  const room = buildDevScenario(input);
  const player = room.players.find((candidate) => candidate.seat === Math.min(room.players.length, Math.max(1, input.selectedSeat)))!;
  const normalValue = room.currentQuestion!.effectiveValue;
  const comeback = calculateComebackAward(room, player, normalValue);
  const scores = room.players.map((candidate) => candidate.score);
  const leaderScore = Math.max(...scores);
  const lastPlaceScore = Math.min(...scores);
  return {
    room,
    player,
    leaderScore,
    lastPlaceScore,
    deficit: leaderScore - player.score,
    isLastPlace: player.score === lastPlaceScore && player.score < leaderScore,
    normalValue,
    correctValue: comeback.points,
    wrongValue: -normalValue,
    otherPlayerCorrectValue: normalValue,
    comeback,
    finalRules: finalWagerRules(room, player.id)
  };
}
