import { beforeEach, describe, expect, it } from 'vitest';
import type { GameSettings } from '../../src/games/trivia/types';
import { BUZZ_CLUE_TIMER_BONUS_MS, TriviaEngine, type RandomSource } from '../../src/games/trivia/engine/TriviaEngine';
import { sanitizeRoomSnapshot } from '../../src/games/trivia/engine/snapshotSecurity';

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

type Seat = { playerId: string; reconnectToken: string };
type EngineInternals = { rooms: Map<string, { questions: Record<string, { responseMode?: 'buzz' | 'text' }> }> };

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

/** Three phones, a started game and an open buzzer clue picked by `one` (first in rotation). */
function openClue(settings: Partial<GameSettings> = {}) {
  const engine = new TriviaEngine(new FixedRandom(), 60_000);
  const host = engine.createRoom('https://example.test/game', {
    randomizeCategories: false, dailyDoublesEnabled: false, finalRoundEnabled: false,
    allowNegativeScores: true, timerSeconds: 15, ...settings
  });
  const join = (name: string) => engine.joinPlayer(host.roomCode, { name, avatar: '🚀', accent: '#93c5fd' });
  const one = join('One');
  const two = join('Two');
  const three = join('Three');
  engine.startGame(host.roomCode, host.hostToken);
  const record = (engine as unknown as EngineInternals).rooms.get(host.roomCode)!;
  const tile = engine.snapshot(host.roomCode).board!.questions.find((candidate) => !candidate.used && (record.questions[candidate.questionId].responseMode ?? 'buzz') === 'buzz')!;
  engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
  const value = engine.snapshot(host.roomCode).currentQuestion!.effectiveValue;
  const state = () => engine.snapshot(host.roomCode);
  const score = (seat: Seat) => state().players.find((player) => player.id === seat.playerId)!.score;
  const buzz = (seat: Seat) => engine.buzz(host.roomCode, seat.playerId, seat.reconnectToken);
  const pass = (seat: Seat) => engine.passTurn(host.roomCode, seat.playerId, seat.reconnectToken);
  const open = () => engine.openBuzzers(host.roomCode, host.hostToken);
  return { engine, host, one, two, three, value, state, score, buzz, pass, open };
}

describe('turn player priority', () => {
  it('gives the turn player first chance and the clue timer 5 extra seconds', () => {
    const { one, state, open } = openClue({ timerSeconds: 15 });
    expect(state().currentQuestion?.priorityPlayerId).toBeNull();
    open();
    const opened = state();
    expect(opened.currentQuestion?.priorityPlayerId).toBe(one.playerId);
    expect(opened.timer.durationMs).toBe(15_000 + BUZZ_CLUE_TIMER_BONUS_MS);
    expect(BUZZ_CLUE_TIMER_BONUS_MS).toBe(5_000);
    expect(opened.players.every((player) => player.buzzEligible)).toBe(true);
  });

  it('lets the turn player answer right away', () => {
    const { one, state, buzz, open } = openClue();
    open();
    expect(buzz(one)).toMatchObject({ accepted: true, queued: false });
    expect(state().currentQuestion).toMatchObject({ buzzWinnerId: one.playerId, priorityPlayerId: null, buzzOpen: false });
    expect(state().timer.running).toBe(false);
  });

  it('puts other buzzes in line without taking the clue from the turn player', () => {
    const { one, two, three, state, buzz, open } = openClue();
    open();
    expect(buzz(three)).toMatchObject({ accepted: true, queued: true });
    expect(buzz(two)).toMatchObject({ accepted: true, queued: true });
    const waiting = state();
    expect(waiting.currentQuestion).toMatchObject({ buzzWinnerId: null, priorityPlayerId: one.playerId, buzzOpen: true, buzzQueue: [three.playerId, two.playerId] });
    expect(waiting.timer.running).toBe(true);
    // Negative: a queued player cannot buzz twice.
    expect(buzz(three)).toMatchObject({ accepted: false });
    // The turn player can still take it, and the line is dropped.
    expect(buzz(one)).toMatchObject({ accepted: true, queued: false });
    expect(state().currentQuestion).toMatchObject({ buzzWinnerId: one.playerId, buzzQueue: [] });
  });

  it('hands a passed clue to the first player in line', () => {
    const { one, two, three, state, buzz, pass, open } = openClue();
    open();
    buzz(three);
    buzz(two);
    pass(one);
    const passed = state();
    expect(passed.currentQuestion).toMatchObject({ buzzWinnerId: three.playerId, priorityPassedBy: one.playerId, priorityPlayerId: null, buzzOpen: false });
    expect(passed.timer.running).toBe(false);
    expect(passed.players.every((player) => !player.buzzEligible)).toBe(true);
  });

  it('keeps buzzing open for the others after a pass with nobody in line, on the same timer', () => {
    const { one, two, three, state, buzz, pass, open } = openClue();
    open();
    const endsAt = state().timer.endsAt;
    pass(one);
    const passed = state();
    expect(passed.currentQuestion).toMatchObject({ buzzWinnerId: null, buzzOpen: true, priorityPassedBy: one.playerId });
    expect(passed.timer.endsAt).toBe(endsAt);
    // Negative: the passer cannot buzz back in.
    expect(passed.players.find((player) => player.id === one.playerId)?.buzzEligible).toBe(false);
    expect(buzz(one)).toMatchObject({ accepted: false });
    expect(buzz(two)).toMatchObject({ accepted: true, queued: false });
    expect(buzz(three)).toMatchObject({ accepted: false });
    expect(state().currentQuestion?.buzzWinnerId).toBe(two.playerId);
  });

  it('rejects a pass from anyone without first chance', () => {
    const { engine, host, one, two, pass, buzz, open } = openClue();
    // Negative: buzzers are not open yet.
    expect(() => pass(one)).toThrow(/first chance/i);
    expect(() => engine.hostPassTurn(host.roomCode, host.hostToken)).toThrow(/first chance/i);
    open();
    expect(() => pass(two)).toThrow(/first chance/i);
    pass(one);
    expect(() => pass(one)).toThrow(/first chance/i);
    buzz(two);
    expect(() => engine.hostPassTurn(host.roomCode, host.hostToken)).toThrow(/first chance/i);
  });

  it('charges the turn player when the timer runs out while they hold the clue', () => {
    const { engine, one, two, value, state, score, buzz, open } = openClue();
    open();
    buzz(two);
    engine.tick(state().timer.endsAt! + 1);
    expect(state().currentQuestion).toMatchObject({ timedOut: true, answerRevealed: true, priorityPlayerId: null });
    expect(score(one)).toBe(-value);
    expect(score(two)).toBe(0);
  });

  it('does not charge a turn player who passed when the timer runs out', () => {
    const { engine, one, state, score, pass, open } = openClue();
    open();
    pass(one);
    engine.tick(state().timer.endsAt! + 1);
    const closed = state();
    expect(closed.currentQuestion).toMatchObject({ answerRevealed: true, buzzOpen: false });
    expect(closed.currentQuestion?.timedOut).toBeFalsy();
    expect(closed.players.every((player) => player.score === 0)).toBe(true);
    expect(score(one)).toBe(0);
  });

  it('does not charge a turn player who passed when the host reveals with no buzz', () => {
    const { engine, host, one, state, score, pass, open } = openClue();
    open();
    pass(one);
    engine.revealAnswer(host.roomCode, host.hostToken);
    expect(state().currentQuestion?.answerRevealed).toBe(true);
    expect(score(one)).toBe(0);
    engine.advanceToBoard(host.roomCode, host.hostToken);
    expect(state().phase).toBe('board');
  });

  it('ends the clue on a wrong answer from the player who got the pass, with no steal', () => {
    const { engine, host, one, two, three, value, state, score, buzz, pass, open } = openClue();
    open();
    buzz(two);
    buzz(three);
    pass(one);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, two.playerId, false);
    const judged = state();
    expect(judged.currentQuestion).toMatchObject({ answerRevealed: true, buzzOpen: false });
    expect(judged.players.every((player) => !player.buzzEligible)).toBe(true);
    expect(score(two)).toBe(-value);
    expect(score(one)).toBe(0);
    expect(score(three)).toBe(0);
    // Rotation is unchanged: the turn moves on from the turn player, not the answerer.
    engine.advanceToBoard(host.roomCode, host.hostToken);
    expect(state().turnPlayerId).toBe(two.playerId);
  });

  it('ends the clue on a wrong answer from the turn player, with no steal', () => {
    const { engine, host, one, two, value, state, score, buzz, open } = openClue();
    open();
    buzz(two);
    buzz(one);
    engine.revealAnswer(host.roomCode, host.hostToken);
    engine.resolveAnswer(host.roomCode, host.hostToken, one.playerId, false);
    expect(state().currentQuestion).toMatchObject({ answerRevealed: true, buzzOpen: false, buzzWinnerId: one.playerId });
    expect(score(one)).toBe(-value);
    expect(score(two)).toBe(0);
  });

  it('keeps first chance through a dropped phone and lets the host pass for them', () => {
    const { engine, host, one, two, state, buzz, open } = openClue();
    open();
    buzz(two);
    engine.setPlayerConnected(host.roomCode, one.playerId, false);
    expect(state().currentQuestion?.priorityPlayerId).toBe(one.playerId);
    engine.reconnectPlayer(host.roomCode, one.playerId, one.reconnectToken);
    expect(state().players.find((player) => player.id === one.playerId)?.buzzEligible).toBe(true);
    // Negative: the queued player stays ineligible after a reconnect.
    engine.setPlayerConnected(host.roomCode, two.playerId, false);
    engine.reconnectPlayer(host.roomCode, two.playerId, two.reconnectToken);
    expect(state().players.find((player) => player.id === two.playerId)?.buzzEligible).toBe(false);
    engine.hostPassTurn(host.roomCode, host.hostToken);
    expect(state().currentQuestion?.buzzWinnerId).toBe(two.playerId);
  });

  it('applies the same first-chance rule to keyboard and gamepad buzzers', () => {
    const { engine, host, one, two, state, open } = openClue();
    open();
    engine.localBuzz(host.roomCode, host.hostToken, two.playerId);
    expect(state().currentQuestion).toMatchObject({ buzzWinnerId: null, buzzQueue: [two.playerId] });
    expect(() => engine.localBuzz(host.roomCode, host.hostToken, two.playerId)).toThrow(/not valid/i);
    engine.localBuzz(host.roomCode, host.hostToken, one.playerId);
    expect(state().currentQuestion?.buzzWinnerId).toBe(one.playerId);
  });

  it('hands the clue to the line when the host removes the turn player', () => {
    const { engine, host, one, three, state, buzz, open } = openClue();
    open();
    buzz(three);
    engine.removePlayer(host.roomCode, host.hostToken, one.playerId);
    expect(state().currentQuestion).toMatchObject({ buzzWinnerId: three.playerId, priorityPlayerId: null });
  });

  it('drops a removed player from the line', () => {
    const { engine, host, one, two, three, state, buzz, pass, open } = openClue();
    open();
    buzz(two);
    buzz(three);
    engine.removePlayer(host.roomCode, host.hostToken, two.playerId);
    expect(state().currentQuestion?.buzzQueue).toEqual([three.playerId]);
    pass(one);
    expect(state().currentQuestion?.buzzWinnerId).toBe(three.playerId);
  });

  it('skips a disconnected player in line when the clue is passed', () => {
    const { engine, host, one, two, three, state, buzz, pass, open } = openClue();
    open();
    buzz(two);
    buzz(three);
    engine.setPlayerConnected(host.roomCode, two.playerId, false);
    pass(one);
    expect(state().currentQuestion?.buzzWinnerId).toBe(three.playerId);
  });

  it('closes the clue with no penalty when nobody is left after a pass', () => {
    const { engine, host, one, two, three, state, pass, open } = openClue();
    engine.setPlayerConnected(host.roomCode, two.playerId, false);
    engine.setPlayerConnected(host.roomCode, three.playerId, false);
    open();
    pass(one);
    const closed = state();
    expect(closed.currentQuestion).toMatchObject({ answerRevealed: true, buzzOpen: false });
    expect(closed.timer.running).toBe(false);
    expect(closed.players.every((player) => player.score === 0)).toBe(true);
  });

  it('restores first chance and a fresh line when the host locks and reopens buzzers', () => {
    const { engine, host, one, two, state, buzz, open } = openClue();
    open();
    buzz(two);
    engine.closeBuzzers(host.roomCode, host.hostToken);
    expect(state().currentQuestion).toMatchObject({ priorityPlayerId: null, buzzQueue: [] });
    open();
    expect(state().currentQuestion).toMatchObject({ priorityPlayerId: one.playerId, buzzQueue: [] });
    expect(buzz(two)).toMatchObject({ accepted: true, queued: true });
  });

  it('opens without first chance when the turn player already passed or is away', () => {
    const passed = openClue();
    passed.open();
    passed.pass(passed.one);
    passed.engine.closeBuzzers(passed.host.roomCode, passed.host.hostToken);
    passed.open();
    expect(passed.state().currentQuestion?.priorityPlayerId).toBeNull();

    const away = openClue();
    away.engine.setPlayerConnected(away.host.roomCode, away.one.playerId, false);
    away.open();
    expect(away.state().currentQuestion?.priorityPlayerId).toBeNull();
    expect(away.buzz(away.two)).toMatchObject({ accepted: true, queued: false });
  });

  it('shows first chance and the line to phones and the TV while still hiding the answer', () => {
    const { engine, host, one, two, buzz, open } = openClue();
    open();
    buzz(two);
    for (const role of ['player', 'presentation'] as const) {
      const view = sanitizeRoomSnapshot(engine.snapshot(host.roomCode), role, two.playerId);
      expect(view.currentQuestion).toMatchObject({ priorityPlayerId: one.playerId, buzzQueue: [two.playerId] });
      expect(view.currentQuestion?.acceptedAnswers).toBeUndefined();
    }
  });

  it('leaves Daily Double timing alone', () => {
    const engine = new TriviaEngine(new FixedRandom(), 60_000);
    const host = engine.createRoom('https://example.test/game', { randomizeCategories: false, gameLength: 'quick', dailyDoublesEnabled: true, dailyDoubleCount: 16, finalRoundEnabled: false, timerSeconds: 10, allowWagerBeyondScore: true });
    engine.joinPlayer(host.roomCode, { name: 'One', avatar: '🚀', accent: '#93c5fd' });
    engine.startGame(host.roomCode, host.hostToken);
    const tile = engine.snapshot(host.roomCode).board!.questions.find((candidate) => candidate.dailyDouble)!;
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    const wagered = engine.setDailyDoubleWager(host.roomCode, host.hostToken, 100);
    expect(wagered.timer.durationMs).toBe(10_000);
    expect(wagered.currentQuestion?.priorityPlayerId).toBeNull();
  });
});
