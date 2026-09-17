import { beforeEach, describe, expect, it } from 'vitest';
import { BrowserGameEngine, type RandomSource } from '../src/lib/browserGameEngine';
import '../src/lib/turnHistoryPolicy';
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
  private value = 0.173;
  next(): number { this.value = (this.value * 5.91 + 0.23) % 1; return this.value; }
}

function completeCorrectTurn(engine: BrowserGameEngine, roomCode: string, hostToken: string, playerId: string) {
  engine.setTurnPlayer(roomCode, hostToken, playerId);
  const tile = engine.snapshot(roomCode).board!.questions.find((question) => !question.used && question.value === 100)!;
  engine.selectQuestion(roomCode, hostToken, tile.questionId);
  engine.openBuzzers(roomCode, hostToken);
  engine.localBuzz(roomCode, hostToken, playerId);
  engine.revealAnswer(roomCode, hostToken);
  engine.resolveAnswer(roomCode, hostToken, playerId, true);
  engine.advanceToBoard(roomCode, hostToken);
}

function setup() {
  const engine = new BrowserGameEngine(new FixedRandom(), 60_000);
  const host = engine.createRoom('https://example.test/game', {
    randomizeCategories: false,
    dailyDoublesEnabled: false,
    finalRoundEnabled: false,
    lateGameModifiers: false,
    allowNegativeScores: true
  });
  const leader = engine.joinPlayer(host.roomCode, { name: 'Leader', avatar: '⭐', accent: '#ffd166' });
  const chaser = engine.joinPlayer(host.roomCode, { name: 'Chaser', avatar: '🚀', accent: '#93c5fd' });
  engine.startGame(host.roomCode, host.hostToken);

  for (let round = 0; round < 2; round += 1) {
    completeCorrectTurn(engine, host.roomCode, host.hostToken, leader.playerId);
    completeCorrectTurn(engine, host.roomCode, host.hostToken, chaser.playerId);
  }

  engine.adjustScore(host.roomCode, host.hostToken, leader.playerId, 1000);
  engine.setTurnPlayer(host.roomCode, host.hostToken, chaser.playerId);
  const tile = engine.snapshot(host.roomCode).board!.questions.find((question) => !question.used && question.value === 100)!;
  engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
  return { engine, host, leader, chaser };
}

function remainingTriple(engine: BrowserGameEngine, roomCode: string, chaserId: string) {
  const state = engine.snapshot(roomCode);
  const chaser = state.players.find((player) => player.id === chaserId)!;
  state.phase = 'board';
  state.currentQuestion = null;
  state.turnPlayerId = chaser.id;
  return calculateComebackAward(state, chaser, 100).tripleUsesRemaining;
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

describe('comeback boost consumption', () => {
  it('does not spend the turn owner boost when another player buzzes and answers correctly', () => {
    const { engine, host, leader, chaser } = setup();
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, leader.playerId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, leader.playerId, true);

    expect(remainingTriple(engine, host.roomCode, chaser.playerId)).toBe(1);
  });

  it('does not spend the boost when the eligible player answers incorrectly', () => {
    const { engine, host, chaser } = setup();
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, chaser.playerId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, chaser.playerId, false);

    expect(remainingTriple(engine, host.roomCode, chaser.playerId)).toBe(1);
  });

  it('does not spend the boost when nobody answers', () => {
    const { engine, host, chaser } = setup();
    engine.revealAnswer(host.roomCode, host.hostToken);

    expect(remainingTriple(engine, host.roomCode, chaser.playerId)).toBe(1);
  });

  it('spends the boost only after the eligible player is actually awarded boosted points', () => {
    const { engine, host, chaser } = setup();
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, chaser.playerId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, chaser.playerId, true);

    expect(remainingTriple(engine, host.roomCode, chaser.playerId)).toBe(0);
  });
});
