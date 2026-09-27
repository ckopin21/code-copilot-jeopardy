// Authoritative rules for Deal or Dud. Screens send requests; everything that matters happens here.
import type { HostRoomCredentials, PlayerJoinCredentials, RoomEngine } from '../../../platform/rooms/types';
import type { PlayerJoinInput } from '../../../platform/players/playerJoin';
import { ROOM_CODE_ALPHABET, randomToken, secureEqual } from '../../../platform/rooms/tokens';
import { mergeStoredRooms, serializeStoredRooms } from '../../../platform/rooms/roomStorageRecovery';
import {
  CATEGORY_IDS, DEFAULT_SETTINGS, DEFAULT_TIMERS, GAME_ID, OFFER_CHOICES, PLAYER_COUNT, ROUND_COUNT, RULE_TIMINGS, TIMER_LIMITS,
  toneAllows,
  type AudioSettings, type BuilderColumn, type CategoryId, type ClockState, type DealPlayer, type DealSettings, type DealSnapshot,
  type OfferChoice, type Phase, type RoundState, type TimerSettings
} from '../types';
import {
  buildHeadline, businessNames, dealHand, dealScorecard, emptyBuilder, laterLine, modifierById, modifierFits,
  pick, pitchCueIds, productById, tonePool, type Rng
} from '../content/dealer';
import { AVATAR_PRESETS, FORECAST_CARDS } from '../content/cues';
import { largestOffers, scoreRound, type Deal } from './scoring';

const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const STORAGE_KEYS = { primary: 'deal-or-dud-rooms', backup: 'deal-or-dud-rooms-backup', recent: 'deal-or-dud-recent' };
const MAX_PHOTO_CHARS = 150_000;
const LIVE_PHASES: readonly Phase[] = ['build', 'stage', 'offers', 'offers-reveal', 'partner'];
const COLUMNS: readonly BuilderColumn[] = ['products', 'modifiers', 'audiences'];

type Room = {
  state: DealSnapshot;
  hostToken: string;
  playerTokens: Record<string, string>;
  presentationToken: string;
  /** Forecast answers and used cards stay off the snapshot until revealed. */
  usedForecastIds: string[];
  usedProductIds: string[];
  usedHeadlines: string[];
  /** Scorecard lines already used this game. */
  usedLineIds: string[];
  /** Recent wrong seat codes, to slow down guessing. Not saved meaningfully; resets are harmless. */
  seatAttempts?: number[];
};

type Recent = { lines: string[]; headlines: string[] };

export interface DealEngineOptions {
  isRoomCodeTaken?: (code: string) => boolean;
  rng?: Rng;
  now?: () => number;
}

export const secureRandom: Rng = () => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 4294967296;
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

export function clockRemaining(clock: ClockState | null, now: number): number {
  if (!clock) return 0;
  return clock.endsAt === null ? clock.remainingMs : Math.max(0, clock.endsAt - now);
}

export class DealEngine implements RoomEngine<DealSnapshot> {
  private rooms = new Map<string, Room>();
  private recent: Recent = { lines: [], headlines: [] };
  private readonly rng: Rng;
  private readonly now: () => number;
  private readonly isRoomCodeTaken: (code: string) => boolean;
  persistenceOk = true;
  onPersistenceChange: ((ok: boolean) => void) | null = null;

  constructor(private readonly storage: Storage | null = null, options: DealEngineOptions = {}) {
    this.rng = options.rng ?? secureRandom;
    this.now = options.now ?? Date.now;
    this.isRoomCodeTaken = options.isRoomCodeTaken ?? (() => false);
    this.load();
  }

  // ---------- persistence ----------
  private load(): void {
    if (!this.storage) return;
    const parse = (key: string): Room[] => {
      try {
        const raw = this.storage!.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as { rooms?: unknown };
        return Array.isArray(parsed?.rooms) ? parsed.rooms.filter((room): room is Room => Boolean(room && typeof room === 'object' && (room as Room).state?.game === GAME_ID && typeof (room as Room).hostToken === 'string')) : [];
      } catch { return []; }
    };
    const merged = mergeStoredRooms(parse(STORAGE_KEYS.primary) as never[], parse(STORAGE_KEYS.backup) as never[], this.now()) as unknown as Room[];
    for (const room of merged) {
      // A server restart mid-round resumes paused so nobody loses time.
      room.state.players.forEach((player) => { player.connected = false; player.seatCode ??= this.newSeatCode(room); });
      room.state.hostConnected = false;
      room.usedLineIds ??= [];
      migrateSettings(room.state.settings);
      // Saved mid-game by an older version (before the shared build, or with the fact-card dossier and separate pitch
      // and questions): that game can't continue, so the room goes back to its lobby with its players.
      const legacy = (room.state as Partial<DealSnapshot>).upcoming === undefined
        || [room.state.round, ...(room.state.upcoming ?? [])].some((round) => round && !Array.isArray((round as Partial<RoundState>).scorecard));
      room.state.upcoming ??= [];
      if (legacy && !['lobby', 'gameover'].includes(room.state.phase)) this.resetToLobby(room, false);
      if (LIVE_PHASES.includes(room.state.phase) && !room.state.paused) this.applyPause(room, 'host');
      this.rooms.set(room.state.code, room);
    }
    try {
      const recent = JSON.parse(this.storage.getItem(STORAGE_KEYS.recent) ?? 'null') as Partial<Recent> | null;
      if (recent && Array.isArray(recent.headlines)) this.recent = { lines: Array.isArray(recent.lines) ? recent.lines : [], headlines: recent.headlines };
    } catch { /* recent history is optional */ }
  }

  private save(): void {
    if (!this.storage) return;
    try {
      const payload = serializeStoredRooms([...this.rooms.values()]);
      const previous = this.storage.getItem(STORAGE_KEYS.primary);
      if (previous) this.storage.setItem(STORAGE_KEYS.backup, previous);
      this.storage.setItem(STORAGE_KEYS.primary, payload);
      this.storage.setItem(STORAGE_KEYS.recent, JSON.stringify(this.recent));
      this.setPersistence(true);
    } catch {
      this.setPersistence(false);
    }
  }
  private setPersistence(ok: boolean): void {
    if (this.persistenceOk === ok) return;
    this.persistenceOk = ok;
    this.onPersistenceChange?.(ok);
  }
  private commit(room: Room): DealSnapshot {
    room.state.revision += 1;
    room.state.expiresAt = this.now() + ROOM_TTL_MS;
    this.save();
    return this.snapshot(room.state.code);
  }

  // ---------- lookup and auth ----------
  private room(code: string): Room {
    const room = this.rooms.get(String(code).trim().toUpperCase());
    if (!room) throw new Error('Room not found or expired');
    return room;
  }
  private hostRoom(code: string, hostToken: string): Room {
    const room = this.room(code);
    if (!secureEqual(room.hostToken, String(hostToken))) throw new Error('Host authorization failed');
    return room;
  }
  private player(room: Room, playerId: string): DealPlayer {
    const player = room.state.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new Error('Player not found');
    return player;
  }
  private round(room: Room): RoundState {
    if (!room.state.round) throw new Error('No round in progress');
    return room.state.round;
  }
  private requirePhase(room: Room, ...phases: Phase[]): void {
    if (!phases.includes(room.state.phase)) throw new Error('That is not available right now');
  }
  private requirePresenter(room: Room, playerId: string): RoundState {
    const round = this.round(room);
    if (round.presenterId !== playerId) throw new Error('Only the presenter can do that');
    return round;
  }
  private requireShark(room: Room, playerId: string): RoundState {
    const round = this.round(room);
    if (!round.sharkIds.includes(playerId)) throw new Error('Only sharks can do that');
    return round;
  }
  private requireNotPaused(room: Room): void {
    if (room.state.paused) throw new Error('The game is paused');
  }

  private allocateCode(): string {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      let code = '';
      for (let index = 0; index < 4; index += 1) code += ROOM_CODE_ALPHABET[Math.floor(this.rng() * ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(code) && !this.isRoomCodeTaken(code)) return code;
    }
    throw new Error('Could not allocate a room code');
  }
  private credentials(room: Room, baseUrl: string): HostRoomCredentials {
    const code = room.state.code;
    return {
      roomCode: code,
      hostToken: room.hostToken,
      joinUrl: `${baseUrl}/?game=${GAME_ID}&mode=player&room=${code}`,
      presentationUrl: `${baseUrl}/?game=${GAME_ID}&mode=presentation&room=${code}&display=${room.presentationToken}`
    };
  }

  // ---------- RoomEngine ----------
  hasRoom(code: string): boolean { return this.rooms.has(String(code).trim().toUpperCase()); }

  snapshot(code: string): DealSnapshot {
    const room = this.room(code);
    return { ...structuredClone(room.state), serverNow: this.now() };
  }

  createRoom(baseUrl: string): HostRoomCredentials {
    const now = this.now();
    const code = this.allocateCode();
    const room: Room = {
      hostToken: randomToken(),
      presentationToken: randomToken(),
      playerTokens: {},
      usedForecastIds: [], usedProductIds: [], usedHeadlines: [], usedLineIds: [],
      state: {
        game: GAME_ID, code, createdAt: now, expiresAt: now + ROOM_TTL_MS, revision: 1, serverNow: now,
        phase: 'lobby', paused: false, pausedAt: null, pauseReason: null,
        settings: structuredClone(DEFAULT_SETTINGS),
        players: [], hostConnected: true, vipId: null,
        roundIndex: -1, round: null, upcoming: [], history: [], clock: null,
        forecast: null, winnerIds: [], tutorialRun: 0, tutorialReturn: null, gameNumber: 1, joinUrl: ''
      }
    };
    const credentials = this.credentials(room, baseUrl);
    room.state.joinUrl = credentials.joinUrl;
    this.rooms.set(code, room);
    this.save();
    return credentials;
  }

  hostCredentials(code: string, hostToken: string, baseUrl: string): HostRoomCredentials {
    const room = this.hostRoom(code, hostToken);
    const credentials = this.credentials(room, baseUrl);
    room.state.joinUrl = credentials.joinUrl;
    return credentials;
  }
  reconnectHost(code: string, hostToken: string): DealSnapshot {
    const room = this.hostRoom(code, hostToken);
    room.state.hostConnected = true;
    return this.snapshot(code);
  }
  setHostConnected(code: string, connected: boolean): void {
    const room = this.rooms.get(code);
    if (room) room.state.hostConnected = connected;
  }

  joinPlayer(code: string, input: PlayerJoinInput): PlayerJoinCredentials {
    const room = this.room(code);
    if (input.seatCode) return this.reclaimSeat(room, input.seatCode);
    if (room.state.phase !== 'lobby') throw new Error('This game has already started. If you were playing, enter your seat code to get your spot back.');
    if (room.state.players.length >= PLAYER_COUNT) throw new Error('This game already has 4 players. If you were one of them, enter your seat code.');
    const taken = new Set(room.state.players.map((player) => player.look.kind === 'preset' ? player.look.presetId : ''));
    const presets = tonePool(AVATAR_PRESETS, room.state.settings.tone).filter((preset) => !taken.has(preset.id));
    const player: DealPlayer = {
      id: `p_${randomToken(6)}`,
      name: input.name.trim().slice(0, 16),
      connected: true,
      look: { kind: 'preset', presetId: pick(presets.length ? presets : AVATAR_PRESETS, this.rng).id },
      score: 0,
      joinedAt: this.now(),
      lookSet: false,
      seatCode: this.newSeatCode(room)
    };
    const reconnectToken = randomToken();
    room.state.players.push(player);
    room.playerTokens[player.id] = reconnectToken;
    room.state.vipId ??= player.id;
    this.commit(room);
    return { playerId: player.id, reconnectToken, roomCode: room.state.code };
  }
  private newSeatCode(room: Room): string {
    const taken = new Set(room.state.players.map((player) => player.seatCode));
    for (;;) {
      const seatCode = String(Math.floor(this.rng() * 10_000)).padStart(4, '0');
      if (!taken.has(seatCode)) return seatCode;
    }
  }
  /** Seat code entered on any phone: that phone takes over the seat, and the old one is signed out. */
  private reclaimSeat(room: Room, seatCode: string): PlayerJoinCredentials {
    const now = this.now();
    room.seatAttempts = (room.seatAttempts ?? []).filter((at) => now - at < 60_000);
    if (room.seatAttempts.length >= 10) throw new Error('Too many tries. Wait a minute, then try your seat code again.');
    const player = room.state.players.find((candidate) => candidate.seatCode !== null && secureEqual(candidate.seatCode, seatCode));
    if (!player) { room.seatAttempts.push(now); throw new Error('That seat code does not match anyone in this game. It is on your old phone under your name.'); }
    const reconnectToken = randomToken();
    room.playerTokens[player.id] = reconnectToken;
    player.connected = false;
    this.setPlayerConnected(room.state.code, player.id, true);
    return { playerId: player.id, reconnectToken, roomCode: room.state.code };
  }
  reconnectPlayer(code: string, playerId: string, reconnectToken: string): PlayerJoinCredentials {
    const room = this.room(code);
    if (!secureEqual(room.playerTokens[playerId] ?? '', String(reconnectToken))) throw new Error('Player authorization failed');
    this.setPlayerConnected(code, playerId, true);
    return { playerId, reconnectToken, roomCode: room.state.code };
  }
  setPlayerConnected(code: string, playerId: string, connected: boolean): void {
    const room = this.rooms.get(String(code).toUpperCase());
    const player = room?.state.players.find((candidate) => candidate.id === playerId);
    if (!room || !player || player.connected === connected) return;
    player.connected = connected;
    // Losing the presenter's phone pauses the round; getting it back resumes automatically.
    const presenterId = room.state.round?.presenterId;
    if (presenterId === playerId && LIVE_PHASES.includes(room.state.phase)) {
      if (!connected && !room.state.paused) this.applyPause(room, 'presenter-offline');
      if (connected && room.state.paused && room.state.pauseReason === 'presenter-offline') this.applyResume(room);
    }
    this.commit(room);
  }
  suspendPlayer(code: string, hostToken: string, playerId: string): void {
    this.hostRoom(code, hostToken);
    this.setPlayerConnected(code, playerId, false);
  }
  removePlayer(code: string, hostToken: string, playerId: string): void {
    this.dropSeat(this.hostRoom(code, hostToken), playerId);
  }
  /** A player leaves for good from their phone. Mid-game that sends everyone back to the lobby, like a host removal. */
  leaveGame(code: string, playerId: string): void {
    const room = this.room(code);
    if (!room.state.players.some((player) => player.id === playerId)) return;
    this.dropSeat(room, playerId);
  }
  private dropSeat(room: Room, playerId: string): void {
    room.state.players = room.state.players.filter((player) => player.id !== playerId);
    delete room.playerTokens[playerId];
    if (room.state.vipId === playerId) room.state.vipId = room.state.players[0]?.id ?? null;
    // A four-player game cannot continue without the fourth seat.
    if (room.state.phase !== 'lobby') this.resetToLobby(room, false);
    this.commit(room);
  }
  presentationSnapshot(code: string, presentationToken: string): DealSnapshot {
    const room = this.room(code);
    if (!secureEqual(room.presentationToken, String(presentationToken))) throw new Error('Invalid presentation link');
    return this.snapshot(code);
  }
  rotatePresentationCapability(code: string, hostToken: string): string {
    const room = this.hostRoom(code, hostToken);
    room.presentationToken = randomToken();
    this.save();
    return room.presentationToken;
  }

  // ---------- timers ----------
  private startClock(room: Room, seconds: number): void {
    const totalMs = Math.round(seconds * 1000);
    room.state.clock = { endsAt: this.now() + totalMs, remainingMs: totalMs, totalMs };
  }
  private freezeClock(room: Room): void {
    const clock = room.state.clock;
    if (!clock || clock.endsAt === null) return;
    clock.remainingMs = Math.max(0, clock.endsAt - this.now());
    clock.endsAt = null;
  }
  private unfreezeClock(room: Room): void {
    const clock = room.state.clock;
    if (!clock || clock.endsAt !== null) return;
    clock.endsAt = this.now() + clock.remainingMs;
  }
  private remaining(room: Room): number { return clockRemaining(room.state.clock, this.now()); }

  private applyPause(room: Room, reason: 'host' | 'presenter-offline'): void {
    if (room.state.paused) { room.state.pauseReason = reason; return; }
    room.state.paused = true;
    room.state.pausedAt = this.now();
    room.state.pauseReason = reason;
  }
  /** Shifts every absolute deadline by the time spent paused. */
  private applyResume(room: Room): void {
    if (!room.state.paused) return;
    const shift = this.now() - (room.state.pausedAt ?? this.now());
    const state = room.state;
    if (state.clock?.endsAt != null) state.clock.endsAt += shift;
    state.paused = false;
    state.pausedAt = null;
    state.pauseReason = null;
  }

  tick(now = this.now()): string[] {
    const changed: string[] = [];
    for (const [code, room] of this.rooms) {
      if (room.state.expiresAt <= now) { this.rooms.delete(code); this.save(); continue; }
      if (room.state.paused) continue;
      let guard = 0;
      let any = false;
      while (guard < 10 && this.advance(room, now)) { any = true; guard += 1; }
      if (any) { this.commit(room); changed.push(code); }
    }
    return changed;
  }

  /** One timer-driven step. Returns true if anything changed. */
  private advance(room: Room, now: number): boolean {
    const state = room.state;
    const expired = state.clock !== null && state.clock.endsAt !== null && state.clock.endsAt <= now;
    const round = state.round;
    switch (state.phase) {
      case 'tutorial':
        if (expired) { this.finishTutorial(room); return true; }
        return false;
      case 'build':
        if (expired) { this.finishBuild(room); return true; }
        return false;
      case 'stage':
        if (expired) { this.openOffers(room); return true; }
        return false;
      case 'offers':
        if (expired) { this.closeOffers(room); return true; }
        return false;
      case 'offers-reveal':
        if (expired) { this.settleOffers(room); return true; }
        return false;
      case 'partner':
        if (expired && round) { this.makeDeal(room, pick(round.tiedSharkIds, this.rng)); return true; }
        return false;
      case 'reveal':
        if (expired) { this.startBreak(room); return true; }
        return false;
      case 'break':
        if (expired) { this.nextRoundOrFinal(room); return true; }
        return false;
      case 'final':
        if (expired) { this.afterFinal(room); return true; }
        return false;
      case 'forecast':
        if (expired) { this.resolveForecast(room); return true; }
        return false;
      case 'forecast-result':
        if (expired) { this.afterForecastResult(room); return true; }
        return false;
      default:
        return false;
    }
  }

  // ---------- game flow ----------
  private resetToLobby(room: Room, keepScores: boolean): void {
    const state = room.state;
    state.phase = 'lobby';
    state.paused = false; state.pausedAt = null; state.pauseReason = null;
    state.round = null; state.upcoming = []; state.roundIndex = -1; state.clock = null;
    state.forecast = null; state.tutorialReturn = null;
    if (!keepScores) { state.history = []; state.winnerIds = []; state.players.forEach((player) => { player.score = 0; }); }
    room.usedForecastIds = []; room.usedProductIds = []; room.usedHeadlines = []; room.usedLineIds = [];
  }

  updateSettings(code: string, hostToken: string, updates: Partial<DealSettings> & { timerSteps?: Partial<TimerSettings> }): DealSnapshot {
    const room = this.hostRoom(code, hostToken);
    const settings = room.state.settings;
    const lobby = room.state.phase === 'lobby';
    if (updates.audio) settings.audio = this.cleanAudio({ ...settings.audio, ...updates.audio });
    if (typeof updates.captions === 'boolean') settings.captions = updates.captions;
    if (lobby) {
      if (updates.timerPreset && updates.timerPreset !== 'custom' && DEFAULT_TIMERS[updates.timerPreset]) {
        settings.timerPreset = updates.timerPreset;
        settings.timers = { ...DEFAULT_TIMERS[updates.timerPreset] };
      }
      if (updates.timers || updates.timerSteps) {
        const next = { ...settings.timers };
        for (const key of Object.keys(TIMER_LIMITS) as (keyof TimerSettings)[]) {
          if (updates.timers?.[key] !== undefined) next[key] = clamp(updates.timers[key], TIMER_LIMITS[key].min, TIMER_LIMITS[key].max, next[key]);
          // Steps apply to the current value, so taps sent faster than snapshots return still add up.
          const step = Number(updates.timerSteps?.[key]);
          if (Number.isFinite(step) && step !== 0) next[key] = clamp(next[key] + step, TIMER_LIMITS[key].min, TIMER_LIMITS[key].max, next[key]);
        }
        settings.timers = next;
        const preset = (Object.keys(DEFAULT_TIMERS) as (keyof typeof DEFAULT_TIMERS)[])
          .find((name) => (Object.keys(next) as (keyof TimerSettings)[]).every((key) => DEFAULT_TIMERS[name][key] === next[key]));
        settings.timerPreset = preset ?? 'custom';
      }
      if (updates.tone && ['clean', 'silly', 'crude'].includes(updates.tone)) {
        settings.tone = updates.tone;
        // Keep preset avatars inside the chosen tone.
        for (const player of room.state.players) {
          if (player.look.kind === 'preset') {
            const preset = AVATAR_PRESETS.find((item) => item.id === (player.look as { presetId: string }).presetId);
            if (!toneAllows(settings.tone, preset?.tone)) player.look = { kind: 'preset', presetId: pick(tonePool(AVATAR_PRESETS, settings.tone), this.rng).id };
          }
        }
      }
      if (typeof updates.tutorial === 'boolean') settings.tutorial = updates.tutorial;
    } else if (updates.timers || updates.timerSteps || updates.timerPreset || updates.tone || updates.tutorial !== undefined) {
      throw new Error('Game settings can only change between games');
    }
    return this.commit(room);
  }
  /** Sets how the narrator pronounces a player's name. An empty value goes back to the name as typed. */
  setSayAs(code: string, hostToken: string, playerId: unknown, value: unknown): DealSnapshot {
    const room = this.hostRoom(code, hostToken);
    const player = room.state.players.find((item) => item.id === String(playerId));
    if (!player) throw new Error('That player is not in this room');
    const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 32) : '';
    if (text) player.sayAs = text; else delete player.sayAs;
    return this.commit(room);
  }
  resetSettings(code: string, hostToken: string): DealSnapshot {
    const room = this.hostRoom(code, hostToken);
    this.requirePhase(room, 'lobby');
    const audio = room.state.settings.audio;
    room.state.settings = { ...structuredClone(DEFAULT_SETTINGS), audio };
    return this.commit(room);
  }
  private cleanAudio(audio: AudioSettings): AudioSettings {
    return { music: clamp(audio.music, 0, 100, 55), effects: clamp(audio.effects, 0, 100, 75), narration: clamp(audio.narration, 0, 100, 90), muted: Boolean(audio.muted) };
  }

  startGame(code: string, hostToken: string): DealSnapshot {
    const room = this.hostRoom(code, hostToken);
    this.requirePhase(room, 'lobby');
    const ready = room.state.players.filter((player) => player.lookSet);
    if (room.state.players.length !== PLAYER_COUNT || ready.length !== PLAYER_COUNT) throw new Error('Deal or Dud needs exactly 4 players with avatars picked');
    if (room.state.players.some((player) => !player.connected)) throw new Error('Every phone must be connected to start');
    this.resetToLobby(room, false);
    room.state.players.sort((a, b) => a.joinedAt - b.joinedAt);
    if (room.state.settings.tutorial) this.beginTutorial(room, null);
    else this.startBuild(room);
    return this.commit(room);
  }

  private beginTutorial(room: Room, returnPhase: Phase | null): void {
    room.state.tutorialReturn = returnPhase;
    room.state.phase = 'tutorial';
    room.state.tutorialRun += 1;
    this.startClock(room, RULE_TIMINGS.tutorialSeconds + 2);
  }
  private finishTutorial(room: Room): void {
    const back = room.state.tutorialReturn;
    room.state.tutorialReturn = null;
    if (back === 'lobby') { room.state.phase = 'lobby'; room.state.clock = null; return; }
    if (back === 'break') { room.state.phase = 'break'; this.startClock(room, RULE_TIMINGS.breakBetweenRounds); return; }
    this.startBuild(room);
  }
  replayTutorial(code: string, hostToken: string): DealSnapshot {
    const room = this.hostRoom(code, hostToken);
    this.requirePhase(room, 'lobby', 'break');
    this.beginTutorial(room, room.state.phase);
    return this.commit(room);
  }
  skipTutorial(code: string, hostToken: string): DealSnapshot {
    const room = this.hostRoom(code, hostToken);
    this.requirePhase(room, 'tutorial');
    this.finishTutorial(room);
    return this.commit(room);
  }

  /** Everyone builds their product at once; the four rounds then run back to back. */
  private startBuild(room: Room): void {
    const state = room.state;
    state.round = null;
    state.roundIndex = -1;
    state.upcoming = [];
    // Deal each player's first four products in turn, so nobody starts with the same card as someone else.
    for (const [index, player] of state.players.entries()) {
      const round = this.newRound(state, index, player.id);
      state.upcoming.push(round);
      round.builder.hands.products = dealHand('products', round.builder, state.settings.tone, this.rng, this.cardsInPlay(room, round, 'products'));
      round.builder.hands.audiences = dealHand('audiences', round.builder, state.settings.tone, this.rng, this.cardsInPlay(room, round, 'audiences'));
    }
    state.phase = 'build';
    this.startClock(room, state.settings.timers.prep);
  }
  private newRound(state: DealSnapshot, index: number, presenterId: string): RoundState {
    return {
      index,
      presenterId,
      sharkIds: state.players.filter((player) => player.id !== presenterId).map((player) => player.id),
      builder: emptyBuilder(),
      nameOptions: [],
      premise: null,
      lockedAt: null,
      verdict: null,
      explanation: null,
      scorecard: [],
      peeks: [],
      offers: {},
      lockedOffers: [],
      readyToBid: [],
      tiedSharkIds: [],
      pitchCueIds: pitchCueIds(state.settings.tone, this.rng),
      result: null
    };
  }
  /** Cards other players hold or picked in a step (products also skip ones already locked), so hands don't overlap. */
  private cardsInPlay(room: Room, own: RoundState, column: BuilderColumn): string[] {
    const others = room.state.upcoming.filter((round) => round !== own);
    const key = column === 'products' ? 'product' : column === 'modifiers' ? 'modifier' : 'audience';
    const held = others.flatMap((round) => [...round.builder.hands[column], round.builder[key] ?? '']).filter(Boolean);
    return column === 'products' ? [...held, ...room.usedProductIds] : held;
  }
  /** Brings the next built product on stage: the pitch and questions start at once, on one clock. */
  private startRound(room: Room, index: number): void {
    const state = room.state;
    const at = state.upcoming.findIndex((item) => item.index === index);
    if (at < 0) throw new Error('That round was never built');
    const [round] = state.upcoming.splice(at, 1);
    state.roundIndex = index;
    state.round = round;
    if (!round.premise) this.lockPremise(room, round, true);
    state.phase = 'stage';
    this.startClock(room, state.settings.timers.stage);
  }
  /** Locks every product still open (the build clock ran out, or the host skipped), then starts round 1. */
  private finishBuild(room: Room): void {
    for (const round of room.state.upcoming) if (!round.premise) this.lockPremise(room, round, true);
    this.startRound(room, 0);
  }

  /** The player's own round-to-be during the build. */
  private ownBuild(room: Room, playerId: string): RoundState {
    this.requirePhase(room, 'build');
    const round = room.state.upcoming.find((item) => item.presenterId === playerId);
    if (!round) throw new Error('You are not building a product in this game');
    return round;
  }
  private openBuild(room: Room, playerId: string): RoundState {
    const round = this.ownBuild(room, playerId);
    this.requireNotPaused(room);
    if (round.premise) throw new Error('Your product is already locked in');
    return round;
  }
  private refreshNames(room: Room, round: RoundState): void {
    round.nameOptions = businessNames(round.builder, room.state.settings.tone, this.rng);
  }

  // Builder: three quick card picks (product, twist, audience), each from a hand of four.
  builderPick(code: string, playerId: string, column: unknown, id: unknown): DealSnapshot {
    const room = this.room(code);
    const round = this.openBuild(room, playerId);
    if (!COLUMNS.includes(column as BuilderColumn)) throw new Error('Unknown step');
    const step = column as BuilderColumn;
    const picks = round.builder;
    const cardId = String(id ?? '');
    if (step === 'modifiers' && !picks.product) throw new Error('Pick a product first');
    if (!picks.hands[step].includes(cardId)) throw new Error('That card is not in your hand');
    if (step === 'products') {
      picks.product = cardId;
      // Twists depend on the product: keep the current one if it still fits, and deal a hand that fits.
      const product = productById(cardId)!;
      const current = modifierById(picks.modifier);
      if (current && !modifierFits(current, product)) picks.modifier = null;
      const hand = dealHand('modifiers', { ...picks, hands: { ...picks.hands, modifiers: [] } }, room.state.settings.tone, this.rng, this.cardsInPlay(room, round, 'modifiers'));
      picks.hands.modifiers = picks.modifier ? [picks.modifier, ...hand.filter((item) => item !== picks.modifier)].slice(0, hand.length) : hand;
      this.refreshNames(room, round);
    } else if (step === 'modifiers') {
      picks.modifier = cardId;
      this.refreshNames(room, round);
    } else {
      picks.audience = cardId;
    }
    return this.commit(room);
  }
  /** 🔀 A new hand of four for one step. The current pick stays picked. */
  builderReroll(code: string, playerId: string, column: unknown): DealSnapshot {
    const room = this.room(code);
    const round = this.openBuild(room, playerId);
    if (!COLUMNS.includes(column as BuilderColumn)) throw new Error('Unknown step');
    const step = column as BuilderColumn;
    if (step === 'modifiers' && !round.builder.product) throw new Error('Pick a product first');
    round.builder.hands[step] = dealHand(step, round.builder, room.state.settings.tone, this.rng, this.cardsInPlay(room, round, step));
    return this.commit(room);
  }
  reshuffleNames(code: string, playerId: string): DealSnapshot {
    const room = this.room(code);
    const round = this.ownBuild(room, playerId);
    if (!round.builder.product) throw new Error('Pick a product first');
    this.refreshNames(room, round);
    if (round.premise) round.premise.businessName = round.nameOptions[0] ?? round.premise.businessName;
    return this.commit(room);
  }
  chooseName(code: string, playerId: string, index: unknown): DealSnapshot {
    const room = this.room(code);
    const round = this.ownBuild(room, playerId);
    const name = round.nameOptions[Number(index)];
    if (!name) throw new Error('Unknown name');
    // The chosen name moves to the front; the premise uses the first option.
    round.nameOptions = [name, ...round.nameOptions.filter((item) => item !== name)];
    if (round.premise) round.premise.businessName = name;
    return this.commit(room);
  }
  lockPremiseRequest(code: string, playerId: string): DealSnapshot {
    const room = this.room(code);
    const round = this.openBuild(room, playerId);
    this.lockPremise(room, round, false);
    // The last product locked: no need to wait for the clock.
    if (room.state.upcoming.every((item) => item.premise)) this.startRound(room, 0);
    return this.commit(room);
  }

  /** Fills any step left open with a random card from its hand, so every locked product has all three parts. */
  private fillPicks(room: Room, round: RoundState): void {
    const tone = room.state.settings.tone;
    const picks = round.builder;
    const fill = (column: BuilderColumn) => {
      if (!picks.hands[column].length) picks.hands[column] = dealHand(column, picks, tone, this.rng, this.cardsInPlay(room, round, column));
      return pick(picks.hands[column], this.rng);
    };
    if (!picks.product) picks.product = fill('products');
    const product = productById(picks.product)!;
    const fits = (id: string | null) => Boolean(id && modifierById(id) && modifierFits(modifierById(id)!, product));
    if (!fits(picks.modifier)) {
      picks.hands.modifiers = picks.hands.modifiers.filter(fits);
      picks.modifier = fill('modifiers');
    }
    picks.audience ??= fill('audiences');
  }

  private lockPremise(room: Room, round: RoundState, automatic: boolean): void {
    const state = room.state;
    const tone = state.settings.tone;
    const picks = round.builder;
    this.fillPicks(room, round);
    let headline = buildHeadline(picks);
    if (room.usedHeadlines.includes(headline)) {
      if (!automatic) throw new Error('That exact business is already in this game. Change one card.');
      picks.product = null; picks.modifier = null;
      picks.hands.products = []; picks.hands.modifiers = [];
      this.fillPicks(room, round);
      headline = buildHeadline(picks);
      round.nameOptions = [];
    }
    const product = productById(picks.product)!;
    if (!round.nameOptions.length) this.refreshNames(room, round);
    round.premise = { headline, mainProductId: product.id, businessName: round.nameOptions[0] ?? product.roots[0], form: product.form };
    // The verdict is independent of the cards: a fair coin, with no per-game quota.
    const verdict = this.rng() < 0.5 ? 'good' : 'bad';
    const scorecard = dealScorecard(product, verdict, tone, this.rng, [...room.usedLineIds, ...this.recent.lines]);
    round.verdict = verdict;
    round.explanation = scorecard.explanation;
    round.scorecard = scorecard.rows;
    const lineIds = scorecard.rows.map((row) => row.lineId);
    room.usedHeadlines.push(headline);
    room.usedProductIds.push(product.id);
    room.usedLineIds.push(...lineIds);
    this.recent.lines = [...lineIds, ...this.recent.lines.filter((id) => !lineIds.includes(id))].slice(0, 40);
    this.recent.headlines = [headline, ...this.recent.headlines].slice(0, 40);
    round.lockedAt = this.now();
  }

  /** A shark's one secret look at one check. Everyone learns who looked at what; only that shark sees the answer. */
  peek(code: string, playerId: string, category: unknown): DealSnapshot {
    const room = this.room(code);
    this.requirePhase(room, 'stage');
    this.requireNotPaused(room);
    const round = this.requireShark(room, playerId);
    if (!CATEGORY_IDS.includes(category as CategoryId)) throw new Error('Unknown check');
    if (round.peeks.some((item) => item.sharkId === playerId)) throw new Error('You already used your peek this round');
    round.peeks.push({ sharkId: playerId, category: category as CategoryId });
    return this.commit(room);
  }

  /** A shark says they have heard enough. Once all three have, the stage ends and bidding opens. Tapping again takes it back. */
  toggleReadyToBid(code: string, playerId: string): DealSnapshot {
    const room = this.room(code);
    this.requirePhase(room, 'stage');
    this.requireNotPaused(room);
    const round = this.requireShark(room, playerId);
    round.readyToBid = round.readyToBid.includes(playerId) ? round.readyToBid.filter((id) => id !== playerId) : [...round.readyToBid, playerId];
    if (round.sharkIds.every((id) => round.readyToBid.includes(id))) this.openOffers(room);
    return this.commit(room);
  }
  // Offers
  private openOffers(room: Room): void {
    const round = this.round(room);
    room.state.phase = 'offers';
    round.offers = Object.fromEntries(round.sharkIds.map((id) => [id, null]));
    round.lockedOffers = [];
    this.startClock(room, room.state.settings.timers.offers);
  }
  chooseOffer(code: string, playerId: string, choice: unknown): DealSnapshot {
    const room = this.room(code);
    this.requirePhase(room, 'offers');
    this.requireNotPaused(room);
    const round = this.requireShark(room, playerId);
    if (round.lockedOffers.includes(playerId)) throw new Error('Your bid is locked');
    round.offers[playerId] = this.offerChoice(choice);
    return this.commit(room);
  }
  private offerChoice(choice: unknown): OfferChoice {
    const value = Number(choice);
    if (!(OFFER_CHOICES as readonly number[]).includes(value)) throw new Error('Bid $0 to $500K in $100K steps');
    return value as OfferChoice;
  }
  /** Locks the shark's bid. A `choice` sent with it sets the bid first, so one tap does both. */
  lockOffer(code: string, playerId: string, choice?: unknown): DealSnapshot {
    const room = this.room(code);
    this.requirePhase(room, 'offers');
    this.requireNotPaused(room);
    const round = this.requireShark(room, playerId);
    if (round.lockedOffers.includes(playerId)) throw new Error('Your bid is locked');
    if (choice !== undefined) round.offers[playerId] = this.offerChoice(choice);
    if (round.offers[playerId] == null) throw new Error('Choose a bid first');
    if (!round.lockedOffers.includes(playerId)) round.lockedOffers.push(playerId);
    if (round.sharkIds.every((id) => round.lockedOffers.includes(id))) this.closeOffers(room);
    return this.commit(room);
  }
  private closeOffers(room: Room): void {
    const round = this.round(room);
    // A bid that is not locked when time runs out counts as $0.
    for (const id of round.sharkIds) {
      if (!round.lockedOffers.includes(id)) round.offers[id] = 0;
    }
    round.lockedOffers = [...round.sharkIds];
    room.state.phase = 'offers-reveal';
    this.startClock(room, RULE_TIMINGS.offersReveal);
  }
  private settleOffers(room: Room): void {
    const round = this.round(room);
    const { amount, sharkIds } = largestOffers(round.offers as Record<string, OfferChoice>);
    if (amount === null) { this.finishRound(room, null); return; }
    if (sharkIds.length === 1) { this.finishRound(room, { sharkId: sharkIds[0], amount }); return; }
    round.tiedSharkIds = sharkIds;
    room.state.phase = 'partner';
    this.startClock(room, RULE_TIMINGS.partnerChoice);
  }
  choosePartner(code: string, playerId: string, sharkId: unknown): DealSnapshot {
    const room = this.room(code);
    this.requirePhase(room, 'partner');
    this.requireNotPaused(room);
    const round = this.requirePresenter(room, playerId);
    if (!round.tiedSharkIds.includes(String(sharkId))) throw new Error('Choose one of the tied sharks');
    this.makeDeal(room, String(sharkId));
    return this.commit(room);
  }
  private makeDeal(room: Room, sharkId: string): void {
    const round = this.round(room);
    const amount = round.offers[sharkId];
    if (!amount) throw new Error('That shark did not make an offer');
    this.finishRound(room, { sharkId, amount });
  }

  private finishRound(room: Room, deal: Deal): void {
    const state = room.state;
    const round = this.round(room);
    const offers = round.offers as Record<string, OfferChoice>;
    const verdict = round.verdict!;
    const scores = scoreRound(verdict, round.presenterId, offers, deal);
    for (const score of scores) this.player(room, score.playerId).score += score.delta;
    const product = productById(round.premise!.mainProductId)!;
    round.result = {
      verdict,
      explanation: round.explanation ?? '',
      scorecard: structuredClone(round.scorecard),
      laterLine: laterLine(verdict, state.settings.tone, round.premise!.businessName, product.short, this.rng),
      deal,
      offers,
      scores
    };
    state.history.push(structuredClone(round.result));
    state.phase = 'reveal';
    this.startClock(room, RULE_TIMINGS.reveal);
  }
  private startBreak(room: Room): void {
    if (room.state.roundIndex >= ROUND_COUNT - 1) { this.startFinal(room); return; }
    room.state.phase = 'break';
    this.startClock(room, RULE_TIMINGS.breakBetweenRounds);
  }
  private nextRoundOrFinal(room: Room): void {
    if (room.state.roundIndex >= ROUND_COUNT - 1) this.startFinal(room);
    else this.startRound(room, room.state.roundIndex + 1);
  }
  private topPlayers(room: Room): string[] {
    const best = Math.max(...room.state.players.map((player) => player.score));
    return room.state.players.filter((player) => player.score === best).map((player) => player.id);
  }
  private startFinal(room: Room): void {
    room.state.phase = 'final';
    room.state.round = null;
    const top = this.topPlayers(room);
    room.state.winnerIds = top.length === 1 ? top : [];
    this.startClock(room, top.length === 1 ? 12 : 8);
  }
  private afterFinal(room: Room): void {
    const top = this.topPlayers(room);
    if (top.length === 1) { room.state.winnerIds = top; room.state.phase = 'gameover'; room.state.clock = null; return; }
    this.startForecast(room, top, 1);
  }

  // Tiebreaker
  private startForecast(room: Room, playerIds: string[], attempt: 1 | 2): void {
    const pool = tonePool(FORECAST_CARDS, room.state.settings.tone);
    const fresh = pool.filter((card) => !room.usedForecastIds.includes(card.id));
    const card = pick(fresh.length ? fresh : pool, this.rng);
    room.usedForecastIds.push(card.id);
    room.state.forecast = {
      attempt, playerIds,
      card: { id: card.id, title: card.title, clues: [...card.clues], question: card.question },
      answer: null,
      guesses: Object.fromEntries(playerIds.map((id) => [id, null])),
      submitted: [],
      winnerId: null, closestIds: [], randomDraw: false
    };
    room.state.phase = 'forecast';
    this.startClock(room, room.state.settings.timers.tiebreaker);
  }
  submitForecast(code: string, playerId: string, value: unknown): DealSnapshot {
    const room = this.room(code);
    this.requirePhase(room, 'forecast');
    this.requireNotPaused(room);
    const forecast = room.state.forecast!;
    if (!forecast.playerIds.includes(playerId)) throw new Error('Only tied players guess');
    if (forecast.submitted.includes(playerId)) throw new Error('Your guess is locked');
    const guess = Math.round(Number(value));
    if (!Number.isFinite(guess) || guess < 0 || guess > 10_000_000) throw new Error('Enter a whole number');
    forecast.guesses[playerId] = guess;
    forecast.submitted.push(playerId);
    if (forecast.playerIds.every((id) => forecast.submitted.includes(id))) this.resolveForecast(room);
    return this.commit(room);
  }
  private resolveForecast(room: Room): void {
    const forecast = room.state.forecast!;
    const card = FORECAST_CARDS.find((item) => item.id === forecast.card.id)!;
    forecast.answer = card.answer;
    const distances = forecast.playerIds.map((id) => ({ id, distance: forecast.guesses[id] == null ? Infinity : Math.abs(forecast.guesses[id]! - card.answer) }));
    const best = Math.min(...distances.map((item) => item.distance));
    forecast.closestIds = distances.filter((item) => item.distance === best).map((item) => item.id);
    if (forecast.closestIds.length === 1) forecast.winnerId = forecast.closestIds[0];
    else if (forecast.attempt === 2) { forecast.winnerId = pick(forecast.closestIds, this.rng); forecast.randomDraw = true; }
    room.state.phase = 'forecast-result';
    this.startClock(room, RULE_TIMINGS.forecastResult);
  }
  private afterForecastResult(room: Room): void {
    const forecast = room.state.forecast!;
    if (forecast.winnerId) { room.state.winnerIds = [forecast.winnerId]; room.state.phase = 'gameover'; room.state.clock = null; return; }
    this.startForecast(room, forecast.closestIds, 2);
  }

  // Host and VIP controls
  pause(code: string, hostToken: string): DealSnapshot { const room = this.hostRoom(code, hostToken); return this.pauseRoom(room); }
  resume(code: string, hostToken: string): DealSnapshot { const room = this.hostRoom(code, hostToken); return this.resumeRoom(room); }
  continue(code: string, hostToken: string): DealSnapshot { const room = this.hostRoom(code, hostToken); return this.continueRoom(room); }
  private pauseRoom(room: Room): DealSnapshot {
    if (room.state.phase === 'lobby' || room.state.phase === 'gameover') throw new Error('Nothing to pause');
    this.applyPause(room, 'host');
    return this.commit(room);
  }
  private resumeRoom(room: Room): DealSnapshot {
    const presenter = room.state.round ? room.state.players.find((player) => player.id === room.state.round!.presenterId) : null;
    if (presenter && !presenter.connected && LIVE_PHASES.includes(room.state.phase)) throw new Error('Waiting for the presenter\'s phone to reconnect');
    this.applyResume(room);
    return this.commit(room);
  }
  /** Host skip: the tutorial, the build (locks every product as it is), the stage, and the between-rounds waits. */
  private continueRoom(room: Room): DealSnapshot {
    if (room.state.paused) this.applyResume(room);
    switch (room.state.phase) {
      case 'tutorial': this.finishTutorial(room); break;
      case 'build': this.finishBuild(room); break;
      case 'stage': this.openOffers(room); break;
      case 'reveal': this.startBreak(room); break;
      case 'break': this.nextRoundOrFinal(room); break;
      case 'final': this.afterFinal(room); break;
      case 'forecast-result': this.afterForecastResult(room); break;
      default: throw new Error('Nothing to skip right now');
    }
    return this.commit(room);
  }
  vipAction(code: string, playerId: string, action: unknown, payload: Record<string, unknown>): DealSnapshot {
    const room = this.room(code);
    if (room.state.vipId !== playerId) throw new Error('Only the first player has host controls');
    switch (action) {
      case 'pause': return this.pauseRoom(room);
      case 'resume': return this.resumeRoom(room);
      case 'continue': return this.continueRoom(room);
      case 'audio':
        room.state.settings.audio = this.cleanAudio({ ...room.state.settings.audio, ...(payload.audio as Partial<AudioSettings> ?? {}) });
        return this.commit(room);
      default: throw new Error('Unknown host control');
    }
  }
  newGame(code: string, hostToken: string): DealSnapshot {
    const room = this.hostRoom(code, hostToken);
    this.resetToLobby(room, false);
    room.state.gameNumber += 1;
    return this.commit(room);
  }

  // Player look
  setLook(code: string, playerId: string, payload: Record<string, unknown>): DealSnapshot {
    const room = this.room(code);
    this.requirePhase(room, 'lobby', 'tutorial');
    const player = this.player(room, playerId);
    if (typeof payload.photo === 'string') {
      const photo = payload.photo;
      if (!/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(photo) || photo.length > MAX_PHOTO_CHARS) throw new Error('That photo could not be used. Try again or pick a preset.');
      player.look = { kind: 'photo', photo };
    } else {
      const preset = AVATAR_PRESETS.find((item) => item.id === payload.presetId);
      if (!preset || !toneAllows(room.state.settings.tone, preset.tone)) throw new Error('Unknown avatar');
      player.look = { kind: 'preset', presetId: preset.id };
    }
    if (typeof payload.name === 'string' && payload.name.trim()) player.name = payload.name.trim().slice(0, 16);
    player.lookSet = true;
    return this.commit(room);
  }

  /** For tests: the full unsanitized state. */
  debugRoom(code: string): Room { return this.room(code); }
}

/**
 * Settings saved by older versions had separate pitch and question clocks and a fact complexity. A named preset
 * takes the new preset values; custom timers keep what still exists and get the standard stage clock.
 */
function migrateSettings(settings: DealSettings): void {
  const timers = settings.timers as Partial<TimerSettings>;
  if (typeof timers.stage !== 'number') {
    const preset = settings.timerPreset !== 'custom' ? DEFAULT_TIMERS[settings.timerPreset] : undefined;
    settings.timers = preset ? { ...preset } : {
      prep: clamp(timers.prep, TIMER_LIMITS.prep.min, TIMER_LIMITS.prep.max, DEFAULT_TIMERS.standard.prep),
      stage: DEFAULT_TIMERS.standard.stage,
      offers: clamp(timers.offers, TIMER_LIMITS.offers.min, TIMER_LIMITS.offers.max, DEFAULT_TIMERS.standard.offers),
      tiebreaker: clamp(timers.tiebreaker, TIMER_LIMITS.tiebreaker.min, TIMER_LIMITS.tiebreaker.max, DEFAULT_TIMERS.standard.tiebreaker)
    };
  }
  delete (settings as Partial<DealSettings> & { complexity?: unknown }).complexity;
}
