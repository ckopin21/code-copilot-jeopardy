import { beforeEach, describe, expect, it } from 'vitest';
import { BrowserGameEngine, type RandomSource } from '../src/lib/browserGameEngine';
import { calculateComebackAward, comebackBoostsUnlocked } from '../src/lib/comebackScoring';
import type { RoomSnapshot } from '../src/shared/types';

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
    streaksEnabled: true,
    allowNegativeScores: true
  });
  const leader = engine.joinPlayer(host.roomCode, { name: 'Leader', avatar: '⭐', accent: '#ffd166' });
  const chaser = engine.joinPlayer(host.roomCode, { name: 'Chaser', avatar: '🚀', accent: '#93c5fd' });
  engine.startGame(host.roomCode, host.hostToken);
  return { engine, host, leader, chaser };
}

function selectValue(engine: BrowserGameEngine, roomCode: string, hostToken: string, playerId: string, value: number) {
  engine.setTurnPlayer(roomCode, hostToken, playerId);
  const tile = engine.snapshot(roomCode).board!.questions.find((question) => !question.used && question.value === value)!;
  return engine.selectQuestion(roomCode, hostToken, tile.questionId);
}

function completeCorrectTurn(engine: BrowserGameEngine, roomCode: string, hostToken: string, playerId: string) {
  selectValue(engine, roomCode, hostToken, playerId, 100);
  engine.openBuzzers(roomCode, hostToken);
  engine.localBuzz(roomCode, hostToken, playerId);
  engine.revealAnswer(roomCode, hostToken);
  engine.resolveAnswer(roomCode, hostToken, playerId, true);
  engine.advanceToBoard(roomCode, hostToken);
}

function unlockComebacks(engine: BrowserGameEngine, roomCode: string, hostToken: string, playerIds: string[]) {
  for (let round = 0; round < 2; round += 1) {
    for (const playerId of playerIds) completeCorrectTurn(engine, roomCode, hostToken, playerId);
  }
}

function unlockStateComebacks(state: RoomSnapshot) {
  const tiles = state.board!.questions.filter((tile) => !tile.used).slice(0, state.players.length * 2);
  let index = 0;
  for (const player of state.players) {
    for (let turn = 0; turn < 2; turn += 1) {
      const tile = tiles[index++];
      tile.used = true;
      tile.turnPlayerId = player.id;
      tile.playedValue = tile.value;
      tile.results = [];
    }
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

describe('limited comeback scoring', () => {
  it('stays disabled until every active player has individually completed two turns', () => {
    const { engine, host, leader, chaser } = setup();
    engine.adjustScore(host.roomCode, host.hostToken, leader.playerId, 1000);
    const state = selectValue(engine, host.roomCode, host.hostToken, chaser.playerId, 100);
    const chaserState = state.players.find((player) => player.id === chaser.playerId)!;

    expect(comebackBoostsUnlocked(state)).toBe(false);
    expect(calculateComebackAward(state, chaserState, 100).multiplier).toBe(1);
  });

  it('does not unlock from total question count if one player has not had two turns', () => {
    const { engine, host, leader, chaser } = setup();
    const state = engine.snapshot(host.roomCode);
    const tiles = state.board!.questions.slice(0, 4);
    const ownership = [leader.playerId, leader.playerId, leader.playerId, chaser.playerId];
    tiles.forEach((tile, index) => {
      tile.used = true;
      tile.turnPlayerId = ownership[index];
      tile.playedValue = tile.value;
      tile.results = [];
    });

    expect(comebackBoostsUnlocked(state)).toBe(false);
  });

  it('gives the sole last-place turn owner 3x when trailing by at least 4x the board reference', () => {
    const { engine, host, leader, chaser } = setup();
    unlockComebacks(engine, host.roomCode, host.hostToken, [leader.playerId, chaser.playerId]);
    engine.adjustScore(host.roomCode, host.hostToken, leader.playerId, 2000);
    const before = engine.snapshot(host.roomCode).players.find((player) => player.id === chaser.playerId)!;
    selectValue(engine, host.roomCode, host.hostToken, chaser.playerId, 100);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, chaser.playerId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    const resolved = engine.resolveAnswer(host.roomCode, host.hostToken, chaser.playerId, true);
    const after = resolved.players.find((player) => player.id === chaser.playerId)!;

    expect(after.score - before.score).toBe(300);
    expect(after.stats.pointsGained - before.stats.pointsGained).toBe(300);
  });

  it('gives the sole last-place turn owner 2x when trailing by at least 2x but less than 4x the board reference', () => {
    const { engine, host, leader, chaser } = setup();
    unlockComebacks(engine, host.roomCode, host.hostToken, [leader.playerId, chaser.playerId]);
    engine.adjustScore(host.roomCode, host.hostToken, leader.playerId, 1000);
    const beforeScore = engine.snapshot(host.roomCode).players.find((player) => player.id === chaser.playerId)!.score;
    selectValue(engine, host.roomCode, host.hostToken, chaser.playerId, 100);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, chaser.playerId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    const resolved = engine.resolveAnswer(host.roomCode, host.hostToken, chaser.playerId, true);

    expect(resolved.players.find((player) => player.id === chaser.playerId)!.score - beforeScore).toBe(200);
  });

  it('uses the same comeback tier for every clue value on the board', () => {
    const { engine, leader, chaser, host } = setup();
    const state = engine.snapshot(host.roomCode);
    unlockStateComebacks(state);
    const leaderState = state.players.find((player) => player.id === leader.playerId)!;
    const chaserState = state.players.find((player) => player.id === chaser.playerId)!;
    leaderState.score = 1000;
    chaserState.score = 0;
    state.turnPlayerId = chaserState.id;
    state.phase = 'board';

    expect(calculateComebackAward(state, chaserState, 100).multiplier).toBe(2);
    expect(calculateComebackAward(state, chaserState, 500).multiplier).toBe(2);
    expect(calculateComebackAward(state, chaserState, 500).points).toBe(1000);
  });

  it('stacks comeback scoring on top of an already-modified effective clue value', () => {
    const { engine, leader, chaser, host } = setup();
    const state = engine.snapshot(host.roomCode);
    unlockStateComebacks(state);
    const leaderState = state.players.find((player) => player.id === leader.playerId)!;
    const chaserState = state.players.find((player) => player.id === chaser.playerId)!;
    leaderState.score = 1000;
    chaserState.score = 0;
    state.turnPlayerId = chaserState.id;
    state.phase = 'board';

    const award = calculateComebackAward(state, chaserState, 1000);
    expect(award.multiplier).toBe(2);
    expect(award.points).toBe(2000);
  });

  it('does not activate when multiple players are tied for last place', () => {
    const engine = new BrowserGameEngine(new FixedRandom(), 60_000);
    const host = engine.createRoom('https://example.test/game', { randomizeCategories: false, dailyDoublesEnabled: false, finalRoundEnabled: false, lateGameModifiers: false });
    const leader = engine.joinPlayer(host.roomCode, { name: 'Leader', avatar: '⭐', accent: '#ffd166' });
    const chaser = engine.joinPlayer(host.roomCode, { name: 'Chaser', avatar: '🚀', accent: '#93c5fd' });
    const tied = engine.joinPlayer(host.roomCode, { name: 'Tied', avatar: '🎮', accent: '#f9a8d4' });
    engine.startGame(host.roomCode, host.hostToken);
    const state = engine.snapshot(host.roomCode);
    unlockStateComebacks(state);
    state.players.find((player) => player.id === leader.playerId)!.score = 1000;
    state.players.find((player) => player.id === chaser.playerId)!.score = 0;
    state.players.find((player) => player.id === tied.playerId)!.score = 0;
    state.turnPlayerId = chaser.playerId;
    state.phase = 'board';

    const award = calculateComebackAward(state, state.players.find((player) => player.id === chaser.playerId)!, 100);
    expect(award.multiplier).toBe(1);
  });

  it('charges only the normal value when the boosted player answers incorrectly', () => {
    const { engine, host, leader, chaser } = setup();
    unlockComebacks(engine, host.roomCode, host.hostToken, [leader.playerId, chaser.playerId]);
    engine.adjustScore(host.roomCode, host.hostToken, leader.playerId, 1000);
    const beforeScore = engine.snapshot(host.roomCode).players.find((player) => player.id === chaser.playerId)!.score;
    selectValue(engine, host.roomCode, host.hostToken, chaser.playerId, 100);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, chaser.playerId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    const resolved = engine.resolveAnswer(host.roomCode, host.hostToken, chaser.playerId, false);

    expect(resolved.players.find((player) => player.id === chaser.playerId)!.score - beforeScore).toBe(-100);
  });

  it('charges only the normal value when the boosted turn owner does not answer', () => {
    const { engine, host, leader, chaser } = setup();
    unlockComebacks(engine, host.roomCode, host.hostToken, [leader.playerId, chaser.playerId]);
    engine.adjustScore(host.roomCode, host.hostToken, leader.playerId, 1000);
    const beforeScore = engine.snapshot(host.roomCode).players.find((player) => player.id === chaser.playerId)!.score;
    selectValue(engine, host.roomCode, host.hostToken, chaser.playerId, 100);
    const revealed = engine.revealAnswer(host.roomCode, host.hostToken);

    expect(revealed.players.find((player) => player.id === chaser.playerId)!.score - beforeScore).toBe(-100);
  });

  it('awards a different player only the normal amount on the boosted player’s turn', () => {
    const { engine, host, leader, chaser } = setup();
    unlockComebacks(engine, host.roomCode, host.hostToken, [leader.playerId, chaser.playerId]);
    engine.adjustScore(host.roomCode, host.hostToken, leader.playerId, 1000);
    const before = engine.snapshot(host.roomCode);
    const beforeLeader = before.players.find((player) => player.id === leader.playerId)!.score;
    const beforeChaser = before.players.find((player) => player.id === chaser.playerId)!.score;
    selectValue(engine, host.roomCode, host.hostToken, chaser.playerId, 100);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, leader.playerId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    const resolved = engine.resolveAnswer(host.roomCode, host.hostToken, leader.playerId, true);

    expect(resolved.players.find((player) => player.id === leader.playerId)!.score - beforeLeader).toBe(100);
    expect(resolved.players.find((player) => player.id === chaser.playerId)!.score).toBe(beforeChaser);
  });

  it('limits each player to two successful 2x boosts and one successful 3x boost', () => {
    const { engine, leader, chaser, host } = setup();
    const state = engine.snapshot(host.roomCode);
    unlockStateComebacks(state);
    const leaderState = state.players.find((player) => player.id === leader.playerId)!;
    const chaserState = state.players.find((player) => player.id === chaser.playerId)!;
    leaderState.score = 3000;
    chaserState.score = 0;
    state.turnPlayerId = chaserState.id;
    state.phase = 'board';

    const available = state.board!.questions.filter((question) => !question.used);
    const tile100 = available.find((question) => question.value === 100)!;
    const tile200 = available.find((question) => question.value === 200)!;
    const tile300 = available.find((question) => question.value === 300)!;
    tile100.used = true;
    tile100.playedValue = 100;
    tile100.results = [{ playerId: chaserState.id, playerName: chaserState.name, playerAvatar: chaserState.avatar, correct: true, delta: 300 }];
    tile200.used = true;
    tile200.playedValue = 200;
    tile200.results = [{ playerId: chaserState.id, playerName: chaserState.name, playerAvatar: chaserState.avatar, correct: true, delta: 400 }];
    tile300.used = true;
    tile300.playedValue = 300;
    tile300.results = [{ playerId: chaserState.id, playerName: chaserState.name, playerAvatar: chaserState.avatar, correct: true, delta: 600 }];

    const afterAllThree = calculateComebackAward(state, chaserState, 100);
    expect(afterAllThree.tripleUsesRemaining).toBe(0);
    expect(afterAllThree.doubleUsesRemaining).toBe(0);
    expect(afterAllThree.multiplier).toBe(1);
    expect(afterAllThree.points).toBe(100);
  });

  it('does not let streak length add another scoring multiplier', () => {
    const { engine, leader, chaser, host } = setup();
    const state = engine.snapshot(host.roomCode);
    unlockStateComebacks(state);
    const leaderState = state.players.find((player) => player.id === leader.playerId)!;
    const chaserState = state.players.find((player) => player.id === chaser.playerId)!;
    leaderState.score = 1000;
    chaserState.score = 0;
    chaserState.positiveStreak = 5;
    state.turnPlayerId = chaserState.id;
    state.phase = 'board';

    const award = calculateComebackAward(state, chaserState, 100);
    expect(award.multiplier).toBe(2);
    expect(award.points).toBe(200);
    expect(award.streakRate).toBe(0);
  });

  it('undo restores the entire boosted ruling, including score, stats and streak', () => {
    const { engine, host, leader, chaser } = setup();
    unlockComebacks(engine, host.roomCode, host.hostToken, [leader.playerId, chaser.playerId]);
    engine.adjustScore(host.roomCode, host.hostToken, leader.playerId, 1000);
    const before = engine.snapshot(host.roomCode).players.find((player) => player.id === chaser.playerId)!;
    selectValue(engine, host.roomCode, host.hostToken, chaser.playerId, 100);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, chaser.playerId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, chaser.playerId, true);

    const restored = engine.undoLastScoreAction(host.roomCode, host.hostToken);
    const restoredChaser = restored.players.find((player) => player.id === chaser.playerId)!;
    expect(restoredChaser.score).toBe(before.score);
    expect(restoredChaser.stats.correct).toBe(before.stats.correct);
    expect(restoredChaser.stats.pointsGained).toBe(before.stats.pointsGained);
    expect(restoredChaser.positiveStreak).toBe(before.positiveStreak);
  });

  it('does not apply comeback boosts to Daily Double wagers', () => {
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
