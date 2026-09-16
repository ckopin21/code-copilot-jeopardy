import crypto from 'node:crypto';
import path from 'node:path';
import { DEFAULT_SETTINGS, GAME_LENGTH_CONFIG } from '../src/shared/config.js';
import type {
  BoardQuestion,
  GameSettings,
  HostRoomCredentials,
  Player,
  PlayerJoinCredentials,
  Question,
  RoomSnapshot,
  RoomState
} from '../src/shared/types.js';
import { QUESTION_VALUES } from '../src/shared/types.js';
import { answerMatches } from '../src/shared/validation.js';
import type { PackRegistry } from './packRegistry.js';
import { JsonFilePersistence, type PersistenceAdapter } from './persistence.js';

export interface RoomRecord {
  state: RoomState;
  hostToken: string;
  playerTokens: Record<string, string>;
  questions: Record<string, Question>;
  finalQuestionId: string | null;
}

export interface RandomSource { next(): number }
class MathRandomSource implements RandomSource { next(): number { return Math.random(); } }

const emptyTimer = () => ({ running: false, durationMs: null, endsAt: null, remainingMs: null });
const roomCodeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function token(): string { return crypto.randomBytes(24).toString('base64url'); }
function id(prefix: string): string { return `${prefix}_${crypto.randomUUID()}`; }

function defaultStats() {
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

export class GameEngine {
  private rooms = new Map<string, RoomRecord>();
  private seenQuestionIds = new Set<string>();

  constructor(
    private readonly packs: PackRegistry,
    private readonly random: RandomSource = new MathRandomSource(),
    private readonly persistence: PersistenceAdapter<RoomRecord> = new JsonFilePersistence(path.resolve('.data/rooms.json')),
    private readonly roomTtlMs = Number(process.env.ROOM_TTL_MINUTES ?? 180) * 60_000
  ) {
    const now = Date.now();
    for (const record of persistence.load()) {
      if (record.state.expiresAt > now) {
        record.state.hostConnected = false;
        record.state.players.forEach((player) => { player.connected = false; });
        record.state.timer = emptyTimer();
        this.rooms.set(record.state.code, record);
      }
    }
  }

  private persist(): void {
    this.persistence.save([...this.rooms.values()]);
  }

  private code(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      let value = '';
      for (let index = 0; index < 5; index += 1) {
        value += roomCodeAlphabet[Math.floor(this.random.next() * roomCodeAlphabet.length)];
      }
      if (!this.rooms.has(value)) return value;
    }
    throw new Error('Could not allocate room code');
  }

  private room(roomCode: string): RoomRecord {
    const record = this.rooms.get(roomCode.toUpperCase());
    if (!record || record.state.expiresAt <= Date.now()) throw new Error('Room not found or expired');
    return record;
  }

  private hostRoom(roomCode: string, hostToken: string): RoomRecord {
    const room = this.room(roomCode);
    if (room.hostToken.length !== hostToken.length || !crypto.timingSafeEqual(Buffer.from(room.hostToken), Buffer.from(hostToken))) throw new Error('Host authorization failed');
    return room;
  }

  private playerRoom(roomCode: string, playerId: string, reconnectToken: string): [RoomRecord, Player] {
    const room = this.room(roomCode);
    const expected = room.playerTokens[playerId];
    if (!expected || expected.length !== reconnectToken.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(reconnectToken))) {
      throw new Error('Player authorization failed');
    }
    const player = room.state.players.find((item) => item.id === playerId);
    if (!player) throw new Error('Player not found');
    return [room, player];
  }

  snapshot(roomCode: string): RoomSnapshot {
    const state = structuredClone(this.room(roomCode).state);
    if (state.timer.running && state.timer.endsAt) state.timer.remainingMs = Math.max(0, state.timer.endsAt - Date.now());
    return { ...state, serverNow: Date.now() };
  }

  createRoom(baseUrl: string, settings?: Partial<GameSettings>): HostRoomCredentials {
    const code = this.code();
    const hostToken = token();
    const selectedPackIds = settings?.selectedPackIds?.length ? settings.selectedPackIds : DEFAULT_SETTINGS.selectedPackIds;
    const state: RoomState = {
      code,
      phase: 'lobby',
      previousPhase: null,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.roomTtlMs,
      hostConnected: true,
      locked: false,
      players: [],
      settings: { ...DEFAULT_SETTINGS, ...settings, selectedPackIds },
      board: null,
      currentQuestion: null,
      timer: emptyTimer(),
      multiplier: 1,
      remainingQuestions: 0,
      selectedPackIds,
      finalRound: null,
      gameStartedAt: null,
      gameEndedAt: null
    };
    this.rooms.set(code, { state, hostToken, playerTokens: {}, questions: {}, finalQuestionId: null });
    this.persist();
    return {
      roomCode: code,
      hostToken,
      joinUrl: `${baseUrl.replace(/\/$/, '')}/?mode=player&room=${code}`,
      presentationUrl: `${baseUrl.replace(/\/$/, '')}/?mode=presentation&room=${code}`
    };
  }

  reconnectHost(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    room.state.hostConnected = true;
    room.state.expiresAt = Date.now() + this.roomTtlMs;
    this.persist();
    return this.snapshot(roomCode);
  }

  setHostConnected(roomCode: string, connected: boolean): void {
    const room = this.room(roomCode);
    room.state.hostConnected = connected;
    this.persist();
  }

  joinPlayer(roomCode: string, input: { name: string; avatar: string; accent: string }): PlayerJoinCredentials {
    const room = this.room(roomCode);
    if (room.state.locked || (room.state.phase !== 'lobby' && room.state.settings.lockRoomOnStart)) throw new Error('Room is locked');
    if (room.state.players.length >= 5) throw new Error('Room already has 5 players');
    const playerId = id('player');
    const reconnectToken = token();
    const duplicateCount = room.state.players.filter((player) => player.name.toLowerCase() === input.name.toLowerCase()).length;
    const name = duplicateCount ? `${input.name} ${duplicateCount + 1}` : input.name;
    room.state.players.push({
      id: playerId,
      name,
      avatar: input.avatar,
      accent: input.accent,
      score: 0,
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
      stats: defaultStats()
    });
    room.playerTokens[playerId] = reconnectToken;
    this.persist();
    return { playerId, reconnectToken, roomCode: room.state.code };
  }

  reconnectPlayer(roomCode: string, playerId: string, reconnectToken: string): PlayerJoinCredentials {
    const [room, player] = this.playerRoom(roomCode, playerId, reconnectToken);
    player.connected = true;
    room.state.expiresAt = Date.now() + this.roomTtlMs;
    this.persist();
    return { playerId, reconnectToken, roomCode: room.state.code };
  }

  setPlayerConnected(roomCode: string, playerId: string, connected: boolean): void {
    const room = this.room(roomCode);
    const player = room.state.players.find((item) => item.id === playerId);
    if (player) {
      player.connected = connected;
      this.persist();
    }
  }

  removePlayer(roomCode: string, hostToken: string, playerId: string): void {
    const room = this.hostRoom(roomCode, hostToken);
    room.state.players = room.state.players.filter((player) => player.id !== playerId);
    delete room.playerTokens[playerId];
    this.persist();
  }

  updateSettings(roomCode: string, hostToken: string, updates: Partial<GameSettings>): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'lobby') throw new Error('Settings can only be changed in the lobby');
    const selectedPackIds = updates.selectedPackIds ?? room.state.settings.selectedPackIds;
    if (!selectedPackIds.length || selectedPackIds.some((packId) => !this.packs.get(packId))) throw new Error('Select at least one valid pack');
    room.state.settings = { ...room.state.settings, ...updates, selectedPackIds };
    room.state.selectedPackIds = selectedPackIds;
    this.persist();
    return this.snapshot(roomCode);
  }

  private shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = Math.floor(this.random.next() * (index + 1));
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }
    return copy;
  }

  private generateBoard(settings: GameSettings): { board: RoomState['board']; questions: Record<string, Question> } {
    const config = GAME_LENGTH_CONFIG[settings.gameLength];
    const selectedPacks = settings.selectedPackIds.map((packId) => this.packs.get(packId)).filter((pack): pack is NonNullable<typeof pack> => Boolean(pack));
    const pool = selectedPacks.flatMap((pack) => pack.questions);
    if (!pool.length) throw new Error('No questions available');
    const categoryGroups = new Map<string, Question[]>();
    for (const question of pool) {
      const key = settings.mixedPacks ? `${question.packId} · ${question.category}` : question.category;
      const list = categoryGroups.get(key) ?? [];
      list.push(question);
      categoryGroups.set(key, list);
    }
    let usable = [...categoryGroups.entries()].filter(([, questions]) => QUESTION_VALUES.slice(0, config.rows).every((value) => questions.some((question) => question.value === value)));
    usable.sort((a, b) => {
      const aUnseen = a[1].filter((question) => !this.seenQuestionIds.has(question.id)).length;
      const bUnseen = b[1].filter((question) => !this.seenQuestionIds.has(question.id)).length;
      return bUnseen - aUnseen;
    });
    if (settings.randomizeCategories) usable = this.shuffle(usable);
    const chosen = usable.slice(0, config.categories);
    if (chosen.length < config.categories) throw new Error('Selected packs do not contain enough complete categories for this game length');

    const boardQuestions: BoardQuestion[] = [];
    const questions: Record<string, Question> = {};
    for (const [categoryName, sourceQuestions] of chosen) {
      for (const value of QUESTION_VALUES.slice(0, config.rows)) {
        const candidates = sourceQuestions.filter((question) => question.value === value);
        const unseen = candidates.filter((question) => !this.seenQuestionIds.has(question.id));
        const chosenQuestion = this.shuffle(unseen.length ? unseen : candidates)[0];
        questions[chosenQuestion.id] = chosenQuestion;
        boardQuestions.push({ questionId: chosenQuestion.id, category: categoryName, value: chosenQuestion.value, used: false, dailyDouble: false });
        this.seenQuestionIds.add(chosenQuestion.id);
      }
    }

    if (settings.dailyDoublesEnabled) {
      const eligible = this.shuffle(boardQuestions.filter((entry) => questions[entry.questionId].dailyDoubleEligible !== false));
      for (const entry of eligible.slice(0, Math.min(settings.dailyDoubleCount, eligible.length))) entry.dailyDouble = true;
    }

    return { board: { categories: chosen.map(([name]) => name), questions: boardQuestions }, questions };
  }

  startGame(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'lobby') throw new Error('Game already started');
    const generated = this.generateBoard(room.state.settings);
    room.questions = generated.questions;
    room.state.board = generated.board;
    room.state.remainingQuestions = generated.board!.questions.length;
    room.state.multiplier = this.multiplierForRemaining(room.state.remainingQuestions, room.state.settings.lateGameModifiers);
    room.state.phase = 'board';
    room.state.locked = room.state.settings.lockRoomOnStart;
    room.state.gameStartedAt = Date.now();
    room.state.players.forEach((player) => {
      player.score = 0;
      player.positiveStreak = 0;
      player.coldStreak = 0;
      player.onFire = false;
      player.isCold = false;
      player.stats = defaultStats();
    });
    this.persist();
    return this.snapshot(roomCode);
  }

  multiplierForRemaining(remainingBeforeSelection: number, enabled = true): 1 | 2 | 3 {
    if (!enabled) return 1;
    if (remainingBeforeSelection >= 7) return 1;
    if (remainingBeforeSelection >= 4) return 2;
    return 3;
  }

  selectQuestion(roomCode: string, hostToken: string, questionId: string, dailyDoublePlayerId?: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'board' || !room.state.board) throw new Error('Board is not ready');
    const tile = room.state.board.questions.find((entry) => entry.questionId === questionId);
    const question = room.questions[questionId];
    if (!tile || !question || tile.used) throw new Error('Question is unavailable');
    const multiplier = this.multiplierForRemaining(room.state.remainingQuestions, room.state.settings.lateGameModifiers);
    tile.used = true;
    room.state.remainingQuestions -= 1;
    room.state.currentQuestion = {
      questionId,
      text: question.text,
      category: tile.category,
      baseValue: question.value,
      effectiveValue: question.value * multiplier,
      explanation: question.explanation,
      answerRevealed: false,
      acceptedAnswers: question.acceptedAnswers,
      dailyDouble: tile.dailyDouble,
      dailyDoublePlayerId: null,
      wager: null,
      buzzOpen: false,
      buzzWinnerId: null,
      buzzOpenedAt: null,
      attemptedPlayerIds: []
    };
    room.state.players.forEach((player) => {
      player.buzzEligible = false;
      player.hasBuzzedThisQuestion = false;
    });
    if (tile.dailyDouble && room.state.players.length > 0) {
      const player = room.state.players.find((item) => item.id === dailyDoublePlayerId) ?? room.state.players[0];
      room.state.currentQuestion.dailyDoublePlayerId = player.id;
      player.stats.dailyDoublesFound += 1;
      room.state.phase = 'daily-double-wager';
    } else {
      room.state.phase = 'question';
    }
    this.persist();
    return this.snapshot(roomCode);
  }

  setDailyDoubleWager(roomCode: string, hostToken: string, wager: number): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    const current = room.state.currentQuestion;
    if (room.state.phase !== 'daily-double-wager' || !current?.dailyDoublePlayerId) throw new Error('No Daily Double wager is pending');
    const player = room.state.players.find((item) => item.id === current.dailyDoublePlayerId)!;
    const maximum = room.state.settings.allowWagerBeyondScore
      ? room.state.settings.maxWager
      : Math.min(room.state.settings.maxWager, Math.max(0, player.score));
    if (!Number.isInteger(wager) || wager < 0 || wager > maximum) throw new Error(`Wager must be between 0 and ${maximum}`);
    current.wager = wager;
    player.stats.biggestWager = Math.max(player.stats.biggestWager, wager);
    room.state.phase = 'daily-double-question';
    this.startTimerInternal(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  openBuzzers(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    const current = room.state.currentQuestion;
    if (room.state.phase !== 'question' || !current || current.dailyDouble) throw new Error('Buzzers cannot open now');
    current.buzzOpen = true;
    current.buzzWinnerId = null;
    current.buzzOpenedAt = Date.now();
    room.state.players.forEach((player) => {
      player.buzzEligible = room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(player.id);
    });
    this.startTimerInternal(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  closeBuzzers(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.currentQuestion) room.state.currentQuestion.buzzOpen = false;
    room.state.players.forEach((player) => { player.buzzEligible = false; });
    this.stopTimerInternal(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  buzz(roomCode: string, playerId: string, reconnectToken: string): { accepted: boolean; reason?: string; snapshot: RoomSnapshot } {
    const [room, player] = this.playerRoom(roomCode, playerId, reconnectToken);
    const current = room.state.currentQuestion;
    if (!current?.buzzOpen || current.buzzWinnerId) return { accepted: false, reason: 'Buzzers are locked', snapshot: this.snapshot(roomCode) };
    if (!player.buzzEligible || (!room.state.settings.allowRepeatBuzzAfterMiss && current.attemptedPlayerIds.includes(player.id))) {
      return { accepted: false, reason: 'You are not eligible to buzz', snapshot: this.snapshot(roomCode) };
    }
    current.buzzWinnerId = player.id;
    current.buzzOpen = false;
    current.attemptedPlayerIds.push(player.id);
    player.hasBuzzedThisQuestion = true;
    room.state.players.forEach((item) => { item.buzzEligible = false; });
    const latency = current.buzzOpenedAt ? Math.max(0, Date.now() - current.buzzOpenedAt) : null;
    if (latency !== null && (player.stats.fastestBuzzMs === null || latency < player.stats.fastestBuzzMs)) player.stats.fastestBuzzMs = latency;
    this.stopTimerInternal(room);
    this.persist();
    return { accepted: true, snapshot: this.snapshot(roomCode) };
  }

  localBuzz(roomCode: string, hostToken: string, playerId: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    const current = room.state.currentQuestion;
    const player = room.state.players.find((item) => item.id === playerId);
    if (!player || !current?.buzzOpen || current.buzzWinnerId || !player.buzzEligible) throw new Error('Local buzz is not valid');
    current.buzzWinnerId = player.id;
    current.buzzOpen = false;
    current.attemptedPlayerIds.push(player.id);
    player.hasBuzzedThisQuestion = true;
    room.state.players.forEach((item) => { item.buzzEligible = false; });
    this.stopTimerInternal(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  private applyStreak(player: Player, correct: boolean, settings: GameSettings): void {
    if (!settings.streaksEnabled) return;
    if (correct) {
      player.positiveStreak += 1;
      player.coldStreak = 0;
      player.onFire = player.positiveStreak >= 3;
      player.isCold = false;
      player.stats.longestStreak = Math.max(player.stats.longestStreak, player.positiveStreak);
    } else {
      player.coldStreak += 1;
      player.positiveStreak = 0;
      player.onFire = false;
      player.isCold = player.coldStreak >= settings.coldStreakThreshold;
      player.stats.longestColdStreak = Math.max(player.stats.longestColdStreak, player.coldStreak);
    }
  }

  private addScore(player: Player, delta: number, settings: GameSettings): void {
    const before = player.score;
    const after = settings.allowNegativeScores ? before + delta : Math.max(0, before + delta);
    const actualDelta = after - before;
    player.score = after;
    if (actualDelta >= 0) player.stats.pointsGained += actualDelta;
    else player.stats.pointsLost += Math.abs(actualDelta);
  }

  resolveAnswer(roomCode: string, hostToken: string, playerId: string, correct: boolean): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    const current = room.state.currentQuestion;
    const player = room.state.players.find((item) => item.id === playerId);
    if (!current || !player) throw new Error('No active answer to resolve');
    if (current.dailyDouble && current.dailyDoublePlayerId !== playerId) throw new Error('Only the Daily Double player can answer');
    if (!current.dailyDouble && current.buzzWinnerId !== playerId) throw new Error('Only the buzz winner can be resolved');
    let points = current.effectiveValue;
    if (current.dailyDouble) {
      const multiplier = room.state.settings.dailyDoubleStacksWithMultiplier
        ? this.multiplierForRemaining(room.state.remainingQuestions + 1, room.state.settings.lateGameModifiers)
        : 1;
      points = (current.wager ?? 0) * multiplier;
    }
    this.addScore(player, correct ? points : -points, room.state.settings);
    if (correct) player.stats.correct += 1;
    else player.stats.incorrect += 1;
    this.applyStreak(player, correct, room.state.settings);
    this.stopTimerInternal(room);

    if (correct || current.dailyDouble || !room.state.settings.stealsEnabled) {
      current.answerRevealed = true;
      current.buzzOpen = false;
    } else {
      current.buzzWinnerId = null;
      room.state.players.forEach((candidate) => {
        candidate.buzzEligible = room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(candidate.id);
      });
      const someoneEligible = room.state.players.some((candidate) => candidate.buzzEligible && candidate.connected);
      current.buzzOpen = someoneEligible;
      current.buzzOpenedAt = someoneEligible ? Date.now() : null;
      if (someoneEligible) this.startTimerInternal(room);
      else current.answerRevealed = true;
    }
    this.persist();
    return this.snapshot(roomCode);
  }

  revealAnswer(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    const current = room.state.currentQuestion;
    if (!current) throw new Error('No current question');
    current.answerRevealed = true;
    current.buzzOpen = false;
    room.state.players.forEach((player) => { player.buzzEligible = false; });
    this.stopTimerInternal(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  advanceToBoard(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (!room.state.currentQuestion) throw new Error('No question to finish');
    room.state.currentQuestion = null;
    this.stopTimerInternal(room);
    if (room.state.remainingQuestions === 0) {
      if (room.state.settings.finalRoundEnabled && room.state.players.length > 0) this.prepareFinalRound(room);
      else this.finishGame(room);
    } else {
      room.state.multiplier = this.multiplierForRemaining(room.state.remainingQuestions, room.state.settings.lateGameModifiers);
      room.state.phase = 'board';
    }
    this.persist();
    return this.snapshot(roomCode);
  }

  adjustScore(roomCode: string, hostToken: string, playerId: string, delta: number): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    const player = room.state.players.find((item) => item.id === playerId);
    if (!player || !Number.isFinite(delta) || Math.abs(delta) > 100_000) throw new Error('Invalid score adjustment');
    this.addScore(player, Math.round(delta), room.state.settings);
    this.persist();
    return this.snapshot(roomCode);
  }

  pause(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase === 'paused') return this.snapshot(roomCode);
    room.state.previousPhase = room.state.phase;
    room.state.phase = 'paused';
    if (room.state.timer.running && room.state.timer.endsAt) room.state.timer.remainingMs = Math.max(0, room.state.timer.endsAt - Date.now());
    room.state.timer.running = false;
    room.state.timer.endsAt = null;
    this.persist();
    return this.snapshot(roomCode);
  }

  resume(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'paused') throw new Error('Game is not paused');
    room.state.phase = room.state.previousPhase ?? 'board';
    room.state.previousPhase = null;
    if (room.state.timer.remainingMs && room.state.timer.remainingMs > 0) {
      room.state.timer.running = true;
      room.state.timer.endsAt = Date.now() + room.state.timer.remainingMs;
    }
    this.persist();
    return this.snapshot(roomCode);
  }

  private startTimerInternal(room: RoomRecord): void {
    const seconds = room.state.settings.timerSeconds;
    if (!seconds) {
      room.state.timer = emptyTimer();
      return;
    }
    const durationMs = seconds * 1000;
    room.state.timer = { running: true, durationMs, endsAt: Date.now() + durationMs, remainingMs: durationMs };
  }

  startTimer(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    this.startTimerInternal(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  stopTimer(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    this.stopTimerInternal(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  private stopTimerInternal(room: RoomRecord): void {
    room.state.timer = emptyTimer();
  }

  tick(now = Date.now()): string[] {
    const changed: string[] = [];
    for (const [code, room] of this.rooms) {
      if (room.state.expiresAt <= now) {
        this.rooms.delete(code);
        changed.push(code);
        continue;
      }
      if (room.state.timer.running && room.state.timer.endsAt && room.state.timer.endsAt <= now) {
        room.state.timer = emptyTimer();
        if (room.state.settings.autoCloseBuzzersAtZero && room.state.currentQuestion?.buzzOpen) {
          room.state.currentQuestion.buzzOpen = false;
          room.state.players.forEach((player) => { player.buzzEligible = false; });
        }
        changed.push(code);
      }
    }
    if (changed.length) this.persist();
    return changed;
  }

  private prepareFinalRound(room: RoomRecord): void {
    const selected = room.state.selectedPackIds.flatMap((packId) => this.packs.get(packId)?.questions ?? []);
    const candidates = selected.filter((question) => !room.questions[question.id] && !this.seenQuestionIds.has(question.id));
    const fallback = selected.filter((question) => !room.questions[question.id]);
    const question = this.shuffle(candidates.length ? candidates : fallback)[0];
    if (!question) return this.finishGame(room);
    room.questions[question.id] = question;
    room.finalQuestionId = question.id;
    room.state.finalRound = {
      category: question.category,
      question: question.text,
      acceptedAnswers: question.acceptedAnswers,
      explanation: question.explanation,
      reviewPlayerIndex: 0
    };
    room.state.players.forEach((player) => {
      player.finalWager = null;
      player.finalWagerSubmitted = false;
      player.finalAnswer = null;
      player.finalAnswerSubmitted = false;
      player.finalResolved = false;
    });
    room.state.phase = 'final-category';
  }

  beginFinalWagers(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'final-category') throw new Error('Final Round is not ready for wagers');
    room.state.phase = 'final-wager';
    this.persist();
    return this.snapshot(roomCode);
  }

  submitFinalWager(roomCode: string, playerId: string, reconnectToken: string, wager: number): RoomSnapshot {
    const [room, player] = this.playerRoom(roomCode, playerId, reconnectToken);
    if (room.state.phase !== 'final-wager') throw new Error('Final wagers are closed');
    const max = room.state.settings.allowWagerBeyondScore
      ? room.state.settings.maxWager
      : Math.min(room.state.settings.maxWager, Math.max(0, player.score));
    if (!Number.isInteger(wager) || wager < 0 || wager > max) throw new Error(`Wager must be between 0 and ${max}`);
    player.finalWager = wager;
    player.finalWagerSubmitted = true;
    player.stats.biggestWager = Math.max(player.stats.biggestWager, wager);
    this.persist();
    return this.snapshot(roomCode);
  }

  openFinalQuestion(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'final-wager') throw new Error('Final wagers are not active');
    if (room.state.players.some((player) => player.finalWager === null)) throw new Error('All players must submit a wager');
    room.state.phase = 'final-question';
    this.startTimerInternal(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  submitFinalAnswer(roomCode: string, playerId: string, reconnectToken: string, answer: string): RoomSnapshot {
    const [room, player] = this.playerRoom(roomCode, playerId, reconnectToken);
    if (room.state.phase !== 'final-question') throw new Error('Final answers are closed');
    player.finalAnswer = answer.slice(0, 200);
    player.finalAnswerSubmitted = true;
    this.persist();
    return this.snapshot(roomCode);
  }

  beginFinalReview(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'final-question') throw new Error('Final question is not active');
    room.state.phase = 'final-review';
    this.stopTimerInternal(room);
    if (room.state.finalRound) room.state.finalRound.reviewPlayerIndex = 0;
    this.persist();
    return this.snapshot(roomCode);
  }

  resolveFinalAnswer(roomCode: string, hostToken: string, playerId: string, correct?: boolean): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'final-review' || !room.state.finalRound) throw new Error('Final answers are not under review');
    const player = room.state.players.find((item) => item.id === playerId);
    if (!player || player.finalResolved) throw new Error('Player final answer is unavailable');
    const matched = player.finalAnswer ? answerMatches(player.finalAnswer, room.state.finalRound.acceptedAnswers) : false;
    const isCorrect = correct ?? matched;
    const wager = player.finalWager ?? 0;
    this.addScore(player, isCorrect ? wager : -wager, room.state.settings);
    if (isCorrect) player.stats.correct += 1;
    else player.stats.incorrect += 1;
    player.finalResolved = true;
    const nextIndex = room.state.players.findIndex((candidate) => !candidate.finalResolved);
    if (nextIndex === -1) this.finishGame(room);
    else room.state.finalRound.reviewPlayerIndex = nextIndex;
    this.persist();
    return this.snapshot(roomCode);
  }

  private finishGame(room: RoomRecord): void {
    room.state.phase = 'recap';
    room.state.gameEndedAt = Date.now();
    this.stopTimerInternal(room);
  }

  endGame(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    this.finishGame(room);
    this.persist();
    return this.snapshot(roomCode);
  }
}
