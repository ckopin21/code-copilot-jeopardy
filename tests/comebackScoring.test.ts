import { beforeEach, describe, expect, it } from 'vitest';
import { BrowserGameEngine, type RandomSource } from '../src/lib/browserGameEngine';
import { calculateComebackAward } from '../src/lib/comebackScoring';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

class FixedRandom implements RandomSource {
  private value = 0.113;
  next(): number { this.value = (this.value * 7.13 + 0.19) % 1; return this.value; }
}

function setup() {
  const engine = new BrowserGameEngine(new FixedRandom(), 60_000);
  const host = engine.createRoom('https://example.test/game', {
    randomizeCategories: false,
    dailyDoublesEnabled: false,
    finalRoundEnabled: false,
    lateGameModifiers: false,
    streaksEnabled: true
  });
  const leader = engine.joinPlayer(host.roomCode, { name: 'Leader', avatar: '⭐', accent: '#ffd166' });
  const chaser = engine.joinPlayer(host.roomCode, { name: 'Chaser', avatar: '🚀', accent: '#93c5fd' });
  engine.startGame(host.roomCode, host.hostToken);
  return { engine, host, leader, chaser };
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

describe('comeback scoring', () => {
  it('gives a large underdog a 50% boost on an ordinary correct answer', () => {
    const { engine, host, leader, chaser } = setup();
    engine.adjustScore(host.roomCode, host.hostToken, leader.playerId, 1000);

    const tile = engine.snapshot(host.roomCode).board!.questions.find((question) => question.value === 100)!;
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, chaser.playerId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    const resolved = engine.resolveAnswer(host.roomCode, host.hostToken, chaser.playerId, true);

    expect(resolved.players.find((player) => player.id === chaser.playerId)?.score).toBe(150);
    expect(resolved.players.find((player) => player.id === chaser.playerId)?.stats.pointsGained).toBe(150);
  });

  it('stacks earned comeback momentum with the underdog boost but caps the total bonus at 100%', () => {
    const { engine, leader, chaser, host } = setup();
    const state = engine.snapshot(host.roomCode);
    const leaderState = state.players.find((player) => player.id === leader.playerId)!;
    const chaserState = state.players.find((player) => player.id === chaser.playerId)!;
    leaderState.score = 1000;
    chaserState.score = 0;
    chaserState.positiveStreak = 2;

    const award = calculateComebackAward(state, chaserState, 100);
    expect(award.underdogRate).toBe(0.5);
    expect(award.streakRate).toBe(0.5);
    expect(award.bonus).toBe(100);
    expect(award.points).toBe(200);
  });

  it('never lets bonus points be the reason a trailing player passes first place', () => {
    const { engine, leader, chaser, host } = setup();
    const state = engine.snapshot(host.roomCode);
    const leaderState = state.players.find((player) => player.id === leader.playerId)!;
    const chaserState = state.players.find((player) => player.id === chaser.playerId)!;
    leaderState.score = 1000;
    chaserState.score = 850;
    chaserState.positiveStreak = 4;

    const award = calculateComebackAward(state, chaserState, 200);
    expect(award.streakRate).toBe(0.5);
    expect(award.bonus).toBe(0);
    expect(award.points).toBe(200);
  });

  it('undo restores the entire boosted ruling, including score, stats and streak', () => {
    const { engine, host, leader, chaser } = setup();
    engine.adjustScore(host.roomCode, host.hostToken, leader.playerId, 1000);
    const tile = engine.snapshot(host.roomCode).board!.questions.find((question) => question.value === 100)!;
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, chaser.playerId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, chaser.playerId, true);

    const restored = engine.undoLastScoreAction(host.roomCode, host.hostToken);
    const restoredChaser = restored.players.find((player) => player.id === chaser.playerId)!;
    expect(restoredChaser.score).toBe(0);
    expect(restoredChaser.stats.correct).toBe(0);
    expect(restoredChaser.stats.pointsGained).toBe(0);
    expect(restoredChaser.positiveStreak).toBe(0);
  });

  it('does not apply comeback bonuses to Daily Double wagers', () => {
    const engine = new BrowserGameEngine(new FixedRandom(), 60_000);
    const host = engine.createRoom('https://example.test/game', {
      gameLength: 'quick', randomizeCategories: false, dailyDoublesEnabled: true, dailyDoubleCount: 16,
      finalRoundEnabled: false, lateGameModifiers: false, streaksEnabled: true
    });
    const leader = engine.joinPlayer(host.roomCode, { name: 'Leader', avatar: '⭐', accent: '#ffd166' });
    const chaser = engine.joinPlayer(host.roomCode, { name: 'Chaser', avatar: '🚀', accent: '#93c5fd' });
    engine.startGame(host.roomCode, host.hostToken);
    engine.adjustScore(host.roomCode, host.hostToken, leader.playerId, 1000);
    const daily = engine.snapshot(host.roomCode).board!.questions.find((question) => question.dailyDouble)!;

    engine.selectQuestion(host.roomCode, host.hostToken, daily.questionId, chaser.playerId);
    engine.setDailyDoubleWager(host.roomCode, host.hostToken, 100);
    engine.revealAnswer(host.roomCode, host.hostToken);
    const resolved = engine.resolveAnswer(host.roomCode, host.hostToken, chaser.playerId, true);

    expect(resolved.players.find((player) => player.id === chaser.playerId)?.score).toBe(100);
  });
});
