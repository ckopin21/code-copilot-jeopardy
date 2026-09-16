import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/config';
import type { Player, RoomSnapshot } from '../src/shared/types';
import { sanitizeRoomSnapshot } from '../src/lib/snapshotSecurity';

function player(id: string, name: string): Player {
  return {
    id,
    name,
    avatar: '🚀',
    accent: '#93c5fd',
    score: 500,
    connected: true,
    positiveStreak: 0,
    coldStreak: 0,
    onFire: false,
    isCold: false,
    buzzEligible: false,
    hasBuzzedThisQuestion: false,
    finalWager: 100,
    finalWagerSubmitted: true,
    finalAnswer: `${name} secret`,
    finalAnswerSubmitted: true,
    finalResolved: false,
    stats: { correct: 0, incorrect: 0, longestStreak: 0, longestColdStreak: 0, dailyDoublesFound: 0, biggestWager: 100, fastestBuzzMs: null, pointsGained: 0, pointsLost: 0 }
  };
}

function snapshot(): RoomSnapshot {
  return {
    code: 'ABCDE',
    phase: 'final-question',
    previousPhase: null,
    createdAt: 1,
    expiresAt: Date.now() + 60_000,
    hostConnected: true,
    locked: false,
    players: [player('one', 'One'), player('two', 'Two')],
    settings: { ...DEFAULT_SETTINGS },
    board: null,
    currentQuestion: null,
    timer: { running: false, durationMs: null, endsAt: null, remainingMs: null },
    multiplier: 1,
    remainingQuestions: 0,
    selectedPackIds: ['disney'],
    finalRound: {
      category: 'Final',
      question: 'Question?',
      acceptedAnswers: ['Correct'],
      explanation: 'Secret explanation',
      reviewPlayerIndex: 0,
      participantIds: ['one', 'two'],
      responsesClosed: true
    },
    gameStartedAt: 1,
    gameEndedAt: null,
    serverNow: Date.now()
  };
}

describe('sanitizeRoomSnapshot', () => {
  it('keeps other Final answers and wagers private before review', () => {
    const state = snapshot();
    const forPlayer = sanitizeRoomSnapshot(state, 'player', 'one');

    expect(forPlayer.players[0].finalAnswer).toBe('One secret');
    expect(forPlayer.players[0].finalWager).toBe(100);
    expect(forPlayer.players[1].finalAnswer).toBeNull();
    expect(forPlayer.players[1].finalWager).toBeNull();
    expect(forPlayer.finalRound?.acceptedAnswers).toEqual([]);
    expect(forPlayer.finalRound?.explanation).toBeUndefined();
  });

  it('reveals only the current and already resolved Final players during review', () => {
    const state = snapshot();
    state.phase = 'final-review';
    state.finalRound!.reviewPlayerIndex = 1;
    state.players[0].finalResolved = true;

    const presentation = sanitizeRoomSnapshot(state, 'presentation');
    expect(presentation.players[0].finalAnswer).toBe('One secret');
    expect(presentation.players[1].finalAnswer).toBe('Two secret');

    state.players[0].finalResolved = false;
    const currentOnly = sanitizeRoomSnapshot(state, 'presentation');
    expect(currentOnly.players[0].finalAnswer).toBeNull();
    expect(currentOnly.players[1].finalAnswer).toBe('Two secret');
  });

  it('hides answers, explanations, autogrades, and other typed responses before reveal', () => {
    const state = snapshot();
    state.phase = 'question';
    state.finalRound = null;
    state.currentQuestion = {
      questionId: 'q1',
      text: 'Question?',
      category: 'Category',
      baseValue: 100,
      effectiveValue: 100,
      explanation: 'Answer reasoning',
      answerRevealed: false,
      acceptedAnswers: ['Correct'],
      responseMode: 'text',
      textResponses: {
        one: { answer: 'Mine', submittedAt: 1, autoCorrect: true, autoConfidence: 'high', resolvedCorrect: null },
        two: { answer: 'Theirs', submittedAt: 2, autoCorrect: true, autoConfidence: 'high', resolvedCorrect: null }
      },
      responsesClosed: false,
      dailyDouble: false,
      dailyDoublePlayerId: null,
      wager: null,
      buzzOpen: false,
      buzzWinnerId: null,
      buzzOpenedAt: null,
      attemptedPlayerIds: []
    };

    const forPlayer = sanitizeRoomSnapshot(state, 'player', 'one');
    expect(forPlayer.currentQuestion?.acceptedAnswers).toBeUndefined();
    expect(forPlayer.currentQuestion?.explanation).toBeUndefined();
    expect(forPlayer.currentQuestion?.textResponses?.one.answer).toBe('Mine');
    expect(forPlayer.currentQuestion?.textResponses?.one.autoCorrect).toBe(false);
    expect(forPlayer.currentQuestion?.textResponses?.two.answer).toBe('');

    const forHost = sanitizeRoomSnapshot(state, 'host');
    expect(forHost.currentQuestion?.textResponses?.one.answer).toBe('');
    expect(forHost.currentQuestion?.textResponses?.one.autoCorrect).toBe(false);
  });

  it('hides the Daily Double clue text until the wager is locked', () => {
    const state = snapshot();
    state.phase = 'daily-double-wager';
    state.finalRound = null;
    state.currentQuestion = {
      questionId: 'dd',
      text: 'Secret clue',
      category: 'Category',
      baseValue: 500,
      effectiveValue: 500,
      answerRevealed: false,
      acceptedAnswers: ['Answer'],
      responseMode: 'buzz',
      textResponses: {},
      responsesClosed: false,
      dailyDouble: true,
      dailyDoublePlayerId: 'one',
      wager: null,
      buzzOpen: false,
      buzzWinnerId: null,
      buzzOpenedAt: null,
      attemptedPlayerIds: []
    };

    expect(sanitizeRoomSnapshot(state, 'host').currentQuestion?.text).toBe('');
    expect(sanitizeRoomSnapshot(state, 'player', 'one').currentQuestion?.text).toBe('');
  });
});
