import { beforeEach, describe, expect, it } from 'vitest';
import type { GameSettings } from '../src/shared/types';
import { BrowserGameEngine, type RandomSource } from '../src/lib/browserGameEngine';

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

function setup(settings: Partial<GameSettings> = {}) {
  const engine = new BrowserGameEngine(new FixedRandom(), 60_000);
  const host = engine.createRoom('https://example.test/game', { randomizeCategories: false, ...settings });
  return { engine, host };
}

function addPlayer(engine: BrowserGameEngine, roomCode: string, name = 'Alex') {
  return engine.joinPlayer(roomCode, { name, avatar: '🚀', accent: '#93c5fd' });
}

function firstUnused(engine: BrowserGameEngine, roomCode: string) {
  return engine.snapshot(roomCode).board!.questions.find((question) => !question.used)!;
}

function finishBoardWithoutScoring(engine: BrowserGameEngine, roomCode: string, hostToken: string): void {
  while (engine.snapshot(roomCode).phase === 'board') {
    const tile = firstUnused(engine, roomCode);
    engine.selectQuestion(roomCode, hostToken, tile.questionId);
    engine.revealAnswer(roomCode, hostToken);
    engine.advanceToBoard(roomCode, hostToken);
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

describe('BrowserGameEngine production state', () => {
  it('reconnects a reserved seat without changing player identity or seat', () => {
    const { engine, host } = setup();
    const player = addPlayer(engine, host.roomCode);
    const originalSeat = engine.snapshot(host.roomCode).players[0].seat;
    engine.setPlayerConnected(host.roomCode, player.playerId, false);
    expect(engine.snapshot(host.roomCode).players[0].connected).toBe(false);

    const reconnected = engine.reconnectPlayer(host.roomCode, player.playerId, player.reconnectToken);
    expect(reconnected.playerId).toBe(player.playerId);
    expect(engine.snapshot(host.roomCode).players[0].connected).toBe(true);
    expect(engine.snapshot(host.roomCode).players[0].seat).toBe(originalSeat);
  });

  it('reuses only a permanently freed seat and keeps other seat numbers stable', () => {
    const { engine, host } = setup();
    const one = addPlayer(engine, host.roomCode, 'One');
    const two = addPlayer(engine, host.roomCode, 'Two');
    const three = addPlayer(engine, host.roomCode, 'Three');
    expect(engine.snapshot(host.roomCode).players.map((player) => player.seat)).toEqual([1, 2, 3]);

    engine.removePlayer(host.roomCode, host.hostToken, two.playerId);
    const four = addPlayer(engine, host.roomCode, 'Four');
    const state = engine.snapshot(host.roomCode);
    expect(state.players.find((player) => player.id === one.playerId)?.seat).toBe(1);
    expect(state.players.find((player) => player.id === three.playerId)?.seat).toBe(3);
    expect(state.players.find((player) => player.id === four.playerId)?.seat).toBe(2);
    expect(state.players.map((player) => player.seat)).toEqual([1, 2, 3]);
  });

  it('reopens buzzers for remaining players when the current buzz winner is removed', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false });
    const one = addPlayer(engine, host.roomCode, 'One');
    const two = addPlayer(engine, host.roomCode, 'Two');
    engine.startGame(host.roomCode, host.hostToken);
    const tile = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, one.playerId);

    engine.removePlayer(host.roomCode, host.hostToken, one.playerId);
    const state = engine.snapshot(host.roomCode);
    expect(state.currentQuestion?.buzzWinnerId).toBeNull();
    expect(state.currentQuestion?.buzzOpen).toBe(true);
    expect(state.players.find((player) => player.id === two.playerId)?.buzzEligible).toBe(true);
    expect(() => engine.localBuzz(host.roomCode, host.hostToken, two.playerId)).not.toThrow();
  });

  it('prevents deleting the active Daily Double owner mid-question', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: true, dailyDoubleCount: 16 });
    const player = addPlayer(engine, host.roomCode, 'Daily');
    engine.startGame(host.roomCode, host.hostToken);
    const daily = engine.snapshot(host.roomCode).board!.questions.find((question) => question.dailyDouble)!;
    engine.selectQuestion(host.roomCode, host.hostToken, daily.questionId, player.playerId);
    expect(() => engine.removePlayer(host.roomCode, host.hostToken, player.playerId)).toThrow(/Daily Double/i);
    expect(engine.snapshot(host.roomCode).players.some((candidate) => candidate.id === player.playerId)).toBe(true);
  });

  it('renames a player without changing identity or seat', () => {
    const { engine, host } = setup();
    const player = addPlayer(engine, host.roomCode, 'Before');
    const seat = engine.snapshot(host.roomCode).players[0].seat;
    engine.renamePlayer(host.roomCode, host.hostToken, player.playerId, 'After');
    const renamed = engine.snapshot(host.roomCode).players[0];
    expect(renamed.id).toBe(player.playerId);
    expect(renamed.seat).toBe(seat);
    expect(renamed.name).toBe('After');
  });

  it('undoes the latest ruling including score, stats, streak and question state', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false });
    const credentials = addPlayer(engine, host.roomCode, 'Undo');
    engine.startGame(host.roomCode, host.hostToken);
    const tile = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, credentials.playerId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, credentials.playerId, true);
    engine.advanceToBoard(host.roomCode, host.hostToken);
    expect(engine.snapshot(host.roomCode).players[0].score).toBeGreaterThan(0);

    const restored = engine.undoLastScoreAction(host.roomCode, host.hostToken);
    expect(restored.phase).toBe('question');
    expect(restored.currentQuestion?.questionId).toBe(tile.questionId);
    expect(restored.currentQuestion?.answerRevealed).toBe(true);
    expect(restored.players[0].score).toBe(0);
    expect(restored.players[0].stats.correct).toBe(0);
    expect(restored.players[0].positiveStreak).toBe(0);
    expect(() => engine.undoLastScoreAction(host.roomCode, host.hostToken)).toThrow(/no scoring action/i);
  });


  it('falls back to the recovery snapshot when the primary room snapshot is corrupt', () => {
    const { engine, host } = setup();
    addPlayer(engine, host.roomCode, 'Recovery');
    engine.startGame(host.roomCode, host.hostToken);
    const expected = engine.snapshot(host.roomCode);
    engine.pause(host.roomCode, host.hostToken);
    localStorage.setItem('blue-stage-p2p-engine-v2', '{broken');
    const recovered = new BrowserGameEngine(new FixedRandom(), 60_000).snapshot(host.roomCode);
    expect(recovered.code).toBe(expected.code);
    expect(recovered.board?.questions.length).toBe(expected.board?.questions.length);
    expect(() => JSON.parse(localStorage.getItem('blue-stage-p2p-engine-v2-backup') ?? '')).not.toThrow();
  });

  it('restores an active timer instead of erasing it on host reload', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, timerSeconds: 30 });
    addPlayer(engine, host.roomCode);
    engine.startGame(host.roomCode, host.hostToken);
    const tile = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    const before = engine.snapshot(host.roomCode).timer;
    expect(before.running).toBe(true);
    expect(before.endsAt).not.toBeNull();

    const restored = new BrowserGameEngine(new FixedRandom(), 60_000);
    const after = restored.snapshot(host.roomCode).timer;
    expect(after.running).toBe(true);
    expect(after.endsAt).toBe(before.endsAt);
    expect(after.remainingMs).toBeGreaterThan(0);
  });

  it('turns an unowned Daily Double into a normal practice question', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: true, dailyDoubleCount: 16 });
    engine.startGame(host.roomCode, host.hostToken);
    const daily = engine.snapshot(host.roomCode).board!.questions.find((question) => question.dailyDouble)!;
    engine.selectQuestion(host.roomCode, host.hostToken, daily.questionId);
    const state = engine.snapshot(host.roomCode);

    expect(state.phase).toBe('question');
    expect(state.currentQuestion?.dailyDouble).toBe(false);
    expect(state.currentQuestion?.dailyDoublePlayerId).toBeNull();
  });

  it('snapshots only connected players into Final Round', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true });
    const one = addPlayer(engine, host.roomCode, 'One');
    const two = addPlayer(engine, host.roomCode, 'Two');
    engine.startGame(host.roomCode, host.hostToken);
    engine.setPlayerConnected(host.roomCode, two.playerId, false);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);

    const state = engine.snapshot(host.roomCode);
    expect(state.phase).toBe('final-category');
    expect(state.finalRound?.participantIds).toEqual([one.playerId]);
    expect(state.players.find((player) => player.id === two.playerId)?.finalResolved).toBe(true);
  });

  it('keeps Final review stable and late joins out of the frozen result roster', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true });
    const early = addPlayer(engine, host.roomCode, 'Early');
    const finalist = addPlayer(engine, host.roomCode, 'Finalist');
    engine.startGame(host.roomCode, host.hostToken);
    engine.removePlayer(host.roomCode, host.hostToken, early.playerId);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    engine.submitFinalWager(host.roomCode, finalist.playerId, finalist.reconnectToken, 0);
    engine.openFinalQuestion(host.roomCode, host.hostToken);
    engine.submitFinalAnswer(host.roomCode, finalist.playerId, finalist.reconnectToken, 'answer');
    engine.beginFinalReview(host.roomCode, host.hostToken);

    const beforeJoin = engine.snapshot(host.roomCode);
    expect(beforeJoin.finalRound?.reviewPlayerId).toBe(finalist.playerId);
    expect(beforeJoin.finalRound?.rosterIds).toEqual([finalist.playerId]);

    const late = addPlayer(engine, host.roomCode, 'Late');
    const afterJoin = engine.snapshot(host.roomCode);
    const lateState = afterJoin.players.find((player) => player.id === late.playerId)!;
    expect(lateState.seat).toBe(1);
    expect(lateState.finalWagerSubmitted).toBe(true);
    expect(lateState.finalAnswerSubmitted).toBe(true);
    expect(lateState.finalResolved).toBe(true);
    expect(afterJoin.finalRound?.participantIds).toEqual([finalist.playerId]);
    expect(afterJoin.finalRound?.reviewPlayerId).toBe(finalist.playerId);

    engine.resolveFinalAnswer(host.roomCode, host.hostToken, finalist.playerId, false);
    const recap = engine.snapshot(host.roomCode);
    expect(recap.phase).toBe('recap');
    expect(recap.resultPlayerIds).toEqual([finalist.playerId]);
  });

  it('keeps an empty practice result roster empty when someone joins after the game', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: false });
    engine.startGame(host.roomCode, host.hostToken);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    expect(engine.snapshot(host.roomCode).resultPlayerIds).toEqual([]);

    addPlayer(engine, host.roomCode, 'Late');
    expect(engine.snapshot(host.roomCode).resultPlayerIds).toEqual([]);
  });

  it('freezes recap results before players join after a non-Final game ends', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: false });
    const original = addPlayer(engine, host.roomCode, 'Original');
    engine.startGame(host.roomCode, host.hostToken);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    expect(engine.snapshot(host.roomCode).phase).toBe('recap');

    const late = addPlayer(engine, host.roomCode, 'Late');
    const recap = engine.snapshot(host.roomCode);
    expect(recap.players.some((player) => player.id === late.playerId)).toBe(true);
    expect(recap.resultPlayerIds).toEqual([original.playerId]);
  });

  it('locks Final answers at timeout without revealing until the host starts review', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true, timerSeconds: 5 });
    const player = addPlayer(engine, host.roomCode);
    engine.startGame(host.roomCode, host.hostToken);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    engine.submitFinalWager(host.roomCode, player.playerId, player.reconnectToken, 100);
    engine.openFinalQuestion(host.roomCode, host.hostToken);

    const open = engine.snapshot(host.roomCode);
    expect(open.phase).toBe('final-question');
    expect(open.finalRound?.responsesClosed).toBe(false);
    engine.tick((open.timer.endsAt ?? Date.now()) + 1);

    const locked = engine.snapshot(host.roomCode);
    expect(locked.phase).toBe('final-question');
    expect(locked.finalRound?.responsesClosed).toBe(true);
    expect(locked.timer.running).toBe(false);
    expect(() => engine.submitFinalAnswer(host.roomCode, player.playerId, player.reconnectToken, 'late answer')).toThrow(/closed/i);

    engine.beginFinalReview(host.roomCode, host.hostToken);
    expect(engine.snapshot(host.roomCode).phase).toBe('final-review');
  });

  it('locks Final responses after all active participants submit but preserves host-controlled reveal', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true });
    const player = addPlayer(engine, host.roomCode);
    engine.startGame(host.roomCode, host.hostToken);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    engine.submitFinalWager(host.roomCode, player.playerId, player.reconnectToken, 0);
    engine.openFinalQuestion(host.roomCode, host.hostToken);

    engine.submitFinalAnswer(host.roomCode, player.playerId, player.reconnectToken, 'locked answer');
    const state = engine.snapshot(host.roomCode);
    expect(state.phase).toBe('final-question');
    expect(state.finalRound?.responsesClosed).toBe(true);
    expect(state.players[0].finalAnswerSubmitted).toBe(true);
  });

  it('does not let a disconnected Final participant block response locking', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true });
    const one = addPlayer(engine, host.roomCode, 'One');
    const two = addPlayer(engine, host.roomCode, 'Two');
    engine.startGame(host.roomCode, host.hostToken);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    engine.submitFinalWager(host.roomCode, one.playerId, one.reconnectToken, 0);
    engine.submitFinalWager(host.roomCode, two.playerId, two.reconnectToken, 0);
    engine.openFinalQuestion(host.roomCode, host.hostToken);
    engine.setPlayerConnected(host.roomCode, two.playerId, false);
    engine.submitFinalAnswer(host.roomCode, one.playerId, one.reconnectToken, 'answer');

    const state = engine.snapshot(host.roomCode);
    expect(state.finalRound?.responsesClosed).toBe(true);
    expect(state.phase).toBe('final-question');
  });

  it('requires host authorization before suspending a reserved seat', () => {
    const { engine, host } = setup();
    const player = addPlayer(engine, host.roomCode);

    expect(() => engine.suspendPlayer(host.roomCode, 'wrong-token', player.playerId)).toThrow(/authorization/i);
    expect(engine.snapshot(host.roomCode).players[0].connected).toBe(true);

    engine.suspendPlayer(host.roomCode, host.hostToken, player.playerId);
    expect(engine.snapshot(host.roomCode).players[0].connected).toBe(false);
  });

  it('keeps rooms open even when a legacy lock setting is requested', () => {
    const { engine, host } = setup({ lockRoomOnStart: true });
    const player = addPlayer(engine, host.roomCode, 'One');
    engine.startGame(host.roomCode, host.hostToken);

    const joined = addPlayer(engine, host.roomCode, 'Two');
    const open = engine.snapshot(host.roomCode);
    expect(open.locked).toBe(false);
    expect(open.settings.lockRoomOnStart).toBe(false);
    expect(open.players.some((candidate) => candidate.id === joined.playerId)).toBe(true);

    engine.setPlayerConnected(host.roomCode, player.playerId, false);
    expect(() => engine.reconnectPlayer(host.roomCode, player.playerId, player.reconnectToken)).not.toThrow();
  });

  it('keeps exact late-game multiplier windows', () => {
    const { engine } = setup();
    expect(engine.multiplierForRemaining(7)).toBe(1);
    expect(engine.multiplierForRemaining(6)).toBe(2);
    expect(engine.multiplierForRemaining(4)).toBe(2);
    expect(engine.multiplierForRemaining(3)).toBe(3);
    expect(engine.multiplierForRemaining(1)).toBe(3);
  });
});
