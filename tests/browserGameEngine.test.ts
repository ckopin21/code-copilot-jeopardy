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

  it('rotates question ownership in join order and assigns Daily Double to the turn owner', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: true, dailyDoubleCount: 16, finalRoundEnabled: false });
    const one = addPlayer(engine, host.roomCode, 'One');
    const two = addPlayer(engine, host.roomCode, 'Two');
    engine.startGame(host.roomCode, host.hostToken);
    expect(engine.snapshot(host.roomCode).turnPlayerId).toBe(one.playerId);
    const first = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, first.questionId);
    expect(engine.snapshot(host.roomCode).currentQuestion?.dailyDoublePlayerId).toBe(one.playerId);
    engine.setDailyDoubleWager(host.roomCode, host.hostToken, 100);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, one.playerId, true);
    engine.advanceToBoard(host.roomCode, host.hostToken);
    expect(engine.snapshot(host.roomCode).turnPlayerId).toBe(two.playerId);
  });

  it('penalizes the turn owner when a buzzer question expires unanswered', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, timerSeconds: 5, allowNegativeScores: true });
    const one = addPlayer(engine, host.roomCode, 'One');
    addPlayer(engine, host.roomCode, 'Two');
    engine.startGame(host.roomCode, host.hostToken);
    const tile = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    const value = engine.snapshot(host.roomCode).currentQuestion!.effectiveValue;
    engine.openBuzzers(host.roomCode, host.hostToken);
    const endsAt = engine.snapshot(host.roomCode).timer.endsAt!;
    engine.tick(endsAt + 1);
    const state = engine.snapshot(host.roomCode);
    expect(state.currentQuestion?.timedOut).toBe(true);
    expect(state.currentQuestion?.answerRevealed).toBe(true);
    expect(state.players.find((player) => player.id === one.playerId)?.score).toBe(-value);
  });
  it('penalizes the selecting player when the host reveals a normal question with no buzz', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, allowNegativeScores: true });
    const one = addPlayer(engine, host.roomCode, 'One');
    addPlayer(engine, host.roomCode, 'Two');
    engine.startGame(host.roomCode, host.hostToken);
    const tile = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    const value = engine.snapshot(host.roomCode).currentQuestion!.effectiveValue;

    engine.revealAnswer(host.roomCode, host.hostToken);

    const state = engine.snapshot(host.roomCode);
    const owner = state.players.find((player) => player.id === one.playerId)!;
    expect(state.currentQuestion?.answerRevealed).toBe(true);
    expect(state.currentQuestion?.timedOut).toBe(true);
    expect(owner.score).toBe(-value);
    expect(owner.stats.incorrect).toBe(1);
  });

  it('does not apply the no-buzz penalty when a Daily Double answer is revealed for judging', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: true, dailyDoubleCount: 16, finalRoundEnabled: false, allowNegativeScores: true });
    const player = addPlayer(engine, host.roomCode, 'Daily');
    engine.startGame(host.roomCode, host.hostToken);
    const daily = engine.snapshot(host.roomCode).board!.questions.find((question) => question.dailyDouble)!;
    engine.selectQuestion(host.roomCode, host.hostToken, daily.questionId, player.playerId);
    engine.setDailyDoubleWager(host.roomCode, host.hostToken, 100);
    const before = engine.snapshot(host.roomCode).players.find((candidate) => candidate.id === player.playerId)!;

    engine.revealAnswer(host.roomCode, host.hostToken);

    const after = engine.snapshot(host.roomCode).players.find((candidate) => candidate.id === player.playerId)!;
    expect(after.score).toBe(before.score);
    expect(after.stats.incorrect).toBe(before.stats.incorrect);
  });

  it('keeps a Daily Double host-judged after its timer expires', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: true, dailyDoubleCount: 16, finalRoundEnabled: false, timerSeconds: 5, allowNegativeScores: true, allowWagerBeyondScore: true });
    const player = addPlayer(engine, host.roomCode, 'Daily Timer');
    engine.startGame(host.roomCode, host.hostToken);
    const daily = engine.snapshot(host.roomCode).board!.questions.find((question) => question.dailyDouble)!;
    engine.selectQuestion(host.roomCode, host.hostToken, daily.questionId, player.playerId);
    engine.setDailyDoubleWager(host.roomCode, host.hostToken, 100);
    const before = engine.snapshot(host.roomCode).players.find((candidate) => candidate.id === player.playerId)!.score;
    const endsAt = engine.snapshot(host.roomCode).timer.endsAt!;

    engine.tick(endsAt + 1);

    const expired = engine.snapshot(host.roomCode);
    expect(expired.currentQuestion?.timedOut).toBe(false);
    expect(expired.currentQuestion?.answerRevealed).toBe(false);
    expect(expired.players.find((candidate) => candidate.id === player.playerId)!.score).toBe(before);

    engine.revealAnswer(host.roomCode, host.hostToken);
    expect(() => engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, true)).not.toThrow();
    expect(engine.snapshot(host.roomCode).players.find((candidate) => candidate.id === player.playerId)!.score).toBe(before + 100);
  });

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

  it('lets the host set an authoritative turn and manual mode keeps it after a clue', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, turnOrderMode: 'manual' });
    const one = addPlayer(engine, host.roomCode, 'One');
    const two = addPlayer(engine, host.roomCode, 'Two');
    engine.startGame(host.roomCode, host.hostToken);
    engine.setTurnPlayer(host.roomCode, host.hostToken, two.playerId);
    expect(engine.snapshot(host.roomCode).turnPlayerId).toBe(two.playerId);

    const tile = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.advanceToBoard(host.roomCode, host.hostToken);
    expect(engine.snapshot(host.roomCode).turnPlayerId).toBe(two.playerId);
    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === one.playerId)?.connected).toBe(true);
  });

  it('rotates forward when the current turn owner disconnects on the board', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false });
    const one = addPlayer(engine, host.roomCode, 'One');
    const two = addPlayer(engine, host.roomCode, 'Two');
    const three = addPlayer(engine, host.roomCode, 'Three');
    engine.startGame(host.roomCode, host.hostToken);
    engine.setTurnPlayer(host.roomCode, host.hostToken, two.playerId);
    engine.setPlayerConnected(host.roomCode, two.playerId, false);
    expect(engine.snapshot(host.roomCode).turnPlayerId).toBe(three.playerId);
    engine.reconnectPlayer(host.roomCode, two.playerId, two.reconnectToken);
    expect(engine.snapshot(host.roomCode).turnPlayerId).toBe(three.playerId);
    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === one.playerId)?.connected).toBe(true);
  });

  it('keeps late joiners out of a clue that already started, then includes them on the next clue', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, timerSeconds: null });
    const one = addPlayer(engine, host.roomCode, 'One');
    engine.startGame(host.roomCode, host.hostToken);
    const first = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, first.questionId);
    const late = addPlayer(engine, host.roomCode, 'Late');
    engine.openBuzzers(host.roomCode, host.hostToken);
    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === late.playerId)?.buzzEligible).toBe(false);
    expect(engine.buzz(host.roomCode, late.playerId, late.reconnectToken).accepted).toBe(false);
    expect(engine.buzz(host.roomCode, one.playerId, one.reconnectToken).accepted).toBe(true);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, one.playerId, true);
    engine.advanceToBoard(host.roomCode, host.hostToken);

    const second = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, second.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === late.playerId)?.buzzEligible).toBe(true);
  });

  it('restores live buzzer eligibility when an original participant reconnects', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, timerSeconds: null });
    const one = addPlayer(engine, host.roomCode, 'One');
    addPlayer(engine, host.roomCode, 'Two');
    engine.startGame(host.roomCode, host.hostToken);
    const tile = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.setPlayerConnected(host.roomCode, one.playerId, false);
    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === one.playerId)?.buzzEligible).toBe(false);
    engine.reconnectPlayer(host.roomCode, one.playerId, one.reconnectToken);
    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === one.playerId)?.buzzEligible).toBe(true);
    expect(engine.buzz(host.roomCode, one.playerId, one.reconnectToken).accepted).toBe(true);
  });

  it('lets the host explicitly move turn ownership on the board', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, turnOrderMode: 'manual' });
    addPlayer(engine, host.roomCode, 'One');
    const two = addPlayer(engine, host.roomCode, 'Two');
    engine.startGame(host.roomCode, host.hostToken);
    engine.setTurnPlayer(host.roomCode, host.hostToken, two.playerId);
    expect(engine.snapshot(host.roomCode).turnPlayerId).toBe(two.playerId);
    const tile = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    expect(engine.snapshot(host.roomCode).currentQuestion?.turnPlayerId).toBe(two.playerId);
  });

  it('normalizes the unsupported steal setting off so reveal-first judging cannot expose an answer to a reopened buzzer', () => {
    const { engine, host } = setup({ stealsEnabled: true });
    expect(engine.snapshot(host.roomCode).settings.stealsEnabled).toBe(false);
    engine.updateSettings(host.roomCode, host.hostToken, { stealsEnabled: true });
    expect(engine.snapshot(host.roomCode).settings.stealsEnabled).toBe(false);
  });

  it('rejects a duplicate spoken ruling so a double-click cannot score twice', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false });
    const player = addPlayer(engine, host.roomCode, 'Double Click');
    engine.startGame(host.roomCode, host.hostToken);
    const tile = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, player.playerId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, true);
    const afterFirst = engine.snapshot(host.roomCode).players.find((candidate) => candidate.id === player.playerId)!.score;
    expect(() => engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, true)).toThrow(/already resolved/i);
    expect(engine.snapshot(host.roomCode).players.find((candidate) => candidate.id === player.playerId)!.score).toBe(afterFirst);
  });

  it('does not accept a buzz while the game is paused, then restores it after resume', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, timerSeconds: null });
    const player = addPlayer(engine, host.roomCode, 'Paused');
    engine.startGame(host.roomCode, host.hostToken);
    const tile = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.pause(host.roomCode, host.hostToken);
    expect(engine.buzz(host.roomCode, player.playerId, player.reconnectToken).accepted).toBe(false);
    expect(() => engine.localBuzz(host.roomCode, host.hostToken, player.playerId)).toThrow(/not valid/i);
    engine.resume(host.roomCode, host.hostToken);
    expect(engine.buzz(host.roomCode, player.playerId, player.reconnectToken).accepted).toBe(true);
  });

  it('keeps zero-player practice playable when a source clue is configured as typed response', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, timerSeconds: null });
    engine.startGame(host.roomCode, host.hostToken);
    const tile = firstUnused(engine, host.roomCode);
    const rooms = (engine as unknown as { rooms: Map<string, { questions: Record<string, { responseMode?: 'buzz' | 'text' }> }> }).rooms;
    rooms.get(host.roomCode)!.questions[tile.questionId].responseMode = 'text';
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    expect(engine.snapshot(host.roomCode).currentQuestion?.responseMode).toBe('buzz');
    engine.revealAnswer(host.roomCode, host.hostToken);
    expect(() => engine.advanceToBoard(host.roomCode, host.hostToken)).not.toThrow();
  });

  it('will not leave an unfinished or unjudged spoken clue', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false });
    const player = addPlayer(engine, host.roomCode, 'Judge Me');
    engine.startGame(host.roomCode, host.hostToken);
    const rooms = (engine as unknown as { rooms: Map<string, { questions: Record<string, { responseMode?: 'buzz' | 'text' }> }> }).rooms;
    const record = rooms.get(host.roomCode)!;
    const tile = engine.snapshot(host.roomCode).board!.questions.find((candidate) => !candidate.used && (record.questions[candidate.questionId].responseMode ?? 'buzz') === 'buzz')!;
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    expect(() => engine.advanceToBoard(host.roomCode, host.hostToken)).toThrow(/reveal and finish/i);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, player.playerId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    expect(() => engine.advanceToBoard(host.roomCode, host.hostToken)).toThrow(/judge the spoken response/i);
  });

  it('keeps exact late-game multiplier windows', () => {
    const { engine } = setup();
    expect(engine.multiplierForRemaining(7)).toBe(1);
    expect(engine.multiplierForRemaining(6)).toBe(2);
    expect(engine.multiplierForRemaining(4)).toBe(2);
    expect(engine.multiplierForRemaining(3)).toBe(3);
    expect(engine.multiplierForRemaining(1)).toBe(3);
  });

  it('keeps typed and Final response windows open through a transient disconnect', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true, timerSeconds: 15 });
    const player = addPlayer(engine, host.roomCode, 'Reconnect Me');
    engine.startGame(host.roomCode, host.hostToken);

    const rooms = (engine as unknown as { rooms: Map<string, { questions: Record<string, { responseMode?: 'buzz' | 'text' }> }> }).rooms;
    const record = rooms.get(host.roomCode)!;
    const typed = engine.snapshot(host.roomCode).board!.questions.find((candidate) => !candidate.used && (record.questions[candidate.questionId].responseMode ?? 'buzz') === 'text');
    if (typed) {
      engine.selectQuestion(host.roomCode, host.hostToken, typed.questionId);
      engine.setPlayerConnected(host.roomCode, player.playerId, false);
      expect(engine.snapshot(host.roomCode).currentQuestion?.responsesClosed).toBe(false);
      engine.reconnectPlayer(host.roomCode, player.playerId, player.reconnectToken);
      engine.submitTextResponse(host.roomCode, player.playerId, player.reconnectToken, 'answer');
      expect(engine.snapshot(host.roomCode).currentQuestion?.textResponses?.[player.playerId]).toBeTruthy();
      engine.revealAnswer(host.roomCode, host.hostToken);
      engine.resolveTextResponse(host.roomCode, host.hostToken, player.playerId, false);
      engine.advanceToBoard(host.roomCode, host.hostToken);
    }

    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    const finalState = engine.snapshot(host.roomCode);
    expect(finalState.phase).toBe('final-category');
    expect(finalState.finalRound?.participantIds).toContain(player.playerId);
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    engine.submitFinalWager(host.roomCode, player.playerId, player.reconnectToken, 0);
    engine.openFinalQuestion(host.roomCode, host.hostToken);
    engine.setPlayerConnected(host.roomCode, player.playerId, false);
    expect(engine.snapshot(host.roomCode).finalRound?.responsesClosed).toBe(false);
  });

  it('still starts Final when the reserved player is disconnected at the last board clue', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true });
    const player = addPlayer(engine, host.roomCode, 'Reserved');
    engine.startGame(host.roomCode, host.hostToken);
    while (engine.snapshot(host.roomCode).remainingQuestions > 1) {
      const tile = firstUnused(engine, host.roomCode);
      engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
      engine.revealAnswer(host.roomCode, host.hostToken);
      engine.advanceToBoard(host.roomCode, host.hostToken);
    }
    const last = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, last.questionId);
    engine.setPlayerConnected(host.roomCode, player.playerId, false);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.advanceToBoard(host.roomCode, host.hostToken);
    const state = engine.snapshot(host.roomCode);
    expect(state.phase).toBe('final-category');
    expect(state.finalRound?.participantIds).toContain(player.playerId);
  });


  it('stores authoritative used-tile value and scoring result for presentation/recovery', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: false });
    const player = addPlayer(engine, host.roomCode, 'Result');
    engine.startGame(host.roomCode, host.hostToken);
    const rooms = (engine as unknown as { rooms: Map<string, { questions: Record<string, { responseMode?: 'buzz' | 'text' }> }> }).rooms;
    const record = rooms.get(host.roomCode)!;
    const tile = engine.snapshot(host.roomCode).board!.questions.find((candidate) => !candidate.used && (record.questions[candidate.questionId].responseMode ?? 'buzz') === 'buzz')!;
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, player.playerId);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, true);
    const used = engine.snapshot(host.roomCode).board!.questions.find((candidate) => candidate.questionId === tile.questionId)!;
    expect(used.playedValue).toBeGreaterThan(0);
    expect(used.results?.[0]).toMatchObject({ playerId: player.playerId, correct: true });
    expect(used.results?.[0].delta).toBeGreaterThan(0);
  });


  it('protects a non-positive Final player from losing more points on a miss', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true, allowNegativeScores: true });
    const player = addPlayer(engine, host.roomCode, 'Comeback');
    addPlayer(engine, host.roomCode, 'Leader');
    engine.startGame(host.roomCode, host.hostToken);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    engine.adjustScore(host.roomCode, host.hostToken, player.playerId, -10000);
    const before = engine.snapshot(host.roomCode).players.find((candidate) => candidate.id === player.playerId)!.score;
    expect(before).toBeLessThanOrEqual(0);
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    engine.submitFinalWager(host.roomCode, player.playerId, player.reconnectToken, 1000);
    const leader = engine.snapshot(host.roomCode).players.find((candidate) => candidate.id !== player.playerId)!;
    const leaderToken = (engine as unknown as { rooms: Map<string, { playerTokens: Record<string, string> }> }).rooms.get(host.roomCode)!.playerTokens[leader.id];
    engine.submitFinalWager(host.roomCode, leader.id, leaderToken, 0);
    engine.openFinalQuestion(host.roomCode, host.hostToken);
    engine.submitFinalAnswer(host.roomCode, player.playerId, player.reconnectToken, 'wrong answer');
    engine.submitFinalAnswer(host.roomCode, leader.id, leaderToken, 'answer');
    engine.beginFinalReview(host.roomCode, host.hostToken);
    engine.resolveFinalAnswer(host.roomCode, host.hostToken, player.playerId, false);
    expect(engine.snapshot(host.roomCode).players.find((candidate) => candidate.id === player.playerId)!.score).toBe(before);
  });

  it('enforces the 1000 Final cap on a runaway leader', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true, allowNegativeScores: true });
    const leader = addPlayer(engine, host.roomCode, 'Leader');
    const runner = addPlayer(engine, host.roomCode, 'Runner');
    engine.startGame(host.roomCode, host.hostToken);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    engine.adjustScore(host.roomCode, host.hostToken, leader.playerId, 20000);
    engine.adjustScore(host.roomCode, host.hostToken, runner.playerId, 1000);
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    expect(() => engine.submitFinalWager(host.roomCode, leader.playerId, leader.reconnectToken, 1100)).toThrow(/0 and 1000/i);
    expect(() => engine.submitFinalWager(host.roomCode, leader.playerId, leader.reconnectToken, 1000)).not.toThrow();
  });

});
