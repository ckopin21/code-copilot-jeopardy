from pathlib import Path


def patch(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    found = text.count(old)
    if found != count:
        raise SystemExit(f"{path}: expected {count} matches, found {found}: {old[:90]!r}")
    file.write_text(text.replace(old, new, count))


# ---------- Shared model/config ----------
patch(
    "src/shared/types.ts",
    "export interface QuestionPack {\n  id: string;\n  title: string;\n  theme: string;\n  description: string;\n  difficulty: Difficulty;\n  approximateMinutes: number;\n  questions: Question[];\n}",
    "export interface QuestionPack {\n  id: string;\n  title: string;\n  theme: string;\n  description: string;\n  difficulty: Difficulty;\n  approximateMinutes: number;\n  accentColor?: string;\n  titleArt?: string;\n  categoryOrder?: string[];\n  finalQuestionId?: string;\n  questions: Question[];\n}",
)
patch(
    "src/shared/types.ts",
    "  controllerBuzzersEnabled: boolean;\n}\n\nexport interface PlayerStats",
    "  controllerBuzzersEnabled: boolean;\n  largeTextMode: boolean;\n  highContrastMode: boolean;\n  reducedMotionMode: boolean;\n  soundCaptions: boolean;\n}\n\nexport interface PlayerDiagnostics {\n  latencyMs: number | null;\n  haptics: boolean;\n  inputTested: boolean;\n  checkedAt: number;\n}\n\nexport interface PlayerStats",
)
patch(
    "src/shared/types.ts",
    "export interface Player {\n  id: string;\n  name: string;\n  avatar: string;",
    "export interface Player {\n  id: string;\n  name: string;\n  avatar: string;\n  seat?: number;\n  diagnostics?: PlayerDiagnostics | null;",
)
patch(
    "src/shared/types.ts",
    "  gameEndedAt: number | null;\n}",
    "  gameEndedAt: number | null;\n  undoLabel?: string | null;\n}",
)
# PackSummary is the remaining plain approximateMinutes block after QuestionPack was expanded.
patch(
    "src/shared/types.ts",
    "  approximateMinutes: number;\n}\n",
    "  approximateMinutes: number;\n  accentColor?: string;\n  titleArt?: string;\n  categoryOrder?: string[];\n  finalQuestionId?: string;\n}\n",
    1,
)

patch(
    "src/shared/config.ts",
    "  controllerBuzzersEnabled: true\n};",
    "  controllerBuzzersEnabled: true,\n  largeTextMode: false,\n  highContrastMode: false,\n  reducedMotionMode: false,\n  soundCaptions: false\n};",
)
patch(
    "src/shared/config.ts",
    "export const AVATARS =",
    "export type GamePresetId = 'casual' | 'fast' | 'competitive' | 'party';\n\nexport const GAME_PRESETS: Record<GamePresetId, { label: string; description: string; settings: Partial<GameSettings> }> = {\n  casual: { label: 'Casual', description: 'Relaxed timing and gentler scoring.', settings: { gameLength: 'standard', timerSeconds: null, dailyDoublesEnabled: true, dailyDoubleCount: 2, allowNegativeScores: false, lateGameModifiers: false, streaksEnabled: true, finalRoundEnabled: true } },\n  fast: { label: 'Fast', description: 'Short board and quick timers.', settings: { gameLength: 'quick', timerSeconds: 10, dailyDoublesEnabled: true, dailyDoubleCount: 1, allowNegativeScores: true, lateGameModifiers: true, streaksEnabled: true, finalRoundEnabled: true } },\n  competitive: { label: 'Competitive', description: 'Full scoring pressure and standard pacing.', settings: { gameLength: 'standard', timerSeconds: 15, dailyDoublesEnabled: true, dailyDoubleCount: 3, allowNegativeScores: true, lateGameModifiers: true, dailyDoubleStacksWithMultiplier: true, streaksEnabled: true, coldStreakThreshold: 3, finalRoundEnabled: true } },\n  party: { label: 'Party', description: 'Long board with more swing moments.', settings: { gameLength: 'marathon', timerSeconds: 20, dailyDoublesEnabled: true, dailyDoubleCount: 4, allowNegativeScores: true, lateGameModifiers: true, dailyDoubleStacksWithMultiplier: true, streaksEnabled: true, coldStreakThreshold: 2, finalRoundEnabled: true } }\n};\n\nexport const AVATARS =",
)

Path("src/lib/boardBalance.ts").write_text("""import type { Question } from '../shared/types';

export function preferredDifficultyForRow(rowIndex: number, rowCount: number): Question['difficulty'] {
  if (rowCount <= 1) return 'medium';
  const ratio = rowIndex / Math.max(1, rowCount - 1);
  return ratio < 0.34 ? 'easy' : ratio < 0.67 ? 'medium' : 'hard';
}
""")

Path("src/lib/awards.ts").write_text("""import type { Player } from '../shared/types';

export interface GameAward { key: string; title: string; detail: string; playerIds: string[] }

function topBy(players: Player[], value: (player: Player) => number | null, requirePositive = true): Player[] {
  const scored = players.map((player) => ({ player, value: value(player) })).filter((entry): entry is { player: Player; value: number } => entry.value !== null && Number.isFinite(entry.value));
  if (!scored.length) return [];
  const best = Math.max(...scored.map((entry) => entry.value));
  if (requirePositive && best <= 0) return [];
  return scored.filter((entry) => entry.value === best).map((entry) => entry.player);
}

function lowBy(players: Player[], value: (player: Player) => number | null): Player[] {
  const scored = players.map((player) => ({ player, value: value(player) })).filter((entry): entry is { player: Player; value: number } => entry.value !== null && Number.isFinite(entry.value));
  if (!scored.length) return [];
  const best = Math.min(...scored.map((entry) => entry.value));
  return scored.filter((entry) => entry.value === best).map((entry) => entry.player);
}

export function gameAwards(players: Player[]): GameAward[] {
  const awards: GameAward[] = [];
  const add = (key: string, title: string, detail: string, winners: Player[]) => { if (winners.length) awards.push({ key, title, detail, playerIds: winners.map((player) => player.id) }); };
  add('points', 'Point Machine', 'Most total points gained', topBy(players, (player) => player.stats.pointsGained));
  add('streak', 'Hot Hand', 'Longest correct-answer streak', topBy(players, (player) => player.stats.longestStreak));
  add('wager', 'High Roller', 'Largest wager of the game', topBy(players, (player) => player.stats.biggestWager));
  add('daily-double', 'Daily Double Hunter', 'Most Daily Doubles found', topBy(players, (player) => player.stats.dailyDoublesFound));
  const attempted = players.filter((player) => player.stats.correct + player.stats.incorrect >= 2);
  add('accuracy', 'Sharp Shooter', 'Best accuracy with at least two rulings', topBy(attempted, (player) => player.stats.correct / Math.max(1, player.stats.correct + player.stats.incorrect), false));
  add('buzz', 'Fastest Finger', 'Fastest registered buzz', lowBy(players, (player) => player.stats.fastestBuzzMs));
  return awards;
}

export const awardsForPlayer = (players: Player[], playerId: string) => gameAwards(players).filter((award) => award.playerIds.includes(playerId));
""")

# ---------- Pack metadata ----------
patch(
    "src/packs/index.ts",
    "  return builtInPacks.map(({ id, title, theme, description, questions, difficulty, approximateMinutes }) => ({\n    id,\n    title,\n    theme,\n    description,\n    questionCount: questions.length,\n    difficulty,\n    approximateMinutes\n  }));",
    "  return builtInPacks.map(({ id, title, theme, description, questions, difficulty, approximateMinutes, accentColor, titleArt, categoryOrder, finalQuestionId }) => ({ id, title, theme, description, questionCount: questions.length, difficulty, approximateMinutes, accentColor, titleArt, categoryOrder, finalQuestionId }));",
)
patch(
    "src/packs/buildPack.ts",
    "  if (!categories.length) throw new Error(`${meta.id} must contain at least one category`);",
    "  if (!categories.length) throw new Error(`${meta.id} must contain at least one category`);\n  if (meta.accentColor && !/^#[0-9a-f]{6}$/i.test(meta.accentColor)) throw new Error(`${meta.id} accentColor must be a six-digit hex color`);",
)
patch(
    "src/packs/buildPack.ts",
    "  return { ...meta, questions };",
    "  if (meta.categoryOrder) {\n    const known = new Set(categories.map((item) => item.name));\n    const unknown = meta.categoryOrder.filter((name) => !known.has(name));\n    if (unknown.length) throw new Error(`${meta.id} categoryOrder contains unknown categories: ${unknown.join(', ')}`);\n  }\n  if (meta.finalQuestionId && !questions.some((item) => item.id === meta.finalQuestionId)) throw new Error(`${meta.id} finalQuestionId does not match a question in the pack`);\n  return { ...meta, questions };",
)

# ---------- Audio/captions ----------
patch(
    "src/lib/audio.ts",
    "type Cue = 'click' | 'open' | 'buzz' | 'locked' | 'correct' | 'wrong' | 'daily-double' | 'fire' | 'cold' | 'phase' | 'reveal';",
    "export type Cue = 'click' | 'open' | 'buzz' | 'locked' | 'correct' | 'wrong' | 'daily-double' | 'fire' | 'cold' | 'phase' | 'reveal' | 'category' | 'round' | 'diagnostic' | 'score' | 'winner';",
)
patch(
    "src/lib/audio.ts",
    "  cue(name: Cue): void {\n    if (!this.context || !this.effects || this.settings.muted) return;",
    "  cue(name: Cue): void {\n    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('blue-stage:audio-cue', { detail: name }));\n    if (!this.context || !this.effects || this.settings.muted) return;",
)
patch(
    "src/lib/audio.ts",
    "      phase: [[330, 0, .06], [494, .06, .08], [659, .13, .14]],\n      reveal: [[523, 0, .06], [659, .055, .07], [784, .11, .09], [1047, .19, .18]]",
    "      phase: [[330, 0, .06], [494, .06, .08], [659, .13, .14]],\n      reveal: [[523, 0, .06], [659, .055, .07], [784, .11, .09], [1047, .19, .18]],\n      category: [[392, 0, .07], [523, .07, .08], [659, .14, .1], [784, .23, .18]],\n      round: [[196, 0, .12], [392, .09, .12], [523, .2, .14], [784, .32, .24]],\n      diagnostic: [[523, 0, .06], [784, .08, .12]],\n      score: [[659, 0, .05], [880, .05, .1]],\n      winner: [[523, 0, .08], [659, .07, .08], [784, .14, .1], [1047, .23, .28]]",
)

# ---------- Authoritative engine ----------
p = "src/lib/browserGameEngine.ts"
patch(p, "import { packMap } from '../packs';", "import { packMap } from '../packs';\nimport { preferredDifficultyForRow } from './boardBalance';")
patch(p, "  finalQuestionId: string | null;\n}", "  finalQuestionId: string | null;\n  undoState?: RoomState | null;\n}")
patch(p, "const STORAGE_KEY = 'blue-stage-p2p-engine-v2';\nconst ROOM_TTL_MS", "const STORAGE_KEY = 'blue-stage-p2p-engine-v2';\nconst STORAGE_BACKUP_KEY = 'blue-stage-p2p-engine-v2-backup';\nconst ROOM_TTL_MS")
patch(
    p,
    "function loadRooms(): RoomRecord[] {\n  try {\n    const raw = localStorage.getItem(STORAGE_KEY);\n    if (!raw) return [];\n    const parsed = JSON.parse(raw) as RoomRecord[];\n    return Array.isArray(parsed) ? parsed : [];\n  } catch { return []; }\n}",
    "function loadRooms(): RoomRecord[] {\n  const parse = (raw: string | null): RoomRecord[] | null => { if (!raw) return null; try { const value = JSON.parse(raw) as RoomRecord[]; return Array.isArray(value) ? value : null; } catch { return null; } };\n  return parse(localStorage.getItem(STORAGE_KEY)) ?? parse(localStorage.getItem(STORAGE_BACKUP_KEY)) ?? [];\n}",
)
patch(
    p,
    "      const previouslyConnected = record.state.players.filter((player) => player.connected).map((player) => player.id);\n      record.state.hostConnected = false;",
    "      const previouslyConnected = record.state.players.filter((player) => player.connected).map((player) => player.id);\n      const usedSeats = new Set<number>();\n      record.state.players.forEach((player) => { let seat = player.seat; if (!seat || seat < 1 || seat > 5 || usedSeats.has(seat)) seat = [1, 2, 3, 4, 5].find((candidate) => !usedSeats.has(candidate)) ?? 5; player.seat = seat; player.diagnostics ??= null; usedSeats.add(seat); });\n      record.state.undoLabel ??= null;\n      record.undoState ??= null;\n      record.state.hostConnected = false;",
)
patch(
    p,
    "  private persist(): void {\n    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.rooms.values()])); }\n    catch { /* keep the in-memory game running */ }\n  }",
    "  private persist(): void {\n    try {\n      const serialized = JSON.stringify([...this.rooms.values()]);\n      const previous = localStorage.getItem(STORAGE_KEY);\n      if (previous && previous !== serialized) localStorage.setItem(STORAGE_BACKUP_KEY, previous);\n      localStorage.setItem(STORAGE_KEY, serialized);\n    } catch { /* keep the in-memory game running */ }\n  }",
)
patch(
    p,
    "      gameEndedAt: null\n    };\n    this.rooms.set(code, { state, hostToken, playerTokens: {}, questions: {}, finalQuestionId: null });",
    "      gameEndedAt: null,\n      undoLabel: null\n    };\n    this.rooms.set(code, { state, hostToken, playerTokens: {}, questions: {}, finalQuestionId: null, undoState: null });",
)
patch(
    p,
    "    const name = duplicateCount ? `${input.name} ${duplicateCount + 1}` : input.name;\n    room.state.players.push({\n      id: playerId, name, avatar: input.avatar, accent: input.accent, score: 0, connected: true,",
    "    const name = duplicateCount ? `${input.name} ${duplicateCount + 1}` : input.name;\n    const usedSeats = new Set(room.state.players.map((player) => player.seat).filter((seat): seat is number => Boolean(seat)));\n    const seat = [1, 2, 3, 4, 5].find((candidate) => !usedSeats.has(candidate));\n    if (!seat) throw new Error('No player seats are available');\n    room.state.players.push({\n      id: playerId, name, avatar: input.avatar, accent: input.accent, seat, diagnostics: null, score: 0, connected: true,",
)
patch(
    p,
    "  updateSettings(roomCode: string, hostToken: string, updates: Partial<GameSettings>): RoomSnapshot {",
    "  renamePlayer(roomCode: string, hostToken: string, playerId: string, nextName: string): RoomSnapshot {\n    const room = this.hostRoom(roomCode, hostToken);\n    const player = room.state.players.find((item) => item.id === playerId);\n    if (!player) throw new Error('Player not found');\n    const name = nextName.trim().slice(0, 24);\n    if (!name) throw new Error('Player name cannot be empty');\n    if (room.state.players.some((item) => item.id !== playerId && item.name.toLowerCase() === name.toLowerCase())) throw new Error('Another player already uses that name');\n    player.name = name;\n    this.persist();\n    return this.snapshot(roomCode);\n  }\n\n  requestDiagnostics(roomCode: string, hostToken: string): RoomSnapshot {\n    const room = this.hostRoom(roomCode, hostToken);\n    room.state.players.filter((player) => player.connected).forEach((player) => { player.diagnostics = null; });\n    this.persist();\n    return this.snapshot(roomCode);\n  }\n\n  pingPlayer(roomCode: string, playerId: string, reconnectToken: string): { serverNow: number } {\n    this.playerRoom(roomCode, playerId, reconnectToken);\n    return { serverNow: Date.now() };\n  }\n\n  updatePlayerDiagnostics(roomCode: string, playerId: string, reconnectToken: string, input: { latencyMs: number; haptics: boolean; inputTested: boolean }): RoomSnapshot {\n    const [room, player] = this.playerRoom(roomCode, playerId, reconnectToken);\n    player.diagnostics = { latencyMs: Number.isFinite(input.latencyMs) ? Math.max(0, Math.min(5000, Math.round(input.latencyMs))) : 5000, haptics: Boolean(input.haptics), inputTested: Boolean(input.inputTested), checkedAt: Date.now() };\n    this.persist();\n    return this.snapshot(roomCode);\n  }\n\n  updateSettings(roomCode: string, hostToken: string, updates: Partial<GameSettings>): RoomSnapshot {",
)
patch(p, "    const pool = selectedPacks.flatMap((pack) => pack.questions);", "    const pool = selectedPacks.flatMap((pack) => pack.questions.filter((question) => question.id !== pack.finalQuestionId));")
patch(
    p,
    "    if (settings.randomizeCategories) usable = this.shuffle(usable);",
    "    if (settings.randomizeCategories) usable = this.shuffle(usable);\n    else if (selectedPacks.length === 1 && selectedPacks[0].categoryOrder?.length) { const order = new Map(selectedPacks[0].categoryOrder.map((name, index) => [name, index])); usable.sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999)); }",
)
patch(
    p,
    "      for (const value of QUESTION_VALUES.slice(0, config.rows)) {\n        const candidates = sourceQuestions.filter((question) => question.value === value);\n        const unseen = candidates.filter((question) => !this.seenQuestionIds.has(question.id));\n        const chosenQuestion = this.shuffle(unseen.length ? unseen : candidates)[0];",
    "      for (const [rowIndex, value] of QUESTION_VALUES.slice(0, config.rows).entries()) {\n        const candidates = sourceQuestions.filter((question) => question.value === value);\n        const preferredDifficulty = preferredDifficultyForRow(rowIndex, config.rows);\n        const preferred = candidates.filter((question) => question.difficulty === preferredDifficulty);\n        const unseenPreferred = preferred.filter((question) => !this.seenQuestionIds.has(question.id));\n        const unseen = candidates.filter((question) => !this.seenQuestionIds.has(question.id));\n        const chosenQuestion = this.shuffle(unseenPreferred.length ? unseenPreferred : preferred.length ? preferred : unseen.length ? unseen : candidates)[0];",
)
patch(
    p,
    "    room.state.gameEndedAt = null;\n    room.state.players.forEach((player) => this.resetPlayerForGame(player));",
    "    room.state.gameEndedAt = null;\n    room.state.undoLabel = null;\n    room.undoState = null;\n    room.state.players.forEach((player) => this.resetPlayerForGame(player));",
)
patch(
    p,
    "    room.state.finalRound = null;\n    room.finalQuestionId = null;\n    room.state.players.forEach((player) => this.resetPlayerForGame(player));",
    "    room.state.finalRound = null;\n    room.finalQuestionId = null;\n    room.state.undoLabel = null;\n    room.undoState = null;\n    room.state.players.forEach((player) => this.resetPlayerForGame(player));",
)
patch(
    p,
    "    if (room.state.phase !== 'board' || !room.state.board) throw new Error('Board is not ready');\n    const tile",
    "    if (room.state.phase !== 'board' || !room.state.board) throw new Error('Board is not ready');\n    room.undoState = null;\n    room.state.undoLabel = null;\n    const tile",
)
patch(
    p,
    "  private addScore(player: Player, delta: number, settings: GameSettings): void {",
    "  private recordUndo(room: RoomRecord, label: string): void { room.undoState = structuredClone(room.state); room.state.undoLabel = label; }\n\n  undoLast(roomCode: string, hostToken: string): RoomSnapshot {\n    const room = this.hostRoom(roomCode, hostToken);\n    if (!room.undoState) throw new Error('There is nothing to undo');\n    room.state = structuredClone(room.undoState);\n    room.undoState = null;\n    room.state.undoLabel = null;\n    this.touch(room);\n    this.persist();\n    return this.snapshot(roomCode);\n  }\n\n  private addScore(player: Player, delta: number, settings: GameSettings): void {",
)
patch(
    p,
    "    if (!current.dailyDouble && current.buzzWinnerId !== playerId) throw new Error('Only the buzz winner can be resolved');\n    let points",
    "    if (!current.dailyDouble && current.buzzWinnerId !== playerId) throw new Error('Only the buzz winner can be resolved');\n    this.recordUndo(room, `Ruling: ${player.name} ${correct ? 'correct' : 'incorrect'}`);\n    let points",
)
patch(
    p,
    "    if (response.resolvedCorrect !== null) throw new Error('Response is already graded');\n    response.resolvedCorrect = correct;",
    "    if (response.resolvedCorrect !== null) throw new Error('Response is already graded');\n    this.recordUndo(room, `Free response: ${player.name} ${correct ? 'correct' : 'incorrect'}`);\n    response.resolvedCorrect = correct;",
)
patch(
    p,
    "    if (!player || !Number.isFinite(delta) || Math.abs(delta) > 100_000) throw new Error('Invalid score adjustment');\n    this.addScore",
    "    if (!player || !Number.isFinite(delta) || Math.abs(delta) > 100_000) throw new Error('Invalid score adjustment');\n    this.recordUndo(room, `Score: ${player.name} ${delta >= 0 ? '+' : ''}${Math.round(delta)}`);\n    this.addScore",
)
patch(
    p,
    "    const selected = room.state.selectedPackIds.flatMap((packId) => this.getPack(packId)?.questions ?? []);\n    const candidates = selected.filter((question) => !room.questions[question.id] && !this.seenQuestionIds.has(question.id));\n    const fallback = selected.filter((question) => !room.questions[question.id]);\n    const question = this.shuffle(candidates.length ? candidates : fallback)[0];",
    "    const selectedPacks = room.state.selectedPackIds.map((packId) => this.getPack(packId)).filter((pack): pack is QuestionPack => Boolean(pack));\n    const selected = selectedPacks.flatMap((pack) => pack.questions);\n    const preferredFinal = selectedPacks.map((pack) => pack.finalQuestionId ? pack.questions.find((question) => question.id === pack.finalQuestionId) : undefined).find((question): question is Question => Boolean(question && !room.questions[question.id]));\n    const candidates = selected.filter((question) => !room.questions[question.id] && !this.seenQuestionIds.has(question.id));\n    const fallback = selected.filter((question) => !room.questions[question.id]);\n    const question = preferredFinal ?? this.shuffle(candidates.length ? candidates : fallback)[0];",
)
patch(
    p,
    "    const isCorrect = correct ?? suggestion.correct;\n    const wager",
    "    const isCorrect = correct ?? suggestion.correct;\n    this.recordUndo(room, `Final: ${player.name} ${isCorrect ? 'correct' : 'incorrect'}`);\n    const wager",
)

# ---------- Transport ----------
p = "src/lib/socket.ts"
patch(
    p,
    "    case 'host:update-settings': {",
    "    case 'host:rename-player': return engine.renamePlayer(roomCode, hostToken, String(payload.playerId ?? ''), String(payload.name ?? ''));\n    case 'host:undo': return engine.undoLast(roomCode, hostToken);\n    case 'host:request-diagnostics': {\n      engine.requestDiagnostics(roomCode, hostToken);\n      for (const target of connections) { const identity = identities.get(target); if (identity?.role === 'player' && identity.roomCode === roomCode) sendEvent(target, 'diagnostics:request', { startedAt: Date.now() }); }\n      return null;\n    }\n    case 'host:update-settings': {",
)
patch(
    p,
    "    case 'player:buzz': {",
    "    case 'player:ping': return engine.pingPlayer(roomCode, String(payload.playerId ?? ''), String(payload.reconnectToken ?? ''));\n    case 'player:diagnostic': return engine.updatePlayerDiagnostics(roomCode, String(payload.playerId ?? ''), String(payload.reconnectToken ?? ''), { latencyMs: Number(payload.latencyMs), haptics: Boolean(payload.haptics), inputTested: Boolean(payload.inputTested) });\n    case 'player:buzz': {",
)

# ---------- Tests ----------
Path("tests/experienceFeatures.test.ts").write_text("""import { beforeEach, describe, expect, it } from 'vitest';
import { BrowserGameEngine, type RandomSource } from '../src/lib/browserGameEngine';
import { preferredDifficultyForRow } from '../src/lib/boardBalance';
import { gameAwards } from '../src/lib/awards';
import { GAME_PRESETS } from '../src/shared/config';
import type { Player } from '../src/shared/types';

class MemoryStorage implements Storage { private values = new Map<string, string>(); get length() { return this.values.size; } clear() { this.values.clear(); } getItem(key: string) { return this.values.get(key) ?? null; } key(index: number) { return [...this.values.keys()][index] ?? null; } removeItem(key: string) { this.values.delete(key); } setItem(key: string, value: string) { this.values.set(key, String(value)); } }
class FixedRandom implements RandomSource { next() { return 0.23; } }
beforeEach(() => Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true }));

describe('experience systems', () => {
  it('assigns stable seats and reuses freed seats', () => { const e = new BrowserGameEngine(new FixedRandom(), 60_000); const h = e.createRoom('https://x'); const a = e.joinPlayer(h.roomCode, { name: 'A', avatar: 'A', accent: '#ffffff' }); e.joinPlayer(h.roomCode, { name: 'B', avatar: 'B', accent: '#ffffff' }); expect(e.snapshot(h.roomCode).players.map((p) => p.seat)).toEqual([1, 2]); e.setPlayerConnected(h.roomCode, a.playerId, false); e.reconnectPlayer(h.roomCode, a.playerId, a.reconnectToken); expect(e.snapshot(h.roomCode).players[0].seat).toBe(1); e.removePlayer(h.roomCode, h.hostToken, a.playerId); e.joinPlayer(h.roomCode, { name: 'C', avatar: 'C', accent: '#ffffff' }); expect(e.snapshot(h.roomCode).players.map((p) => p.seat).sort()).toEqual([1, 2]); });
  it('stores diagnostics and undoes score changes', () => { const e = new BrowserGameEngine(new FixedRandom(), 60_000); const h = e.createRoom('https://x'); const p = e.joinPlayer(h.roomCode, { name: 'A', avatar: 'A', accent: '#ffffff' }); e.updatePlayerDiagnostics(h.roomCode, p.playerId, p.reconnectToken, { latencyMs: 42, haptics: true, inputTested: true }); expect(e.snapshot(h.roomCode).players[0].diagnostics?.latencyMs).toBe(42); e.adjustScore(h.roomCode, h.hostToken, p.playerId, 500); expect(e.snapshot(h.roomCode).players[0].score).toBe(500); e.undoLast(h.roomCode, h.hostToken); expect(e.snapshot(h.roomCode).players[0].score).toBe(0); });
  it('renames players safely', () => { const e = new BrowserGameEngine(new FixedRandom(), 60_000); const h = e.createRoom('https://x'); const a = e.joinPlayer(h.roomCode, { name: 'A', avatar: 'A', accent: '#ffffff' }); e.joinPlayer(h.roomCode, { name: 'B', avatar: 'B', accent: '#ffffff' }); e.renamePlayer(h.roomCode, h.hostToken, a.playerId, 'Renamed'); expect(e.snapshot(h.roomCode).players[0].name).toBe('Renamed'); expect(() => e.renamePlayer(h.roomCode, h.hostToken, a.playerId, 'B')).toThrow(/already uses/i); });
  it('balances row difficulty', () => { expect(preferredDifficultyForRow(0, 6)).toBe('easy'); expect(preferredDifficultyForRow(2, 6)).toBe('medium'); expect(preferredDifficultyForRow(5, 6)).toBe('hard'); });
  it('ships four presets', () => { expect(Object.keys(GAME_PRESETS)).toEqual(['casual', 'fast', 'competitive', 'party']); });
  it('computes richer awards', () => { const base = { connected: true, positiveStreak: 0, coldStreak: 0, onFire: false, isCold: false, buzzEligible: false, hasBuzzedThisQuestion: false, finalWager: null, finalWagerSubmitted: false, finalAnswer: null, finalAnswerSubmitted: false, finalResolved: false }; const s = (g: number, b: number) => ({ correct: 4, incorrect: 1, longestStreak: 3, longestColdStreak: 1, dailyDoublesFound: 1, biggestWager: 500, fastestBuzzMs: b, pointsGained: g, pointsLost: 100 }); const players = [{ ...base, id: 'a', name: 'A', avatar: 'A', accent: '#fff', score: 1000, stats: s(1200, 310) }, { ...base, id: 'b', name: 'B', avatar: 'B', accent: '#fff', score: 900, stats: s(900, 250) }] as Player[]; const awards = gameAwards(players); expect(awards.find((a) => a.key === 'points')?.playerIds).toEqual(['a']); expect(awards.find((a) => a.key === 'buzz')?.playerIds).toEqual(['b']); });
});
""")

print('experience core patches applied')
