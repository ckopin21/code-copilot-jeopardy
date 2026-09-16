import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { GameEngine, type RandomSource } from '../server/gameEngine';
import { PackRegistry } from '../server/packRegistry';
import { MemoryPersistence } from '../server/persistence';
import { answerMatches } from '../src/shared/validation';

class FixedRandom implements RandomSource {
  private value = 0.113;
  next(): number { this.value = (this.value * 7.13 + 0.19) % 1; return this.value; }
}

function setup(settings: Record<string, unknown> = {}) {
  const registry = new PackRegistry(path.join(os.tmpdir(), `packs-${crypto.randomUUID()}.json`));
  const engine = new GameEngine(registry, new FixedRandom(), new MemoryPersistence(), 60_000);
  const host = engine.createRoom('http://localhost:3000', settings);
  return { engine, host, registry };
}

function addPlayer(engine: GameEngine, roomCode: string, name = 'Alex') {
  return engine.joinPlayer(roomCode, { name, avatar: '🚀', accent: '#93c5fd' });
}

function firstNonDaily(engine: GameEngine, code: string) {
  return engine.snapshot(code).board!.questions.find((question) => !question.used && !question.dailyDouble)!;
}

describe('GameEngine rooms and players', () => {
  it('creates a room with a short code and join URL', () => {
    const { engine, host } = setup();
    expect(host.roomCode).toHaveLength(5);
    expect(host.joinUrl).toContain(host.roomCode);
    expect(engine.snapshot(host.roomCode).phase).toBe('lobby');
  });

  it('joins up to five players and rejects a sixth', () => {
    const { engine, host } = setup();
    for (let index = 0; index < 5; index += 1) addPlayer(engine, host.roomCode, `P${index}`);
    expect(engine.snapshot(host.roomCode).players).toHaveLength(5);
    expect(() => addPlayer(engine, host.roomCode, 'P6')).toThrow(/5 players/);
  });

  it('reconnects to the same stable player identity', () => {
    const { engine, host } = setup();
    const player = addPlayer(engine, host.roomCode);
    engine.setPlayerConnected(host.roomCode, player.playerId, false);
    const reconnected = engine.reconnectPlayer(host.roomCode, player.playerId, player.reconnectToken);
    expect(reconnected.playerId).toBe(player.playerId);
    expect(engine.snapshot(host.roomCode).players[0].connected).toBe(true);
  });

  it('disambiguates duplicate display names without using them as identity', () => {
    const { engine, host } = setup();
    addPlayer(engine, host.roomCode, 'Sam');
    addPlayer(engine, host.roomCode, 'Sam');
    expect(engine.snapshot(host.roomCode).players.map((player) => player.name)).toEqual(['Sam', 'Sam 2']);
  });
});

describe('board, buzzers, scoring, and modifiers', () => {
  it('loads a complete standard board and assigns requested Daily Doubles', () => {
    const { engine, host } = setup({ dailyDoubleCount: 3 });
    engine.startGame(host.roomCode, host.hostToken);
    const board = engine.snapshot(host.roomCode).board!;
    expect(board.questions).toHaveLength(30);
    expect(board.questions.filter((question) => question.dailyDouble)).toHaveLength(3);
  });

  it('first valid server buzz wins and locks later buzzes', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false });
    const one = addPlayer(engine, host.roomCode, 'One');
    const two = addPlayer(engine, host.roomCode, 'Two');
    engine.startGame(host.roomCode, host.hostToken);
    const tile = firstNonDaily(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    expect(engine.buzz(host.roomCode, one.playerId, one.reconnectToken).accepted).toBe(true);
    expect(engine.buzz(host.roomCode, two.playerId, two.reconnectToken).accepted).toBe(false);
  });

  it('awards and subtracts normal points', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, stealsEnabled: false });
    const player = addPlayer(engine, host.roomCode);
    engine.startGame(host.roomCode, host.hostToken);
    let tile = firstNonDaily(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.buzz(host.roomCode, player.playerId, player.reconnectToken);
    const value = engine.snapshot(host.roomCode).currentQuestion!.effectiveValue;
    engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, true);
    expect(engine.snapshot(host.roomCode).players[0].score).toBe(value);
    engine.advanceToBoard(host.roomCode, host.hostToken);
    tile = firstNonDaily(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.buzz(host.roomCode, player.playerId, player.reconnectToken);
    const second = engine.snapshot(host.roomCode).currentQuestion!.effectiveValue;
    engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, false);
    expect(engine.snapshot(host.roomCode).players[0].score).toBe(value - second);
  });

  it('reopens steals only for eligible players after a miss', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, stealsEnabled: true });
    const one = addPlayer(engine, host.roomCode, 'One');
    const two = addPlayer(engine, host.roomCode, 'Two');
    engine.startGame(host.roomCode, host.hostToken);
    const tile = firstNonDaily(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.buzz(host.roomCode, one.playerId, one.reconnectToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, one.playerId, false);
    const state = engine.snapshot(host.roomCode);
    expect(state.currentQuestion?.buzzOpen).toBe(true);
    expect(state.players.find((player) => player.id === one.playerId)?.buzzEligible).toBe(false);
    expect(state.players.find((player) => player.id === two.playerId)?.buzzEligible).toBe(true);
  });

  it('uses exact 6-4 double and 3-1 triple point windows', () => {
    const { engine } = setup();
    expect(engine.multiplierForRemaining(7)).toBe(1);
    expect(engine.multiplierForRemaining(6)).toBe(2);
    expect(engine.multiplierForRemaining(4)).toBe(2);
    expect(engine.multiplierForRemaining(3)).toBe(3);
    expect(engine.multiplierForRemaining(1)).toBe(3);
  });

  it('validates Daily Double wagers and scores them', () => {
    const { engine, host } = setup({ dailyDoubleCount: 6, maxWager: 1000, allowWagerBeyondScore: true });
    const player = addPlayer(engine, host.roomCode);
    engine.startGame(host.roomCode, host.hostToken);
    const daily = engine.snapshot(host.roomCode).board!.questions.find((question) => question.dailyDouble)!;
    engine.selectQuestion(host.roomCode, host.hostToken, daily.questionId, player.playerId);
    expect(() => engine.setDailyDoubleWager(host.roomCode, host.hostToken, 1200)).toThrow(/between 0 and 1000/);
    engine.setDailyDoubleWager(host.roomCode, host.hostToken, 500);
    engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, true);
    expect(engine.snapshot(host.roomCode).players[0].score).toBeGreaterThanOrEqual(500);
  });

  it('activates On Fire after three correct answers and resets after a miss', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, stealsEnabled: false });
    const player = addPlayer(engine, host.roomCode);
    engine.startGame(host.roomCode, host.hostToken);
    for (let index = 0; index < 3; index += 1) {
      const tile = firstNonDaily(engine, host.roomCode);
      engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
      engine.openBuzzers(host.roomCode, host.hostToken);
      engine.buzz(host.roomCode, player.playerId, player.reconnectToken);
      engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, true);
      engine.advanceToBoard(host.roomCode, host.hostToken);
    }
    expect(engine.snapshot(host.roomCode).players[0].onFire).toBe(true);
    const tile = firstNonDaily(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.buzz(host.roomCode, player.playerId, player.reconnectToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, false);
    expect(engine.snapshot(host.roomCode).players[0].onFire).toBe(false);
  });

  it('activates a cold streak after the configured miss threshold', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, stealsEnabled: false, coldStreakThreshold: 3 });
    const player = addPlayer(engine, host.roomCode);
    engine.startGame(host.roomCode, host.hostToken);
    for (let index = 0; index < 3; index += 1) {
      const tile = firstNonDaily(engine, host.roomCode);
      engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
      engine.openBuzzers(host.roomCode, host.hostToken);
      engine.buzz(host.roomCode, player.playerId, player.reconnectToken);
      engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, false);
      engine.advanceToBoard(host.roomCode, host.hostToken);
    }
    expect(engine.snapshot(host.roomCode).players[0].isCold).toBe(true);
  });
});

describe('Final Round and packs', () => {
  it('normalizes accepted answers', () => {
    expect(answerMatches('The Milky-Way!', ['Milky Way'])).toBe(true);
  });

  it('rejects invalid custom packs', () => {
    const { registry } = setup();
    expect(() => registry.import({ id: 'bad pack' })).toThrow();
  });

  it('ships three built-in packs with 60 questions each', () => {
    const { registry } = setup();
    expect(registry.list()).toHaveLength(3);
    expect(registry.list().every((pack) => pack.questionCount === 60)).toBe(true);
  });

  it('completes Final Round wagers, answers, and scoring', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, gameLength: 'quick', finalRoundEnabled: true });
    const player = addPlayer(engine, host.roomCode);
    engine.startGame(host.roomCode, host.hostToken);
    while (engine.snapshot(host.roomCode).phase === 'board') {
      const state = engine.snapshot(host.roomCode);
      const tile = state.board!.questions.find((question) => !question.used)!;
      engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
      engine.openBuzzers(host.roomCode, host.hostToken);
      engine.buzz(host.roomCode, player.playerId, player.reconnectToken);
      engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, true);
      engine.advanceToBoard(host.roomCode, host.hostToken);
    }
    expect(engine.snapshot(host.roomCode).phase).toBe('final-category');
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    engine.submitFinalWager(host.roomCode, player.playerId, player.reconnectToken, 100);
    engine.openFinalQuestion(host.roomCode, host.hostToken);
    const final = engine.snapshot(host.roomCode).finalRound!;
    engine.submitFinalAnswer(host.roomCode, player.playerId, player.reconnectToken, final.acceptedAnswers[0]);
    engine.beginFinalReview(host.roomCode, host.hostToken);
    const before = engine.snapshot(host.roomCode).players[0].score;
    engine.resolveFinalAnswer(host.roomCode, host.hostToken, player.playerId);
    const after = engine.snapshot(host.roomCode);
    expect(after.phase).toBe('recap');
    expect(after.players[0].score).toBe(before + 100);
  });
});
