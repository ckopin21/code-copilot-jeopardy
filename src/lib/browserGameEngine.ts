import { DEFAULT_SETTINGS, GAME_LENGTH_CONFIG } from '../shared/config';
import type { BoardQuestion, GameSettings, HostRoomCredentials, Player, PlayerJoinCredentials, Question, QuestionPack, RoomSnapshot, RoomState } from '../shared/types';
import { QUESTION_VALUES } from '../shared/types';
import { autoGradeAnswer } from '../shared/validation';
import { packMap, packSupportsGameMode, packsForGameMode } from '../packs';
import { calculateComebackAward } from './comebackScoring';
import { finalWagerRules } from './finalWagerRules';
import { gameModeAllowsDailyDoubles, gameModePenalizesTypedTimeout, isGameMode, responseModeForGameMode } from '../shared/gameModes';
import { randomId } from './ids';
import { normalizePlayerCustomization, type PlayerCustomizationFields } from '../shared/playerCustomization';

export interface RoomRecord {
  state: RoomState;
  hostToken: string;
  playerTokens: Record<string, string>;
  questions: Record<string, Question>;
  finalQuestionId: string | null;
  /** One-level scoring checkpoint used by the host Undo control. */
  undoState?: RoomState | null;
}
export interface RandomSource { next(): number }
class MathRandomSource implements RandomSource { next(): number { return Math.random(); } }

const STORAGE_KEY = 'blue-stage-p2p-engine-v2';
const STORAGE_BACKUP_KEY = 'blue-stage-p2p-engine-v2-backup';
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const emptyTimer = () => ({ running: false, durationMs: null, endsAt: null, remainingMs: null });
const roomCodeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomToken(bytes = 24): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  let binary = '';
  for (const value of buffer) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function id(prefix: string): string { return randomId(prefix); }
function secureEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}
function defaultStats() {
  return { correct: 0, incorrect: 0, longestStreak: 0, longestColdStreak: 0, dailyDoublesFound: 0, biggestWager: 0, fastestBuzzMs: null, pointsGained: 0, pointsLost: 0 };
}
function loadRooms(): { rooms: RoomRecord[]; readable: boolean } {
  const parse = (raw: string | null): RoomRecord[] | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as RoomRecord[];
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };
  try {
    return {
      rooms: parse(localStorage.getItem(STORAGE_KEY)) ?? parse(localStorage.getItem(STORAGE_BACKUP_KEY)) ?? [],
      readable: true
    };
  } catch {
    return { rooms: [], readable: false };
  }
}
function validStoredRooms(raw: string | null): boolean {
  if (!raw) return false;
  try { return Array.isArray(JSON.parse(raw)); }
  catch { return false; }
}
function preferredDifficulty(value: number): Question['difficulty'] {
  if (value <= 200) return 'easy';
  if (value === 300) return 'medium';
  return 'hard';
}
function normalizeFreeResponseReadSeconds(value: unknown, fallback = 5): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(30, Math.max(0, Math.round(numeric)));
}

export class BrowserGameEngine {
  private rooms = new Map<string, RoomRecord>();
  private seenQuestionIds = new Set<string>();
  private persistenceHealthy = true;

  constructor(private readonly random: RandomSource = new MathRandomSource(), private readonly roomTtlMs = ROOM_TTL_MS) {
    const now = Date.now();
    const loaded = loadRooms();
    for (const record of loaded.rooms) {
      try {
      if (record.state.expiresAt <= now) continue;
      // Session locking was removed from the product. Normalize older persisted rooms so they remain joinable.
      record.state.locked = false;
      record.state.revision ??= 0;
      record.state.settings.lockRoomOnStart = false;
      record.state.settings.turnOrderMode ??= 'join-order';
      record.state.settings.gameMode ??= 'classic';
      record.state.settings.freeResponseReadSeconds = normalizeFreeResponseReadSeconds(record.state.settings.freeResponseReadSeconds, 5);
      // Steals are not part of the current reveal-first product flow. Keep restored legacy rooms aligned with the live UI.
      record.state.settings.stealsEnabled = false;
      record.state.turnPlayerId ??= null;
      if (record.state.currentQuestion && !record.state.currentQuestion.participantIds) {
        record.state.currentQuestion.participantIds = record.state.players.map((player) => player.id);
      }
      if (record.state.currentQuestion) {
        record.state.currentQuestion.resolvedPlayerId ??= null;
        record.state.currentQuestion.responseOpensAt ??= null;
        record.state.currentQuestion.responseReadRemainingMs ??= null;
        for (const response of Object.values(record.state.currentQuestion.textResponses ?? {})) {
          response.reviewCorrect ??= response.autoCorrect;
        }
      }
      const claimedSeats = new Set<number>();
      for (const player of record.state.players) {
        // Titles were removed from customization. Strip the legacy field while restoring old saves.
        delete (player as Player & { title?: unknown }).title;
        const currentSeat = Number(player.seat);
        if (Number.isInteger(currentSeat) && currentSeat >= 1 && currentSeat <= 5 && !claimedSeats.has(currentSeat)) {
          claimedSeats.add(currentSeat);
          player.seat = currentSeat;
        } else {
          const replacement = [1, 2, 3, 4, 5].find((seat) => !claimedSeats.has(seat)) ?? 5;
          player.seat = replacement;
          claimedSeats.add(replacement);
        }
      }
      record.undoState ??= null;
      const previouslyConnected = record.state.players.filter((player) => player.connected).map((player) => player.id);
      record.state.hostConnected = false;
      record.state.players.forEach((player) => { player.connected = false; });
      if (record.state.finalRound) {
        const finalRound = record.state.finalRound;
        finalRound.participantIds ??= previouslyConnected.length ? previouslyConnected : record.state.players.map((player) => player.id);
        finalRound.rosterIds ??= record.state.players.map((player) => player.id);
        finalRound.responsesClosed ??= record.state.phase === 'final-review' || record.state.phase === 'recap';
        if (record.state.phase === 'final-review') {
          const unresolved = (playerId: string) => {
            const candidate = record.state.players.find((player) => player.id === playerId);
            return Boolean(candidate && !candidate.finalResolved);
          };
          if (!finalRound.reviewPlayerId || !unresolved(finalRound.reviewPlayerId)) {
            const legacyId = record.state.players[finalRound.reviewPlayerIndex]?.id;
            finalRound.reviewPlayerId = legacyId && finalRound.participantIds.includes(legacyId) && unresolved(legacyId)
              ? legacyId
              : finalRound.participantIds.find(unresolved) ?? null;
          }
          finalRound.reviewPlayerIndex = finalRound.reviewPlayerId
            ? Math.max(0, finalRound.participantIds.indexOf(finalRound.reviewPlayerId))
            : 0;
        }
      }
      for (const question of record.state.board?.questions ?? []) {
        for (const result of question.results ?? []) delete (result as typeof result & { playerTitle?: unknown }).playerTitle;
      }
      if (record.state.phase === 'recap' && record.state.resultPlayerIds === undefined) {
        record.state.resultPlayerIds = record.state.finalRound?.rosterIds ?? record.state.players.map((player) => player.id);
      }
      if (record.state.timer.running && record.state.timer.endsAt) {
        record.state.timer.remainingMs = Math.max(0, record.state.timer.endsAt - now);
      }
      this.rooms.set(record.state.code, record);
      for (const questionId of Object.keys(record.questions)) this.seenQuestionIds.add(questionId);
      } catch {
        // Skip a malformed room record instead of crashing the entire game on startup.
        continue;
      }
    }
    const changed = this.tick(now);
    if (loaded.readable && !changed.length) this.persist();
    else if (!loaded.readable) this.reportPersistence(false);
  }

  private reportPersistence(ok: boolean): void {
    if (this.persistenceHealthy === ok) return;
    this.persistenceHealthy = ok;
    if (typeof window === 'undefined') return;
    (window as typeof window & { BLUE_STAGE_PERSISTENCE_OK?: boolean }).BLUE_STAGE_PERSISTENCE_OK = ok;
    window.dispatchEvent(new CustomEvent('blue-stage:persistence-status', { detail: { ok } }));
  }
  private persist(): void {
    try {
      for (const room of this.rooms.values()) room.state.revision = (room.state.revision ?? 0) + 1;
      const serialized = JSON.stringify([...this.rooms.values()]);
      const previous = localStorage.getItem(STORAGE_KEY);
      if (previous && previous !== serialized && validStoredRooms(previous)) localStorage.setItem(STORAGE_BACKUP_KEY, previous);
      localStorage.setItem(STORAGE_KEY, serialized);
      this.reportPersistence(true);
    } catch {
      // Keep the in-memory game running, but make recovery failure visible to the host.
      this.reportPersistence(false);
    }
  }
  private touch(room: RoomRecord): void { room.state.expiresAt = Date.now() + this.roomTtlMs; }
  private clearUndo(room: RoomRecord): void { room.undoState = null; }
  private checkpointScore(room: RoomRecord): void { room.undoState = structuredClone(room.state); }
  private code(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      let value = '';
      for (let index = 0; index < 5; index += 1) value += roomCodeAlphabet[Math.floor(this.random.next() * roomCodeAlphabet.length)];
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
    if (!secureEqual(room.hostToken, hostToken)) throw new Error('Host authorization failed');
    this.touch(room);
    return room;
  }
  private playerRoom(roomCode: string, playerId: string, reconnectToken: string): [RoomRecord, Player] {
    const room = this.room(roomCode);
    const expected = room.playerTokens[playerId];
    if (!expected || !secureEqual(expected, reconnectToken)) throw new Error('Player authorization failed');
    const player = room.state.players.find((item) => item.id === playerId);
    if (!player) throw new Error('Player not found');
    this.touch(room);
    return [room, player];
  }
  private assertGameContext(room: RoomRecord, expectedGameStartedAt?: number): void {
    if (expectedGameStartedAt !== undefined && room.state.gameStartedAt !== expectedGameStartedAt) {
      throw new Error('This action belongs to an older game');
    }
  }
  private assertQuestionContext(room: RoomRecord, expectedQuestionId?: string, expectedGameStartedAt?: number): void {
    this.assertGameContext(room, expectedGameStartedAt);
    if (expectedQuestionId !== undefined && room.state.currentQuestion?.questionId !== expectedQuestionId) {
      throw new Error('This action belongs to an older question');
    }
  }
  private connectedPlayers(room: RoomRecord): Player[] { return room.state.players.filter((player) => player.connected).sort((a, b) => a.seat - b.seat); }
  private nextConnectedAfterSeat(room: RoomRecord, seat: number): Player | null {
    const connected = this.connectedPlayers(room);
    if (!connected.length) return null;
    return connected.find((player) => player.seat > seat) ?? connected[0];
  }
  private currentQuestionParticipants(room: RoomRecord): Player[] {
    const ids = room.state.currentQuestion?.participantIds;
    if (!ids) return this.connectedPlayers(room);
    const eligible = new Set(ids);
    // Keep the roster frozen for the whole typed question. A transient disconnect
    // must not make everyone else appear "done" and prematurely reveal the answer.
    return room.state.players
      .filter((player) => eligible.has(player.id))
      .sort((a, b) => a.seat - b.seat);
  }
  private ensureTurnPlayer(room: RoomRecord): Player | null {
    const connected = this.connectedPlayers(room);
    if (!connected.length) { room.state.turnPlayerId = null; return null; }
    const current = connected.find((player) => player.id === room.state.turnPlayerId);
    if (current) return current;
    const priorSeat = room.state.players.find((player) => player.id === room.state.turnPlayerId)?.seat ?? 0;
    const replacement = this.nextConnectedAfterSeat(room, priorSeat) ?? connected[0];
    room.state.turnPlayerId = replacement.id;
    return replacement;
  }
  private advanceTurn(room: RoomRecord): void {
    if (room.state.settings.turnOrderMode === 'manual') { this.ensureTurnPlayer(room); return; }
    const currentSeat = room.state.players.find((player) => player.id === room.state.turnPlayerId)?.seat ?? 0;
    const next = this.nextConnectedAfterSeat(room, currentSeat);
    room.state.turnPlayerId = next?.id ?? null;
  }
  private finalParticipants(room: RoomRecord): Player[] {
    const ids = new Set(room.state.finalRound?.participantIds ?? []);
    return room.state.players.filter((player) => ids.has(player.id)).sort((a, b) => a.seat - b.seat);
  }
  private activeFinalParticipants(room: RoomRecord): Player[] { return this.finalParticipants(room).filter((player) => player.connected); }
  private setNextFinalReviewPlayer(room: RoomRecord): void {
    const finalRound = room.state.finalRound;
    if (!finalRound) return;
    const nextId = finalRound.participantIds.find((playerId) => {
      const player = room.state.players.find((candidate) => candidate.id === playerId);
      return Boolean(player && !player.finalResolved);
    });
    if (!nextId) {
      finalRound.reviewPlayerId = null;
      this.finishGame(room);
      return;
    }
    finalRound.reviewPlayerId = nextId;
    finalRound.reviewPlayerIndex = Math.max(0, finalRound.participantIds.indexOf(nextId));
  }

  snapshot(roomCode: string): RoomSnapshot {
    const state = structuredClone(this.room(roomCode).state);
    state.players.sort((a, b) => a.seat - b.seat);
    if (state.timer.running && state.timer.endsAt) state.timer.remainingMs = Math.max(0, state.timer.endsAt - Date.now());
    return { ...state, serverNow: Date.now() };
  }

  createRoom(baseUrl: string, settings?: Partial<GameSettings>): HostRoomCredentials {
    const code = this.code();
    const hostToken = randomToken();
    const gameMode = settings?.gameMode ?? DEFAULT_SETTINGS.gameMode;
    const requestedPackIds = settings?.selectedPackIds?.length ? settings.selectedPackIds : DEFAULT_SETTINGS.selectedPackIds;
    const requestedPacks = requestedPackIds.map((packId) => packMap.get(packId)).filter((pack): pack is QuestionPack => Boolean(pack));
    const requestedPacksCompatible = requestedPacks.length === requestedPackIds.length && requestedPacks.every((pack) => packSupportsGameMode(pack, gameMode));
    const fallbackPack = packsForGameMode(gameMode)[0];
    if (!fallbackPack && !requestedPacksCompatible) throw new Error(`No question packs are available for ${gameMode}`);
    const selectedPackIds = requestedPacksCompatible ? requestedPackIds : [fallbackPack!.id];
    const freeResponseReadSeconds = normalizeFreeResponseReadSeconds(settings?.freeResponseReadSeconds ?? DEFAULT_SETTINGS.freeResponseReadSeconds);
    const state: RoomState = {
      code,
      phase: 'lobby',
      previousPhase: null,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.roomTtlMs,
      revision: 0,
      hostConnected: true,
      locked: false,
      players: [],
      settings: { ...DEFAULT_SETTINGS, ...settings, gameMode, selectedPackIds, freeResponseReadSeconds, lockRoomOnStart: false, stealsEnabled: false },
      board: null,
      currentQuestion: null,
      timer: emptyTimer(),
      multiplier: 1,
      turnPlayerId: null,
      remainingQuestions: 0,
      selectedPackIds,
      finalRound: null,
      resultPlayerIds: [],
      gameStartedAt: null,
      gameEndedAt: null
    };
    this.rooms.set(code, { state, hostToken, playerTokens: {}, questions: {}, finalQuestionId: null, undoState: null });
    this.persist();
    const root = baseUrl.replace(/\/$/, '');
    return { roomCode: code, hostToken, joinUrl: `${root}/?mode=player&room=${code}`, presentationUrl: `${root}/?mode=presentation&room=${code}` };
  }

  deleteRoom(roomCode: string): void { this.rooms.delete(roomCode.toUpperCase()); this.persist(); }
  reconnectHost(roomCode: string, hostToken: string): RoomSnapshot { const room = this.hostRoom(roomCode, hostToken); room.state.hostConnected = true; this.persist(); return this.snapshot(roomCode); }
  setHostConnected(roomCode: string, connected: boolean): void { const room = this.room(roomCode); room.state.hostConnected = connected; this.touch(room); this.persist(); }

  joinPlayer(roomCode: string, input: { name: string; avatar: string; accent: string } & PlayerCustomizationFields): PlayerJoinCredentials {
    const room = this.room(roomCode);
    if (room.state.players.length >= 5) throw new Error('Room already has 5 players');
    const occupiedSeats = new Set(room.state.players.map((player) => player.seat));
    const seat = [1, 2, 3, 4, 5].find((candidate) => !occupiedSeats.has(candidate));
    if (!seat) throw new Error('No player seat is available');
    const playerId = id('player');
    const reconnectToken = randomToken();
    const duplicateCount = room.state.players.filter((player) => player.name.toLowerCase() === input.name.toLowerCase()).length;
    const name = duplicateCount ? `${input.name} ${duplicateCount + 1}` : input.name;
    const finalRosterFrozen = Boolean(room.state.finalRound);
    const customization = normalizePlayerCustomization(input);
    room.state.players.push({
      id: playerId, seat, name, avatar: input.avatar, avatarId: customization.avatarId, accent: input.accent,
      frameStyle: customization.frameStyle, buzzerSound: customization.buzzerSound,
      scoreEffect: customization.scoreEffect, victoryEffect: customization.victoryEffect, score: 0, connected: true,
      positiveStreak: 0, coldStreak: 0, onFire: false, isCold: false, buzzEligible: false, hasBuzzedThisQuestion: false,
      finalWager: finalRosterFrozen ? 0 : null,
      finalWagerSubmitted: finalRosterFrozen,
      finalAnswer: null,
      finalAnswerSubmitted: finalRosterFrozen,
      finalResolved: finalRosterFrozen,
      stats: defaultStats()
    });
    room.state.players.sort((a, b) => a.seat - b.seat);
    if (!room.state.turnPlayerId) room.state.turnPlayerId = playerId;
    room.playerTokens[playerId] = reconnectToken;
    this.touch(room);
    this.persist();
    return { playerId, reconnectToken, roomCode: room.state.code };
  }

  reconnectPlayer(roomCode: string, playerId: string, reconnectToken: string): PlayerJoinCredentials {
    const [room, player] = this.playerRoom(roomCode, playerId, reconnectToken);
    player.connected = true;
    const current = room.state.currentQuestion;
    if (room.state.phase === 'board') this.ensureTurnPlayer(room);
    if (current?.buzzOpen && !current.buzzWinnerId && current.responseMode !== 'text') {
      const participating = !current.participantIds || current.participantIds.includes(player.id);
      player.buzzEligible = participating && (room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(player.id));
    }
    this.persist();
    return { playerId, reconnectToken, roomCode: room.state.code };
  }
  setPlayerConnected(roomCode: string, playerId: string, connected: boolean): void {
    const room = this.room(roomCode);
    const player = room.state.players.find((item) => item.id === playerId);
    if (!player) return;
    player.connected = connected;
    if (!connected) {
      // A transient disconnect must not permanently close a typed/Final response window.
      // Timers or the host still close those phases; reconnecting players can continue if time remains.
      player.buzzEligible = false;
    } else {
      const current = room.state.currentQuestion;
      if (current?.buzzOpen && !current.buzzWinnerId && current.responseMode !== 'text') {
        const participating = !current.participantIds || current.participantIds.includes(player.id);
        player.buzzEligible = participating && (room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(player.id));
      }
    }
    if (room.state.phase === 'board') this.ensureTurnPlayer(room);
    this.touch(room);
    this.persist();
  }
  suspendPlayer(roomCode: string, hostToken: string, playerId: string): void {
    const room = this.hostRoom(roomCode, hostToken);
    const player = room.state.players.find((item) => item.id === playerId);
    if (!player) throw new Error('Player not found');
    this.setPlayerConnected(roomCode, playerId, false);
  }

  renamePlayer(roomCode: string, hostToken: string, playerId: string, requestedName: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    const player = room.state.players.find((item) => item.id === playerId);
    if (!player) throw new Error('Player not found');
    const clean = requestedName.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!clean) throw new Error('Enter a player name');
    const duplicateCount = room.state.players.filter((candidate) => candidate.id !== playerId && candidate.name.toLowerCase() === clean.toLowerCase()).length;
    player.name = duplicateCount ? `${clean} ${duplicateCount + 1}`.slice(0, 24) : clean;
    this.persist();
    return this.snapshot(roomCode);
  }

  setTurnPlayer(roomCode: string, hostToken: string, playerId: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'board') throw new Error('Turn selection is only available on the board');
    const player = this.connectedPlayers(room).find((candidate) => candidate.id === playerId);
    if (!player) throw new Error('Choose a connected player');
    room.state.turnPlayerId = player.id;
    this.persist();
    return this.snapshot(roomCode);
  }

  removePlayer(roomCode: string, hostToken: string, playerId: string): void {
    const room = this.hostRoom(roomCode, hostToken);
    const player = room.state.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new Error('Player not found');
    const current = room.state.currentQuestion;
    if (current?.dailyDoublePlayerId === playerId && (room.state.phase === 'daily-double-wager' || room.state.phase === 'daily-double-question')) {
      throw new Error('Finish or exit the active Daily Double before removing this player');
    }

    this.clearUndo(room);
    const removedBuzzWinner = current?.buzzWinnerId === playerId && !current.answerRevealed;
    const removedTurnOwner = room.state.turnPlayerId === playerId;
    const removedSeat = player.seat;
    if (current?.textResponses?.[playerId]) delete current.textResponses[playerId];
    room.state.players = room.state.players.filter((candidate) => candidate.id !== playerId);
    delete room.playerTokens[playerId];
    if (removedTurnOwner) room.state.turnPlayerId = this.nextConnectedAfterSeat(room, removedSeat)?.id ?? null;

    if (current && room.state.phase === 'question' && !current.answerRevealed) {
      if (current.responseMode === 'text') {
        const active = this.currentQuestionParticipants(room);
        if (active.length === 0 || active.every((candidate) => Boolean(current.textResponses?.[candidate.id]))) this.closeTextResponsesInternal(room);
      } else if (removedBuzzWinner) {
        current.buzzWinnerId = null;
        const participants = new Set(current.participantIds ?? room.state.players.map((candidate) => candidate.id));
        room.state.players.forEach((candidate) => {
          candidate.buzzEligible = candidate.connected && participants.has(candidate.id) && (room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(candidate.id));
        });
        const someoneEligible = room.state.players.some((candidate) => candidate.buzzEligible);
        current.buzzOpen = someoneEligible;
        current.buzzOpenedAt = someoneEligible ? Date.now() : null;
        if (someoneEligible) this.startTimerInternal(room);
        else {
          current.answerRevealed = true;
          this.stopTimerInternal(room);
        }
      }
    }

    if (room.state.finalRound) {
      room.state.finalRound.participantIds = room.state.finalRound.participantIds.filter((idValue) => idValue !== playerId);
      room.state.finalRound.rosterIds = (room.state.finalRound.rosterIds ?? []).filter((idValue) => idValue !== playerId);
      if (room.state.phase === 'final-question' && !room.state.finalRound.responsesClosed) {
        const active = this.activeFinalParticipants(room);
        if (active.length === 0 || active.every((candidate) => candidate.finalAnswerSubmitted)) this.closeFinalResponsesInternal(room);
      }
      if (room.state.phase === 'final-review') this.setNextFinalReviewPlayer(room);
    }
    if (room.state.resultPlayerIds?.length) room.state.resultPlayerIds = room.state.resultPlayerIds.filter((idValue) => idValue !== playerId);
    this.persist();
  }

  undoLastScoreAction(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (!room.undoState) throw new Error('There is no scoring action to undo');
    const currentIds = room.state.players.map((player) => player.id).sort();
    const savedIds = room.undoState.players.map((player) => player.id).sort();
    if (currentIds.join('|') !== savedIds.join('|')) {
      this.clearUndo(room);
      throw new Error('Undo is unavailable after the player roster changed');
    }
    const connectionState = new Map(room.state.players.map((player) => [player.id, player.connected]));
    const hostConnected = room.state.hostConnected;
    const expiresAt = room.state.expiresAt;
    const restored = structuredClone(room.undoState);
    restored.players.forEach((player) => { player.connected = connectionState.get(player.id) ?? false; });
    restored.hostConnected = hostConnected;
    restored.expiresAt = expiresAt;
    restored.revision = Math.max(restored.revision ?? 0, room.state.revision ?? 0);
    room.state = restored;
    this.clearUndo(room);
    this.touch(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  updateSettings(roomCode: string, hostToken: string, updates: Partial<GameSettings>): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'lobby') throw new Error('Settings can only be changed in the lobby');
    const gameMode = updates.gameMode ?? room.state.settings.gameMode ?? 'classic';
    if (!isGameMode(gameMode)) throw new Error('Choose a valid game mode');

    const requestedPackIds = updates.selectedPackIds ?? room.state.settings.selectedPackIds;
    if (!requestedPackIds.length || requestedPackIds.some((packId) => !packMap.get(packId))) throw new Error('Select at least one valid pack');
    const requestedPacks = requestedPackIds.map((packId) => packMap.get(packId)!);
    const compatible = requestedPacks.every((pack) => packSupportsGameMode(pack, gameMode));
    let selectedPackIds = requestedPackIds;

    if (!compatible) {
      if (updates.selectedPackIds) throw new Error('That question pack is not available for this game mode');
      const fallbackPack = packsForGameMode(gameMode)[0];
      if (!fallbackPack) throw new Error('No question packs are available for this game mode');
      selectedPackIds = [fallbackPack.id];
    }

    const freeResponseReadSeconds = normalizeFreeResponseReadSeconds(
      updates.freeResponseReadSeconds ?? room.state.settings.freeResponseReadSeconds,
      room.state.settings.freeResponseReadSeconds
    );
    room.state.settings = { ...room.state.settings, ...updates, gameMode, selectedPackIds, freeResponseReadSeconds, lockRoomOnStart: false, stealsEnabled: false };
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
  private getPack(packId: string): QuestionPack | undefined { return packMap.get(packId); }

  private generateBoard(settings: GameSettings): { board: RoomState['board']; questions: Record<string, Question> } {
    const config = GAME_LENGTH_CONFIG[settings.gameLength];
    const selectedPacks = settings.selectedPackIds.map((packId) => this.getPack(packId)).filter((pack): pack is QuestionPack => Boolean(pack));
    if (!selectedPacks.length || selectedPacks.some((pack) => !packSupportsGameMode(pack, settings.gameMode))) {
      throw new Error('Selected question packs do not match this game mode');
    }
    const pool = selectedPacks.flatMap((pack) => pack.questions.filter((question) => question.id !== pack.finalQuestionId));
    if (!pool.length) throw new Error('No questions available');
    const categoryGroups = new Map<string, Question[]>();
    for (const question of pool) {
      const key = settings.mixedPacks ? `${question.packId} · ${question.category}` : question.category;
      const list = categoryGroups.get(key) ?? [];
      list.push(question);
      categoryGroups.set(key, list);
    }
    let usable = [...categoryGroups.entries()].filter(([, questions]) => QUESTION_VALUES.slice(0, config.rows).every((value) => questions.some((question) => question.value === value)));
    usable.sort((a, b) => b[1].filter((question) => !this.seenQuestionIds.has(question.id)).length - a[1].filter((question) => !this.seenQuestionIds.has(question.id)).length);
    const orderedCategories = selectedPacks.length === 1 ? selectedPacks[0].categoryOrder ?? [] : [];
    if (!settings.randomizeCategories && orderedCategories.length) {
      const order = new Map(orderedCategories.map((category, index) => [category, index]));
      usable.sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999));
    } else if (settings.randomizeCategories) {
      usable = this.shuffle(usable);
    }
    const chosen = usable.slice(0, config.categories);
    if (chosen.length < config.categories) throw new Error('Selected packs do not contain enough complete categories for this game length');
    const boardQuestions: BoardQuestion[] = [];
    const questions: Record<string, Question> = {};
    for (const [categoryName, sourceQuestions] of chosen) {
      for (const value of QUESTION_VALUES.slice(0, config.rows)) {
        const candidates = sourceQuestions.filter((question) => question.value === value);
        const preferred = preferredDifficulty(value);
        const unseen = candidates.filter((question) => !this.seenQuestionIds.has(question.id));
        const difficultyMatchedUnseen = unseen.filter((question) => question.difficulty === preferred);
        const difficultyMatched = candidates.filter((question) => question.difficulty === preferred);
        const selectionPool = difficultyMatchedUnseen.length ? difficultyMatchedUnseen : unseen.length ? unseen : difficultyMatched.length ? difficultyMatched : candidates;
        const chosenQuestion = this.shuffle(selectionPool)[0];
        questions[chosenQuestion.id] = chosenQuestion;
        boardQuestions.push({ questionId: chosenQuestion.id, category: categoryName, value: chosenQuestion.value, used: false, dailyDouble: false, playedValue: undefined, results: [] });
        this.seenQuestionIds.add(chosenQuestion.id);
      }
    }
    if (settings.dailyDoublesEnabled && gameModeAllowsDailyDoubles(settings)) {
      const eligible = this.shuffle(boardQuestions.filter((entry) => questions[entry.questionId].dailyDoubleEligible !== false));
      for (const entry of eligible.slice(0, Math.min(settings.dailyDoubleCount, eligible.length))) entry.dailyDouble = true;
    }
    return { board: { categories: chosen.map(([name]) => name), questions: boardQuestions }, questions };
  }

  private resetPlayerForGame(player: Player): void {
    player.score = 0;
    player.positiveStreak = 0;
    player.coldStreak = 0;
    player.onFire = false;
    player.isCold = false;
    player.buzzEligible = false;
    player.hasBuzzedThisQuestion = false;
    player.finalWager = null;
    player.finalWagerSubmitted = false;
    player.finalAnswer = null;
    player.finalAnswerSubmitted = false;
    player.finalResolved = false;
    player.stats = defaultStats();
  }

  resetGame(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    this.clearUndo(room);
    for (const questionId of Object.keys(room.questions)) this.seenQuestionIds.delete(questionId);
    room.questions = {};
    room.finalQuestionId = null;
    room.state.phase = 'lobby';
    room.state.previousPhase = null;
    room.state.locked = false;
    room.state.board = null;
    room.state.currentQuestion = null;
    room.state.timer = emptyTimer();
    room.state.multiplier = 1;
    room.state.remainingQuestions = 0;
    room.state.finalRound = null;
    room.state.resultPlayerIds = [];
    room.state.gameStartedAt = null;
    room.state.gameEndedAt = null;
    room.state.players.forEach((player) => this.resetPlayerForGame(player));
    room.state.turnPlayerId = this.connectedPlayers(room)[0]?.id ?? null;
    this.persist();
    return this.snapshot(roomCode);
  }

  startGame(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'lobby') throw new Error('Game already started');
    this.clearUndo(room);
    const generated = this.generateBoard(room.state.settings);
    room.questions = generated.questions;
    room.state.board = generated.board;
    room.state.remainingQuestions = generated.board!.questions.length;
    room.state.multiplier = this.multiplierForRemaining(room.state.remainingQuestions, room.state.settings.lateGameModifiers);
    room.state.phase = 'board';
    room.state.locked = false;
    room.state.gameStartedAt = Date.now();
    room.state.gameEndedAt = null;
    room.state.finalRound = null;
    room.state.resultPlayerIds = [];
    room.finalQuestionId = null;
    room.state.players.forEach((player) => this.resetPlayerForGame(player));
    room.state.turnPlayerId = this.connectedPlayers(room)[0]?.id ?? null;
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
    this.clearUndo(room);
    const tile = room.state.board.questions.find((entry) => entry.questionId === questionId);
    const question = room.questions[questionId];
    if (!tile || !question || tile.used) throw new Error('Question is unavailable');
    const multiplier = this.multiplierForRemaining(room.state.remainingQuestions, room.state.settings.lateGameModifiers);
    const connected = this.connectedPlayers(room);
    const requestedTurnPlayer = dailyDoublePlayerId ? connected.find((player) => player.id === dailyDoublePlayerId) : null;
    if (requestedTurnPlayer) room.state.turnPlayerId = requestedTurnPlayer.id;
    const turnPlayer = this.ensureTurnPlayer(room);
    const isPlayableDailyDouble = gameModeAllowsDailyDoubles(room.state.settings) && tile.dailyDouble && connected.length > 0;
    const configuredResponseMode = responseModeForGameMode(room.state.settings, question, isPlayableDailyDouble);
    // A typed-response clue cannot make progress with no phones. Practice mode falls back to the normal reveal flow.
    const responseMode = connected.length === 0 && configuredResponseMode === 'text' ? 'buzz' : configuredResponseMode;
    tile.used = true;
    tile.turnPlayerId = turnPlayer?.id ?? null;
    tile.playedValue = question.value * multiplier;
    tile.results = [];
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
      responseMode,
      textResponses: {},
      responsesClosed: false,
      pendingIncorrectValue: null,
      responseOpensAt: null,
      responseReadRemainingMs: null,
      dailyDouble: isPlayableDailyDouble,
      dailyDoublePlayerId: null,
      turnPlayerId: turnPlayer?.id ?? null,
      participantIds: connected.map((player) => player.id),
      timedOut: false,
      resolvedPlayerId: null,
      wager: null,
      buzzOpen: false,
      buzzWinnerId: null,
      buzzOpenedAt: null,
      attemptedPlayerIds: []
    };
    room.state.players.forEach((player) => { player.buzzEligible = false; player.hasBuzzedThisQuestion = false; });
    if (isPlayableDailyDouble) {
      const player = turnPlayer ?? connected[0];
      room.state.currentQuestion.dailyDoublePlayerId = player.id;
      player.stats.dailyDoublesFound += 1;
      room.state.phase = 'daily-double-wager';
    } else {
      room.state.phase = 'question';
      if (responseMode === 'text' && connected.length > 0) {
        const readSeconds = room.state.settings.gameMode === 'free-response'
          ? normalizeFreeResponseReadSeconds(room.state.settings.freeResponseReadSeconds)
          : 0;
        if (readSeconds > 0) {
          const durationMs = readSeconds * 1000;
          room.state.currentQuestion.responseOpensAt = Date.now() + durationMs;
          room.state.currentQuestion.responseReadRemainingMs = null;
          this.stopTimerInternal(room);
        } else {
          this.startTimerInternal(room);
        }
      }
    }
    this.persist();
    return this.snapshot(roomCode);
  }

  cancelQuestion(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    const current = room.state.currentQuestion;
    if (!current || !room.state.board) throw new Error('No question is open');
    if (current.answerRevealed || current.attemptedPlayerIds.length > 0 || Object.keys(current.textResponses ?? {}).length > 0 || current.wager !== null) {
      throw new Error('This question already has an answer or response. Finish it instead of exiting.');
    }
    const tile = room.state.board.questions.find((entry) => entry.questionId === current.questionId);
    if (tile) tile.used = false;
    room.state.remainingQuestions += 1;
    if (current.dailyDoublePlayerId) {
      const player = room.state.players.find((item) => item.id === current.dailyDoublePlayerId);
      if (player) player.stats.dailyDoublesFound = Math.max(0, player.stats.dailyDoublesFound - 1);
    }
    room.state.currentQuestion = null;
    room.state.phase = 'board';
    room.state.multiplier = this.multiplierForRemaining(room.state.remainingQuestions, room.state.settings.lateGameModifiers);
    this.stopTimerInternal(room);
    room.state.players.forEach((player) => { player.buzzEligible = false; player.hasBuzzedThisQuestion = false; });
    this.persist();
    return this.snapshot(roomCode);
  }

  setDailyDoubleWager(roomCode: string, hostToken: string, wager: number, expectedQuestionId?: string, expectedGameStartedAt?: number): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    this.assertQuestionContext(room, expectedQuestionId, expectedGameStartedAt);
    const current = room.state.currentQuestion;
    if (room.state.phase !== 'daily-double-wager' || !current?.dailyDoublePlayerId) throw new Error('No Daily Double wager is pending');
    const player = room.state.players.find((item) => item.id === current.dailyDoublePlayerId)!;
    const maximum = room.state.settings.allowWagerBeyondScore ? room.state.settings.maxWager : Math.min(room.state.settings.maxWager, Math.max(0, player.score));
    if (!Number.isInteger(wager) || wager < 0 || wager > maximum) throw new Error(`Wager must be between 0 and ${maximum}`);
    current.wager = wager;
    const tile = room.state.board?.questions.find((entry) => entry.questionId === current.questionId);
    if (tile) {
      const multiplier = room.state.settings.dailyDoubleStacksWithMultiplier
        ? this.multiplierForRemaining(room.state.remainingQuestions + 1, room.state.settings.lateGameModifiers)
        : 1;
      tile.playedValue = wager * multiplier;
    }
    player.stats.biggestWager = Math.max(player.stats.biggestWager, wager);
    room.state.phase = 'daily-double-question';
    this.startTimerInternal(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  openBuzzers(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    const current = room.state.currentQuestion;
    if (room.state.phase !== 'question' || !current || current.dailyDouble || current.responseMode === 'text') throw new Error('Buzzers cannot open now');
    current.buzzOpen = true;
    current.buzzWinnerId = null;
    current.buzzOpenedAt = Date.now();
    const participants = new Set(current.participantIds ?? room.state.players.map((player) => player.id));
    room.state.players.forEach((player) => { player.buzzEligible = player.connected && participants.has(player.id) && (room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(player.id)); });
    const someoneEligible = room.state.players.some((player) => player.buzzEligible);
    if (!someoneEligible) current.buzzOpen = false;
    if (someoneEligible) this.startTimerInternal(room);
    else this.stopTimerInternal(room);
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

  buzz(roomCode: string, playerId: string, reconnectToken: string, expectedQuestionId?: string, expectedGameStartedAt?: number): { accepted: boolean; reason?: string; snapshot: RoomSnapshot } {
    const [room, player] = this.playerRoom(roomCode, playerId, reconnectToken);
    this.assertQuestionContext(room, expectedQuestionId, expectedGameStartedAt);
    const timerExpired = this.expireTimerIfNeeded(room);
    const current = room.state.currentQuestion;
    if (room.state.phase !== 'question' || !current?.buzzOpen || current.buzzWinnerId) {
      if (timerExpired) this.persist();
      return { accepted: false, reason: 'Buzzers are locked', snapshot: this.snapshot(roomCode) };
    }
    if (!player.connected || !player.buzzEligible || (!room.state.settings.allowRepeatBuzzAfterMiss && current.attemptedPlayerIds.includes(player.id))) {
      if (timerExpired) this.persist();
      return { accepted: false, reason: 'You are not eligible to buzz', snapshot: this.snapshot(roomCode) };
    }
    current.buzzWinnerId = player.id;
    current.resolvedPlayerId = null;
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
    if (room.state.phase !== 'question' || !player || !player.connected || !current?.buzzOpen || current.buzzWinnerId || !player.buzzEligible) throw new Error('Local buzz is not valid');
    current.buzzWinnerId = player.id;
    current.resolvedPlayerId = null;
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
  private addScore(player: Player, delta: number, settings: GameSettings): number {
    const before = player.score;
    const after = settings.allowNegativeScores ? before + delta : Math.max(0, before + delta);
    const actualDelta = after - before;
    player.score = after;
    if (actualDelta >= 0) player.stats.pointsGained += actualDelta;
    else player.stats.pointsLost += Math.abs(actualDelta);
    return actualDelta;
  }
  private recordBoardResult(room: RoomRecord, player: Player, correct: boolean, delta: number): void {
    const current = room.state.currentQuestion;
    if (!current || !room.state.board) return;
    const tile = room.state.board.questions.find((entry) => entry.questionId === current.questionId);
    if (!tile) return;
    tile.playedValue ??= current.effectiveValue;
    const customization = normalizePlayerCustomization(player);
    const result = {
      playerId: player.id, playerName: player.name, playerAvatar: player.avatar,
      playerAvatarId: customization.avatarId, playerAccent: player.accent,
      playerFrameStyle: customization.frameStyle,
      correct, delta
    };
    tile.results = [...(tile.results ?? []).filter((entry) => entry.playerId !== player.id), result];
  }

  resolveAnswer(roomCode: string, hostToken: string, playerId: string, correct: boolean): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    const current = room.state.currentQuestion;
    const player = room.state.players.find((item) => item.id === playerId);
    if (!current || !player) throw new Error('No active answer to resolve');
    if (!current.answerRevealed) throw new Error('Reveal the answer before judging the response');
    if (current.timedOut || current.resolvedPlayerId === playerId) throw new Error('This response is already resolved');
    if (current.responseMode === 'text') throw new Error('Use free-response grading for this question');
    if (current.dailyDouble && current.dailyDoublePlayerId !== playerId) throw new Error('Only the Daily Double player can answer');
    if (!current.dailyDouble && current.buzzWinnerId !== playerId) throw new Error('Only the buzz winner can be resolved');
    this.checkpointScore(room);
    let points = current.effectiveValue;
    if (current.dailyDouble) {
      const multiplier = room.state.settings.dailyDoubleStacksWithMultiplier ? this.multiplierForRemaining(room.state.remainingQuestions + 1, room.state.settings.lateGameModifiers) : 1;
      points = (current.wager ?? 0) * multiplier;
    } else if (correct) {
      points = calculateComebackAward(room.state, player, points).points;
    }
    const scoreDelta = this.addScore(player, correct ? points : -points, room.state.settings);
    this.recordBoardResult(room, player, correct, scoreDelta);
    if (correct) player.stats.correct += 1; else player.stats.incorrect += 1;
    this.applyStreak(player, correct, room.state.settings);
    current.resolvedPlayerId = player.id;
    this.stopTimerInternal(room);
    if (correct || current.dailyDouble || !room.state.settings.stealsEnabled) {
      current.answerRevealed = true;
      current.buzzOpen = false;
    } else {
      current.buzzWinnerId = null;
      const participants = new Set(current.participantIds ?? room.state.players.map((candidate) => candidate.id));
      room.state.players.forEach((candidate) => { candidate.buzzEligible = candidate.connected && participants.has(candidate.id) && (room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(candidate.id)); });
      const someoneEligible = room.state.players.some((candidate) => candidate.buzzEligible);
      current.buzzOpen = someoneEligible;
      current.buzzOpenedAt = someoneEligible ? Date.now() : null;
      if (someoneEligible) this.startTimerInternal(room); else current.answerRevealed = true;
    }
    this.persist();
    return this.snapshot(roomCode);
  }

  submitTextResponse(roomCode: string, playerId: string, reconnectToken: string, answer: string, expectedQuestionId?: string, expectedGameStartedAt?: number): RoomSnapshot {
    const [room, player] = this.playerRoom(roomCode, playerId, reconnectToken);
    this.assertQuestionContext(room, expectedQuestionId, expectedGameStartedAt);
    const responseWindowOpened = this.openTextResponseWindowIfReady(room);
    const timerExpired = this.expireTimerIfNeeded(room);
    const current = room.state.currentQuestion;
    if (room.state.phase !== 'question' || !current || current.responseMode !== 'text' || current.answerRevealed || current.responsesClosed) {
      if (timerExpired || responseWindowOpened) this.persist();
      throw new Error('Responses are closed');
    }
    if (current.responseOpensAt) {
      if (responseWindowOpened) this.persist();
      throw new Error('Answer input is not open yet');
    }
    if (current.participantIds && !current.participantIds.includes(player.id)) throw new Error('You joined after this question started. Wait for the next question.');
    const trimmed = answer.trim().slice(0, 200);
    if (!trimmed) throw new Error('Enter an answer first');
    if (current.textResponses?.[player.id]) throw new Error('Your response is already locked');
    const grade = autoGradeAnswer(trimmed, current.acceptedAnswers ?? []);
    current.textResponses ??= {};
    current.textResponses[player.id] = {
      answer: trimmed,
      submittedAt: Date.now(),
      autoCorrect: grade.correct,
      autoConfidence: grade.confidence,
      reviewCorrect: grade.correct,
      resolvedCorrect: null
    };
    const active = this.currentQuestionParticipants(room);
    const allSubmitted = active.length > 0 && active.every((candidate) => Boolean(current.textResponses?.[candidate.id]));
    if (allSubmitted) this.closeTextResponsesInternal(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  resolveTextResponse(roomCode: string, hostToken: string, playerId: string, correct: boolean): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    const current = room.state.currentQuestion;
    if (!current || current.responseMode !== 'text' || !current.answerRevealed) throw new Error('Free responses are not ready for grading');
    const response = current.textResponses?.[playerId];
    if (!response) throw new Error('Response not found');
    if (response.resolvedCorrect !== null) throw new Error('Response is already graded');
    response.reviewCorrect = correct;
    this.refreshTextPenaltyPreview(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  confirmTextResponses(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    const current = room.state.currentQuestion;
    if (!current || current.responseMode !== 'text' || !current.answerRevealed || !current.responsesClosed) {
      throw new Error('Free responses are not ready to confirm');
    }
    const responses = current.textResponses ?? {};
    const pending = Object.entries(responses).filter(([, response]) => response.resolvedCorrect === null);
    const participantIds = current.participantIds ?? room.state.players.filter((player) => player.connected).map((player) => player.id);
    const noResponsePlayers = participantIds
      .map((playerId) => room.state.players.find((player) => player.id === playerId))
      .filter((player): player is Player => Boolean(player && !responses[player.id]));

    if (!pending.length && !noResponsePlayers.length) throw new Error('There are no response grades awaiting confirmation');

    const missPenalty = this.refreshTextPenaltyPreview(room);
    // Calculate every award from the same pre-confirmation state so one player's
    // score change cannot alter another player's comeback eligibility.
    const scoringState = structuredClone(room.state);
    const correctAwards = new Map<string, number>();
    for (const [playerId, response] of pending) {
      const correct = response.reviewCorrect ?? response.autoCorrect;
      if (!correct) continue;
      const scoringPlayer = scoringState.players.find((item) => item.id === playerId);
      if (scoringPlayer) correctAwards.set(playerId, calculateComebackAward(scoringState, scoringPlayer, current.effectiveValue).points);
    }

    this.checkpointScore(room);
    for (const [playerId, response] of pending) {
      const player = room.state.players.find((item) => item.id === playerId);
      if (!player) continue;
      const correct = response.reviewCorrect ?? response.autoCorrect;
      response.reviewCorrect = correct;
      response.resolvedCorrect = correct;
      const points = correct ? (correctAwards.get(playerId) ?? current.effectiveValue) : missPenalty;
      const scoreDelta = this.addScore(player, correct ? points : -points, room.state.settings);
      this.recordBoardResult(room, player, correct, scoreDelta);
      if (correct) player.stats.correct += 1; else player.stats.incorrect += 1;
      this.applyStreak(player, correct, room.state.settings);
    }

    for (const player of noResponsePlayers) {
      const scoreDelta = this.addScore(player, -missPenalty, room.state.settings);
      this.recordBoardResult(room, player, false, scoreDelta);
      player.stats.incorrect += 1;
      this.applyStreak(player, false, room.state.settings);
    }

    return this.advanceToBoard(roomCode, hostToken);
  }

  private refreshTextPenaltyPreview(room: RoomRecord): number {
    const current = room.state.currentQuestion;
    if (!current || current.responseMode !== 'text') return 0;
    const responses = current.textResponses ?? {};
    const participantIds = current.participantIds ?? room.state.players.map((player) => player.id);
    const anyCorrect = participantIds.some((playerId) => {
      const response = responses[playerId];
      return Boolean(response && (response.resolvedCorrect ?? response.reviewCorrect ?? response.autoCorrect));
    });
    const missPenalty = anyCorrect ? current.effectiveValue : Math.round(current.effectiveValue / 2);
    current.pendingIncorrectValue = missPenalty;
    return missPenalty;
  }

  private closeTextResponsesInternal(room: RoomRecord): void {
    const current = room.state.currentQuestion;
    if (!current || current.responseMode !== 'text') return;
    current.responsesClosed = true;
    current.answerRevealed = true;
    this.refreshTextPenaltyPreview(room);
    current.buzzOpen = false;
    room.state.players.forEach((player) => { player.buzzEligible = false; });
    this.stopTimerInternal(room);
  }

  revealAnswer(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    const current = room.state.currentQuestion;
    if (!current) throw new Error('No current question');
    if (current.responseMode !== 'text' && !current.dailyDouble && !current.buzzWinnerId && !current.answerRevealed) {
      this.penalizeUnansweredTurn(room);
    }
    if (current.responseMode === 'text') current.responsesClosed = true;
    current.answerRevealed = true;
    if (current.responseMode === 'text') this.refreshTextPenaltyPreview(room);
    current.buzzOpen = false;
    room.state.players.forEach((player) => { player.buzzEligible = false; });
    this.stopTimerInternal(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  advanceToBoard(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    const current = room.state.currentQuestion;
    if (!current) throw new Error('No question to finish');
    if (!current.answerRevealed) throw new Error('Reveal and finish the question before returning to the board');
    if (current.responseMode !== 'text' && !current.timedOut) {
      const spokenPlayerId = current.dailyDoublePlayerId ?? current.buzzWinnerId;
      if (spokenPlayerId && current.resolvedPlayerId !== spokenPlayerId) throw new Error('Judge the spoken response before returning to the board');
    }
    if (current.responseMode === 'text' && current.answerRevealed) {
      const unresolved = Object.values(current.textResponses ?? {}).some((response) => response.resolvedCorrect === null);
      if (unresolved) throw new Error('Grade each submitted response before returning to the board');
    }
    this.advanceTurn(room);
    room.state.currentQuestion = null;
    this.stopTimerInternal(room);
    if (room.state.remainingQuestions === 0) {
      const finalEligibleIds = current.participantIds ?? [];
      const hasFinalist = this.connectedPlayers(room).length > 0 || finalEligibleIds.some((playerId) => room.state.players.some((player) => player.id === playerId));
      if (room.state.settings.finalRoundEnabled && hasFinalist) this.prepareFinalRound(room, finalEligibleIds);
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
    this.checkpointScore(room);
    this.addScore(player, Math.round(delta), room.state.settings);
    this.persist();
    return this.snapshot(roomCode);
  }

  pause(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase === 'paused') return this.snapshot(roomCode);
    room.state.previousPhase = room.state.phase;
    room.state.phase = 'paused';
    const now = Date.now();
    if (room.state.timer.running && room.state.timer.endsAt) room.state.timer.remainingMs = Math.max(0, room.state.timer.endsAt - now);
    room.state.timer.running = false;
    room.state.timer.endsAt = null;
    const current = room.state.currentQuestion;
    if (current?.responseOpensAt) {
      current.responseReadRemainingMs = Math.max(0, current.responseOpensAt - now);
      current.responseOpensAt = null;
    }
    this.persist();
    return this.snapshot(roomCode);
  }
  resume(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'paused') throw new Error('Game is not paused');
    room.state.phase = room.state.previousPhase ?? 'board';
    room.state.previousPhase = null;
    const now = Date.now();
    if (room.state.timer.remainingMs && room.state.timer.remainingMs > 0) {
      room.state.timer.running = true;
      room.state.timer.endsAt = now + room.state.timer.remainingMs;
    }
    const current = room.state.currentQuestion;
    if (current?.responseReadRemainingMs && current.responseReadRemainingMs > 0) {
      current.responseOpensAt = now + current.responseReadRemainingMs;
      current.responseReadRemainingMs = null;
    }
    this.persist();
    return this.snapshot(roomCode);
  }

  private startTimerInternal(room: RoomRecord, now = Date.now()): void {
    const seconds = room.state.settings.timerSeconds;
    if (!seconds) { room.state.timer = emptyTimer(); return; }
    const durationMs = seconds * 1000;
    room.state.timer = { running: true, durationMs, endsAt: now + durationMs, remainingMs: durationMs };
  }
  private openTextResponseWindowIfReady(room: RoomRecord, now = Date.now()): boolean {
    const current = room.state.currentQuestion;
    if (!current || current.responseMode !== 'text' || current.answerRevealed || current.responsesClosed || !current.responseOpensAt) return false;
    if (current.responseOpensAt > now) return false;
    current.responseOpensAt = null;
    current.responseReadRemainingMs = null;
    this.startTimerInternal(room, now);
    return true;
  }
  private expireTimerIfNeeded(room: RoomRecord, now = Date.now()): boolean {
    if (!room.state.timer.running || !room.state.timer.endsAt || room.state.timer.endsAt > now) return false;
    room.state.timer = emptyTimer();
    if (room.state.phase === 'final-question') {
      this.closeFinalResponsesInternal(room);
    } else if (room.state.currentQuestion?.responseMode === 'text' && !room.state.currentQuestion.answerRevealed) {
      if (gameModePenalizesTypedTimeout(room.state.settings)) this.penalizeUnansweredTurn(room);
      this.closeTextResponsesInternal(room);
    } else if (room.state.phase === 'daily-double-question' && room.state.currentQuestion && !room.state.currentQuestion.answerRevealed) {
      // Daily Double expiry only stops the clock; the host still judges the response.
    } else if (room.state.settings.autoCloseBuzzersAtZero && room.state.currentQuestion?.buzzOpen) {
      this.penalizeUnansweredTurn(room);
    }
    return true;
  }
  startTimer(roomCode: string, hostToken: string): RoomSnapshot { const room = this.hostRoom(roomCode, hostToken); this.startTimerInternal(room); this.persist(); return this.snapshot(roomCode); }
  stopTimer(roomCode: string, hostToken: string): RoomSnapshot { const room = this.hostRoom(roomCode, hostToken); this.stopTimerInternal(room); this.persist(); return this.snapshot(roomCode); }
  private stopTimerInternal(room: RoomRecord): void { room.state.timer = emptyTimer(); }

  private penalizeUnansweredTurn(room: RoomRecord): void {
    const current = room.state.currentQuestion;
    if (!current || current.answerRevealed || current.buzzWinnerId) return;
    if (current.responseMode === 'text' && Object.keys(current.textResponses ?? {}).length > 0) return;
    const player = room.state.players.find((candidate) => candidate.id === current.turnPlayerId);
    if (!player) return;
    this.checkpointScore(room);
    let points = current.effectiveValue;
    if (current.dailyDouble) {
      const multiplier = room.state.settings.dailyDoubleStacksWithMultiplier ? this.multiplierForRemaining(room.state.remainingQuestions + 1, room.state.settings.lateGameModifiers) : 1;
      points = (current.wager ?? 0) * multiplier;
    }
    const scoreDelta = this.addScore(player, -points, room.state.settings);
    this.recordBoardResult(room, player, false, scoreDelta);
    player.stats.incorrect += 1;
    this.applyStreak(player, false, room.state.settings);
    current.resolvedPlayerId = player.id;
    current.timedOut = true;
    current.answerRevealed = true;
    current.responsesClosed = true;
    current.buzzOpen = false;
    room.state.players.forEach((candidate) => { candidate.buzzEligible = false; });
  }

  tick(now = Date.now()): string[] {
    const changed: string[] = [];
    for (const [code, room] of this.rooms) {
      if (room.state.expiresAt <= now) { this.rooms.delete(code); changed.push(code); continue; }
      const responseWindowOpened = this.openTextResponseWindowIfReady(room, now);
      const timerExpired = this.expireTimerIfNeeded(room, now);
      if (!responseWindowOpened && !timerExpired) continue;
      changed.push(code);
    }
    if (changed.length) this.persist();
    return changed;
  }

  private prepareFinalRound(room: RoomRecord, recentlyEligibleIds: string[] = []): void {
    // Preserve normal connected-only Final eligibility, but rescue a controller that
    // dropped during the final clue after already being part of that clue's roster.
    const recentlyEligible = new Set(recentlyEligibleIds);
    const participantIds = room.state.players
      .filter((player) => player.connected || recentlyEligible.has(player.id))
      .sort((a, b) => a.seat - b.seat)
      .map((player) => player.id);
    if (!participantIds.length) { this.finishGame(room); return; }
    const selectedPacks = room.state.selectedPackIds.map((packId) => this.getPack(packId)).filter((pack): pack is QuestionPack => Boolean(pack));
    const selected = selectedPacks.flatMap((pack) => pack.questions);
    const preferredFinalId = selectedPacks.length === 1 ? selectedPacks[0].finalQuestionId : undefined;
    const explicitFinal = preferredFinalId ? selected.find((question) => question.id === preferredFinalId && !room.questions[question.id]) : undefined;
    const candidates = selected.filter((question) => !room.questions[question.id] && !this.seenQuestionIds.has(question.id));
    const fallback = selected.filter((question) => !room.questions[question.id]);
    const question = explicitFinal ?? this.shuffle(candidates.length ? candidates : fallback)[0];
    if (!question) return this.finishGame(room);
    room.questions[question.id] = question;
    room.finalQuestionId = question.id;
    room.state.finalRound = {
      category: question.category,
      question: question.text,
      acceptedAnswers: question.acceptedAnswers,
      explanation: question.explanation,
      reviewPlayerIndex: 0,
      reviewPlayerId: null,
      participantIds,
      rosterIds: room.state.players.map((player) => player.id),
      responsesClosed: false
    };
    const participants = new Set(participantIds);
    room.state.players.forEach((player) => {
      const participating = participants.has(player.id);
      player.finalWager = participating ? null : 0;
      player.finalWagerSubmitted = !participating;
      player.finalAnswer = null;
      player.finalAnswerSubmitted = !participating;
      player.finalResolved = !participating;
    });
    room.state.phase = 'final-category';
  }

  beginFinalWagers(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'final-category' || !room.state.finalRound) throw new Error('Final Round is not ready for wagers');
    this.clearUndo(room);
    room.state.phase = 'final-wager';
    this.persist();
    return this.snapshot(roomCode);
  }

  submitFinalWager(roomCode: string, playerId: string, reconnectToken: string, wager: number, expectedGameStartedAt?: number): RoomSnapshot {
    const [room, player] = this.playerRoom(roomCode, playerId, reconnectToken);
    this.assertGameContext(room, expectedGameStartedAt);
    if (room.state.phase !== 'final-wager' || !room.state.finalRound) throw new Error('Final wagers are closed');
    if (!room.state.finalRound.participantIds.includes(player.id)) throw new Error('This seat is not participating in Final Round');
    if (player.finalWagerSubmitted) throw new Error('Your Final wager is already locked');
    const { maxWager } = finalWagerRules(room.state, player.id);
    if (!Number.isInteger(wager) || wager < 0 || wager > maxWager) throw new Error(`Wager must be between 0 and ${maxWager}`);
    player.finalWager = wager;
    player.finalWagerSubmitted = true;
    player.stats.biggestWager = Math.max(player.stats.biggestWager, wager);
    this.persist();
    return this.snapshot(roomCode);
  }

  openFinalQuestion(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'final-wager' || !room.state.finalRound) throw new Error('Final wagers are not active');
    this.clearUndo(room);
    for (const player of this.finalParticipants(room)) {
      if (player.finalWager !== null) continue;
      player.finalWager = 0;
      player.finalWagerSubmitted = true;
    }
    room.state.finalRound.responsesClosed = false;
    room.state.phase = 'final-question';
    this.startTimerInternal(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  submitFinalAnswer(roomCode: string, playerId: string, reconnectToken: string, answer: string, expectedGameStartedAt?: number): RoomSnapshot {
    const [room, player] = this.playerRoom(roomCode, playerId, reconnectToken);
    this.assertGameContext(room, expectedGameStartedAt);
    const timerExpired = this.expireTimerIfNeeded(room);
    if (room.state.phase !== 'final-question' || !room.state.finalRound || room.state.finalRound.responsesClosed) {
      if (timerExpired) this.persist();
      throw new Error('Final answers are closed');
    }
    if (!room.state.finalRound.participantIds.includes(player.id)) throw new Error('This seat is not participating in Final Round');
    if (player.finalAnswerSubmitted) throw new Error('Your Final answer is already locked');
    const trimmed = answer.trim().slice(0, 200);
    if (!trimmed) throw new Error('Enter an answer first');
    player.finalAnswer = trimmed;
    player.finalAnswerSubmitted = true;
    const active = this.activeFinalParticipants(room);
    if (active.length === 0 || active.every((candidate) => candidate.finalAnswerSubmitted)) this.closeFinalResponsesInternal(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  private closeFinalResponsesInternal(room: RoomRecord): void {
    if (!room.state.finalRound) return;
    room.state.finalRound.responsesClosed = true;
    this.stopTimerInternal(room);
  }

  private enterFinalReviewInternal(room: RoomRecord): void {
    const finalRound = room.state.finalRound;
    if (!finalRound) return;
    this.closeFinalResponsesInternal(room);
    room.state.phase = 'final-review';
    this.setNextFinalReviewPlayer(room);
  }

  beginFinalReview(roomCode: string, hostToken: string): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'final-question' || !room.state.finalRound) throw new Error('Final question is not active');
    this.enterFinalReviewInternal(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  resolveFinalAnswer(roomCode: string, hostToken: string, playerId: string, correct?: boolean): RoomSnapshot {
    const room = this.hostRoom(roomCode, hostToken);
    if (room.state.phase !== 'final-review' || !room.state.finalRound) throw new Error('Final answers are not under review');
    if (!room.state.finalRound.participantIds.includes(playerId)) throw new Error('Player did not participate in Final Round');
    const player = room.state.players.find((item) => item.id === playerId);
    if (!player || player.finalResolved) throw new Error('Player final answer is unavailable');
    this.checkpointScore(room);
    const suggestion = autoGradeAnswer(player.finalAnswer ?? '', room.state.finalRound.acceptedAnswers);
    const isCorrect = correct ?? suggestion.correct;
    const wager = player.finalWager ?? 0;
    const { protectedLoss } = finalWagerRules(room.state, player.id);
    const scoreDelta = isCorrect ? wager : protectedLoss ? 0 : -wager;
    this.addScore(player, scoreDelta, room.state.settings);
    if (isCorrect) player.stats.correct += 1; else player.stats.incorrect += 1;
    player.finalResolved = true;
    this.setNextFinalReviewPlayer(room);
    this.persist();
    return this.snapshot(roomCode);
  }

  private finishGame(room: RoomRecord): void {
    room.state.phase = 'recap';
    room.state.gameEndedAt = Date.now();
    if (room.state.finalRound) room.state.finalRound.responsesClosed = true;
    const frozenRoster = room.state.finalRound?.rosterIds ?? room.state.players.map((player) => player.id);
    const existing = new Set(room.state.players.map((player) => player.id));
    room.state.resultPlayerIds = frozenRoster.filter((playerId) => existing.has(playerId));
    this.stopTimerInternal(room);
  }
  endGame(roomCode: string, hostToken: string): RoomSnapshot { const room = this.hostRoom(roomCode, hostToken); this.finishGame(room); this.persist(); return this.snapshot(roomCode); }
}
