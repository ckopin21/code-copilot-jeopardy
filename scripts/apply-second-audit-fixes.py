from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:180]!r}")
    file.write_text(text.replace(old, new, 1))


def replace_exact_count(path: str, old: str, new: str, expected: int) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} matches, found {count}: {old[:180]!r}")
    file.write_text(text.replace(old, new))


# ----- Authoritative game-state hardening -----
replace_once(
    "src/shared/types.ts",
    "  /** True when the answer window expired with no response and the turn owner was penalized. */\n  timedOut?: boolean;\n  wager: number | null;",
    "  /** True when the answer window expired with no response and the turn owner was penalized. */\n  timedOut?: boolean;\n  /** Spoken response already judged for the current buzz/answer attempt. Guards retries and double-clicks. */\n  resolvedPlayerId?: string | null;\n  wager: number | null;",
)

replace_once(
    "src/lib/browserGameEngine.ts",
    "      record.state.settings.turnOrderMode ??= 'join-order';\n      record.state.turnPlayerId ??= null;",
    "      record.state.settings.turnOrderMode ??= 'join-order';\n      // Steals are not part of the current reveal-first product flow. Keep restored legacy rooms aligned with the live UI.\n      record.state.settings.stealsEnabled = false;\n      record.state.turnPlayerId ??= null;",
)
replace_once(
    "src/lib/browserGameEngine.ts",
    "      if (record.state.currentQuestion && !record.state.currentQuestion.participantIds) {\n        record.state.currentQuestion.participantIds = record.state.players.map((player) => player.id);\n      }",
    "      if (record.state.currentQuestion && !record.state.currentQuestion.participantIds) {\n        record.state.currentQuestion.participantIds = record.state.players.map((player) => player.id);\n      }\n      if (record.state.currentQuestion) record.state.currentQuestion.resolvedPlayerId ??= null;",
)
replace_once(
    "src/lib/browserGameEngine.ts",
    "      settings: { ...DEFAULT_SETTINGS, ...settings, selectedPackIds, lockRoomOnStart: false },",
    "      settings: { ...DEFAULT_SETTINGS, ...settings, selectedPackIds, lockRoomOnStart: false, stealsEnabled: false },",
)
replace_once(
    "src/lib/browserGameEngine.ts",
    "    room.state.settings = { ...room.state.settings, ...updates, selectedPackIds, lockRoomOnStart: false };",
    "    room.state.settings = { ...room.state.settings, ...updates, selectedPackIds, lockRoomOnStart: false, stealsEnabled: false };",
)
replace_once(
    "src/lib/browserGameEngine.ts",
    "    const isPlayableDailyDouble = tile.dailyDouble && connected.length > 0;\n    const responseMode = isPlayableDailyDouble ? 'buzz' : (question.responseMode ?? 'buzz');",
    "    const isPlayableDailyDouble = tile.dailyDouble && connected.length > 0;\n    const configuredResponseMode = isPlayableDailyDouble ? 'buzz' : (question.responseMode ?? 'buzz');\n    // A typed-response clue cannot make progress with no phones. Practice mode falls back to the normal reveal flow.\n    const responseMode = connected.length === 0 && configuredResponseMode === 'text' ? 'buzz' : configuredResponseMode;",
)
replace_once(
    "src/lib/browserGameEngine.ts",
    "      participantIds: connected.map((player) => player.id),\n      timedOut: false,\n      wager: null,",
    "      participantIds: connected.map((player) => player.id),\n      timedOut: false,\n      resolvedPlayerId: null,\n      wager: null,",
)
replace_once(
    "src/lib/browserGameEngine.ts",
    "    if (!current?.buzzOpen || current.buzzWinnerId) return { accepted: false, reason: 'Buzzers are locked', snapshot: this.snapshot(roomCode) };",
    "    if (room.state.phase !== 'question' || !current?.buzzOpen || current.buzzWinnerId) return { accepted: false, reason: 'Buzzers are locked', snapshot: this.snapshot(roomCode) };",
)
replace_once(
    "src/lib/browserGameEngine.ts",
    "    if (!player || !player.connected || !current?.buzzOpen || current.buzzWinnerId || !player.buzzEligible) throw new Error('Local buzz is not valid');",
    "    if (room.state.phase !== 'question' || !player || !player.connected || !current?.buzzOpen || current.buzzWinnerId || !player.buzzEligible) throw new Error('Local buzz is not valid');",
)
replace_exact_count(
    "src/lib/browserGameEngine.ts",
    "    current.buzzWinnerId = player.id;\n    current.buzzOpen = false;",
    "    current.buzzWinnerId = player.id;\n    current.resolvedPlayerId = null;\n    current.buzzOpen = false;",
    2,
)
replace_once(
    "src/lib/browserGameEngine.ts",
    "    if (!current || !player) throw new Error('No active answer to resolve');\n    if (current.responseMode === 'text') throw new Error('Use free-response grading for this question');",
    "    if (!current || !player) throw new Error('No active answer to resolve');\n    if (!current.answerRevealed) throw new Error('Reveal the answer before judging the response');\n    if (current.timedOut || current.resolvedPlayerId === playerId) throw new Error('This response is already resolved');\n    if (current.responseMode === 'text') throw new Error('Use free-response grading for this question');",
)
replace_once(
    "src/lib/browserGameEngine.ts",
    "    if (correct) player.stats.correct += 1; else player.stats.incorrect += 1;\n    this.applyStreak(player, correct, room.state.settings);\n    this.stopTimerInternal(room);",
    "    if (correct) player.stats.correct += 1; else player.stats.incorrect += 1;\n    this.applyStreak(player, correct, room.state.settings);\n    current.resolvedPlayerId = player.id;\n    this.stopTimerInternal(room);",
)
replace_once(
    "src/lib/browserGameEngine.ts",
    "    player.stats.incorrect += 1;\n    this.applyStreak(player, false, room.state.settings);\n    current.timedOut = true;",
    "    player.stats.incorrect += 1;\n    this.applyStreak(player, false, room.state.settings);\n    current.resolvedPlayerId = player.id;\n    current.timedOut = true;",
)
replace_once(
    "src/lib/browserGameEngine.ts",
    "    if (!current) throw new Error('No question to finish');\n    if (current.responseMode === 'text' && current.answerRevealed) {",
    "    if (!current) throw new Error('No question to finish');\n    if (!current.answerRevealed) throw new Error('Reveal and finish the question before returning to the board');\n    if (current.responseMode !== 'text' && !current.timedOut) {\n      const spokenPlayerId = current.dailyDoublePlayerId ?? current.buzzWinnerId;\n      if (spokenPlayerId && current.resolvedPlayerId !== spokenPlayerId) throw new Error('Judge the spoken response before returning to the board');\n    }\n    if (current.responseMode === 'text' && current.answerRevealed) {",
)

# ----- Shared UI rules -----
Path("src/lib/gameUiRules.ts").write_text("""import type { GamePhase } from '../shared/types';

export function turnIndicatorVisible(phase: GamePhase): boolean {
  return phase === 'board' || phase === 'question' || phase === 'daily-double-wager' || phase === 'daily-double-question';
}

export function turnIndicatorLabel(phase: GamePhase): 'SELECTS NEXT' | 'ON TURN' {
  return phase === 'board' ? 'SELECTS NEXT' : 'ON TURN';
}

/** Full Final wagers stay private on shared scoreboards until the completed recap. */
export function scoreboardWagersVisible(phase: GamePhase): boolean {
  return phase === 'recap';
}
""")

# ----- Scoreboard privacy and turn semantics -----
replace_once(
    "src/components/PlayerStrip.tsx",
    "export function PlayerStrip({ players, activeId, turnId, scoreOverrides = {} }: { players: Player[]; activeId?: string | null; turnId?: string | null; scoreOverrides?: Record<string, number> }) {",
    "export function PlayerStrip({ players, activeId, turnId, turnLabel = 'SELECTS NEXT', showWagers = false, scoreOverrides = {} }: { players: Player[]; activeId?: string | null; turnId?: string | null; turnLabel?: string; showWagers?: boolean; scoreOverrides?: Record<string, number> }) {",
)
replace_once(
    "src/components/PlayerStrip.tsx",
    "{turnId === player.id && <span className=\"turn-beacon\"><i>★</i><b>SELECTS NEXT</b></span>}",
    "{turnId === player.id && <span className=\"turn-beacon\"><i>★</i><b>{turnLabel}</b></span>}",
)
replace_once(
    "src/components/PlayerStrip.tsx",
    "{player.finalWagerSubmitted && player.finalWager !== null && <div className=\"player-wager-pill\">WAGER {player.finalWager.toLocaleString()}</div>}",
    "{showWagers && player.finalWagerSubmitted && player.finalWager !== null && <div className=\"player-wager-pill\">WAGER {player.finalWager.toLocaleString()}</div>}",
)

replace_once(
    "src/components/HostAppV3.tsx",
    "import { calculateComebackAward } from '../lib/comebackScoring';",
    "import { calculateComebackAward } from '../lib/comebackScoring';\nimport { scoreboardWagersVisible, turnIndicatorLabel, turnIndicatorVisible } from '../lib/gameUiRules';",
)
replace_once(
    "src/components/HostAppV3.tsx",
    "  const boardResults: BoardResultMap = Object.fromEntries(historyEntries.map((entry) => [entry.questionId, entry.attempts]));",
    "  const boardResults: BoardResultMap = Object.fromEntries(historyEntries.map((entry) => [entry.questionId, entry.attempts]));\n  const showTurnIndicator = turnIndicatorVisible(room.phase);\n  const turnLabel = turnIndicatorLabel(room.phase);",
)
replace_once(
    "src/components/HostAppV3.tsx",
    "      <PlayerStrip players={room.players} activeId={current?.buzzWinnerId ?? current?.dailyDoublePlayerId} turnId={room.phase === 'lobby' || room.phase === 'recap' ? null : room.turnPlayerId} scoreOverrides={scoreOverrides} />",
    "      <PlayerStrip players={room.players} activeId={current?.buzzWinnerId ?? current?.dailyDoublePlayerId} turnId={showTurnIndicator ? room.turnPlayerId : null} turnLabel={turnLabel} showWagers={scoreboardWagersVisible(room.phase)} scoreOverrides={scoreOverrides} />",
)
replace_once(
    "src/components/HostAppV3.tsx",
    "<small>{player[field] ? field === 'finalWagerSubmitted' ? `Locked · ${(player.finalWager ?? 0).toLocaleString()}` : 'Locked in' : 'Waiting'}</small>",
    "<small>{player[field] ? field === 'finalWagerSubmitted' ? 'Wager locked' : 'Answer locked' : 'Waiting'}</small>",
)

# ----- Phone turn indicator only while turns actually exist -----
replace_once(
    "src/components/PlayerApp.tsx",
    "import { menuUrl } from '../lib/resetInstance';",
    "import { menuUrl } from '../lib/resetInstance';\nimport { turnIndicatorVisible } from '../lib/gameUiRules';",
)
replace_once(
    "src/components/PlayerApp.tsx",
    "  const accuracy = Math.round(me.stats.correct / Math.max(1, me.stats.correct + me.stats.incorrect) * 100);",
    "  const accuracy = Math.round(me.stats.correct / Math.max(1, me.stats.correct + me.stats.incorrect) * 100);\n  const showTurnIndicator = turnIndicatorVisible(room.phase);",
)
replace_exact_count(
    "src/components/PlayerApp.tsx",
    "room.turnPlayerId === me.id && room.phase !== 'lobby' && room.phase !== 'recap'",
    "showTurnIndicator && room.turnPlayerId === me.id",
    2,
)

# ----- Remote presentation gets score motion, correct turn semantics, and true DD stake -----
replace_once(
    "src/components/PresentationApp.tsx",
    "import { useEffect, useMemo, useState } from 'react';",
    "import { useCallback, useEffect, useMemo, useRef, useState } from 'react';",
)
replace_once(
    "src/components/PresentationApp.tsx",
    "import { audio } from '../lib/audio';",
    "import { audio } from '../lib/audio';\nimport { scoreboardWagersVisible, turnIndicatorLabel, turnIndicatorVisible } from '../lib/gameUiRules';\nimport { ScoreFlight, type ScoreFlightState } from './ScoreFlight';",
)
replace_once(
    "src/components/PresentationApp.tsx",
    "  const [room, setRoom] = useState<RoomSnapshot | null>(null);\n  const [error, setError] = useState('');\n  const [audioReady, setAudioReady] = useState(false);\n\n  useEffect(() => {\n    const onState = (snapshot: RoomSnapshot) => setRoom(snapshot);\n    socket.on('room:state', onState);\n    void emitAck<RoomSnapshot>('presentation:join', { roomCode }).then(setRoom).catch((err) => setError(err instanceof Error ? err.message : 'Could not join game'));\n    return () => { socket.off('room:state', onState); audio.stop(); };\n  }, [roomCode]);",
    "  const [room, setRoom] = useState<RoomSnapshot | null>(null);\n  const [error, setError] = useState('');\n  const [audioReady, setAudioReady] = useState(false);\n  const [scoreFlights, setScoreFlights] = useState<ScoreFlightState[]>([]);\n  const [scoreOverrides, setScoreOverrides] = useState<Record<string, number>>({});\n  const latestRoomRef = useRef<RoomSnapshot | null>(null);\n\n  const applySnapshot = useCallback((snapshot: RoomSnapshot) => {\n    const previous = latestRoomRef.current;\n    if (previous && previous.code === snapshot.code && snapshot.phase !== 'lobby') {\n      const nextFlights: ScoreFlightState[] = [];\n      const nextOverrides: Record<string, number> = {};\n      for (const player of snapshot.players) {\n        const before = previous.players.find((candidate) => candidate.id === player.id);\n        if (!before || before.score === player.score) continue;\n        nextOverrides[player.id] = before.score;\n        nextFlights.push({\n          id: crypto.randomUUID(),\n          questionId: snapshot.currentQuestion?.questionId ?? previous.currentQuestion?.questionId ?? 'presentation-score-change',\n          playerId: player.id,\n          delta: player.score - before.score,\n          correct: player.score > before.score\n        });\n      }\n      if (nextFlights.length) {\n        setScoreOverrides((current) => ({ ...current, ...nextOverrides }));\n        setScoreFlights((current) => [...current, ...nextFlights]);\n      }\n    }\n    latestRoomRef.current = snapshot;\n    setRoom(snapshot);\n  }, []);\n\n  const handleScoreImpact = useCallback((flight: ScoreFlightState) => {\n    setScoreOverrides((current) => {\n      const next = { ...current };\n      delete next[flight.playerId];\n      return next;\n    });\n  }, []);\n  const handleScoreComplete = useCallback((flightId: string) => setScoreFlights((current) => current.filter((flight) => flight.id !== flightId)), []);\n\n  useEffect(() => {\n    const onState = (snapshot: RoomSnapshot) => applySnapshot(snapshot);\n    socket.on('room:state', onState);\n    void emitAck<RoomSnapshot>('presentation:join', { roomCode }).then(applySnapshot).catch((err) => setError(err instanceof Error ? err.message : 'Could not join game'));\n    return () => { socket.off('room:state', onState); audio.stop(); };\n  }, [roomCode, applySnapshot]);",
)
replace_once(
    "src/components/PresentationApp.tsx",
    "  const reviewPlayer = reviewPlayerId ? room.players.find((player) => player.id === reviewPlayerId) ?? null : null;",
    "  const reviewPlayer = reviewPlayerId ? room.players.find((player) => player.id === reviewPlayerId) ?? null : null;\n  const showTurnIndicator = turnIndicatorVisible(room.phase);\n  const turnLabel = turnIndicatorLabel(room.phase);\n  const questionMultiplier = current ? Math.max(1, Math.round(current.effectiveValue / Math.max(1, current.baseValue))) : 1;\n  const pointsAtStake = current?.dailyDouble\n    ? (current.wager ?? 0) * (room.settings.dailyDoubleStacksWithMultiplier ? questionMultiplier : 1)\n    : current?.effectiveValue ?? 0;",
)
replace_once(
    "src/components/PresentationApp.tsx",
    "    <PlayerStrip players={room.players} activeId={active} turnId={room.phase === 'lobby' || room.phase === 'recap' ? null : room.turnPlayerId}/>",
    "    <PlayerStrip players={room.players} activeId={active} turnId={showTurnIndicator ? room.turnPlayerId : null} turnLabel={turnLabel} showWagers={scoreboardWagersVisible(room.phase)} scoreOverrides={scoreOverrides}/>",
)
replace_once(
    "src/components/PresentationApp.tsx",
    "<div className=\"question-meta-v2\"><span>{current.category}</span><strong>{current.dailyDouble ? `WAGER ${current.wager}` : `${current.effectiveValue} POINTS`}</strong>{current.responseMode === 'text' && <em>FREE RESPONSE</em>}</div>",
    "<div className=\"question-meta-v2\"><span>{current.category}</span><strong>{current.dailyDouble ? `${pointsAtStake.toLocaleString()} POINTS IN PLAY` : `${current.effectiveValue} POINTS`}</strong>{current.responseMode === 'text' && <em>FREE RESPONSE</em>}</div>",
)
replace_once(
    "src/components/PresentationApp.tsx",
    "    {room.phase === 'recap' && <section className=\"presentation-center presentation-recap\"><div className=\"section-kicker gold\">GAME COMPLETE</div><h1>{winners.length === 1 ? `${winners[0].avatar} ${winners[0].name}` : 'TIE GAME'}</h1><div className=\"presentation-scores-v2\">{[...resultPlayers].sort((a,b)=>b.score-a.score).map((player)=><div key={player.id}><span>{player.avatar} {player.name}</span><strong>{player.score.toLocaleString()}</strong></div>)}</div></section>}\n  </main>;",
    "    {room.phase === 'recap' && <section className=\"presentation-center presentation-recap\"><div className=\"section-kicker gold\">GAME COMPLETE</div><h1>{winners.length === 1 ? `${winners[0].avatar} ${winners[0].name}` : 'TIE GAME'}</h1><div className=\"presentation-scores-v2\">{[...resultPlayers].sort((a,b)=>b.score-a.score).map((player)=><div key={player.id}><span>{player.avatar} {player.name}</span><strong>{player.score.toLocaleString()}</strong></div>)}</div></section>}\n    {scoreFlights[0] && <ScoreFlight flight={scoreFlights[0]} onImpact={handleScoreImpact} onComplete={handleScoreComplete} />}\n  </main>;",
)

replace_once(
    "src/components/ScoreFlight.tsx",
    "        ?? document.querySelector<HTMLElement>('.question-stage .question-card-v2, .presentation-question > article, .phone-question-stage-v2');",
    "        ?? document.querySelector<HTMLElement>('.question-stage .question-card-v2, .presentation-question > article, .presentation-shell > section, .phone-question-stage-v2');",
)

# ----- Adversarial regression coverage -----
tests = Path("tests/browserGameEngine.test.ts")
text = tests.read_text()
old_steal = """  it('does not let a late joiner enter a reopened steal window', () => {\n    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, timerSeconds: null, stealsEnabled: true });\n    const one = addPlayer(engine, host.roomCode, 'One');\n    const two = addPlayer(engine, host.roomCode, 'Two');\n    engine.startGame(host.roomCode, host.hostToken);\n    const tile = firstUnused(engine, host.roomCode);\n    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);\n    const late = addPlayer(engine, host.roomCode, 'Late');\n    engine.openBuzzers(host.roomCode, host.hostToken);\n    expect(engine.buzz(host.roomCode, one.playerId, one.reconnectToken).accepted).toBe(true);\n    engine.resolveAnswer(host.roomCode, host.hostToken, one.playerId, false);\n    const state = engine.snapshot(host.roomCode);\n    expect(state.currentQuestion?.buzzOpen).toBe(true);\n    expect(state.players.find((player) => player.id === two.playerId)?.buzzEligible).toBe(true);\n    expect(state.players.find((player) => player.id === late.playerId)?.buzzEligible).toBe(false);\n    expect(engine.buzz(host.roomCode, late.playerId, late.reconnectToken).accepted).toBe(false);\n  });\n\n"""
new_steal = """  it('normalizes the unsupported steal setting off so reveal-first judging cannot expose an answer to a reopened buzzer', () => {\n    const { engine, host } = setup({ stealsEnabled: true });\n    expect(engine.snapshot(host.roomCode).settings.stealsEnabled).toBe(false);\n    engine.updateSettings(host.roomCode, host.hostToken, { stealsEnabled: true });\n    expect(engine.snapshot(host.roomCode).settings.stealsEnabled).toBe(false);\n  });\n\n"""
if text.count(old_steal) != 1:
    raise SystemExit("Could not replace legacy steal audit test")
text = text.replace(old_steal, new_steal, 1)
marker = "  it('keeps exact late-game multiplier windows', () => {"
if text.count(marker) != 1:
    raise SystemExit("Could not locate second-audit test insertion point")
addition = """  it('rejects a duplicate spoken ruling so a double-click cannot score twice', () => {\n    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false });\n    const player = addPlayer(engine, host.roomCode, 'Double Click');\n    engine.startGame(host.roomCode, host.hostToken);\n    const tile = firstUnused(engine, host.roomCode);\n    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);\n    engine.openBuzzers(host.roomCode, host.hostToken);\n    engine.localBuzz(host.roomCode, host.hostToken, player.playerId);\n    engine.revealAnswer(host.roomCode, host.hostToken);\n    engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, true);\n    const afterFirst = engine.snapshot(host.roomCode).players.find((candidate) => candidate.id === player.playerId)!.score;\n    expect(() => engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, true)).toThrow(/already resolved/i);\n    expect(engine.snapshot(host.roomCode).players.find((candidate) => candidate.id === player.playerId)!.score).toBe(afterFirst);\n  });\n\n  it('does not accept a buzz while the game is paused, then restores it after resume', () => {\n    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, timerSeconds: null });\n    const player = addPlayer(engine, host.roomCode, 'Paused');\n    engine.startGame(host.roomCode, host.hostToken);\n    const tile = firstUnused(engine, host.roomCode);\n    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);\n    engine.openBuzzers(host.roomCode, host.hostToken);\n    engine.pause(host.roomCode, host.hostToken);\n    expect(engine.buzz(host.roomCode, player.playerId, player.reconnectToken).accepted).toBe(false);\n    expect(() => engine.localBuzz(host.roomCode, host.hostToken, player.playerId)).toThrow(/not valid/i);\n    engine.resume(host.roomCode, host.hostToken);\n    expect(engine.buzz(host.roomCode, player.playerId, player.reconnectToken).accepted).toBe(true);\n  });\n\n  it('keeps zero-player practice playable when a source clue is configured as typed response', () => {\n    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, timerSeconds: null });\n    engine.startGame(host.roomCode, host.hostToken);\n    const tile = firstUnused(engine, host.roomCode);\n    const rooms = (engine as unknown as { rooms: Map<string, { questions: Record<string, { responseMode?: 'buzz' | 'text' }> }> }).rooms;\n    rooms.get(host.roomCode)!.questions[tile.questionId].responseMode = 'text';\n    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);\n    expect(engine.snapshot(host.roomCode).currentQuestion?.responseMode).toBe('buzz');\n    engine.revealAnswer(host.roomCode, host.hostToken);\n    expect(() => engine.advanceToBoard(host.roomCode, host.hostToken)).not.toThrow();\n  });\n\n  it('will not leave an unfinished or unjudged spoken clue', () => {\n    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false });\n    const player = addPlayer(engine, host.roomCode, 'Judge Me');\n    engine.startGame(host.roomCode, host.hostToken);\n    const tile = firstUnused(engine, host.roomCode);\n    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);\n    expect(() => engine.advanceToBoard(host.roomCode, host.hostToken)).toThrow(/reveal and finish/i);\n    engine.openBuzzers(host.roomCode, host.hostToken);\n    engine.localBuzz(host.roomCode, host.hostToken, player.playerId);\n    engine.revealAnswer(host.roomCode, host.hostToken);\n    expect(() => engine.advanceToBoard(host.roomCode, host.hostToken)).toThrow(/judge the spoken response/i);\n  });\n\n"""
tests.write_text(text.replace(marker, addition + marker, 1))

Path("tests/gameUiRules.test.ts").write_text("""import { describe, expect, it } from 'vitest';
import { scoreboardWagersVisible, turnIndicatorLabel, turnIndicatorVisible } from '../src/lib/gameUiRules';

describe('shared game UI rules', () => {
  it('shows turn ownership only during the board round', () => {
    expect(turnIndicatorVisible('board')).toBe(true);
    expect(turnIndicatorVisible('question')).toBe(true);
    expect(turnIndicatorVisible('daily-double-wager')).toBe(true);
    expect(turnIndicatorVisible('daily-double-question')).toBe(true);
    expect(turnIndicatorVisible('final-category')).toBe(false);
    expect(turnIndicatorVisible('final-wager')).toBe(false);
    expect(turnIndicatorVisible('final-question')).toBe(false);
    expect(turnIndicatorVisible('final-review')).toBe(false);
    expect(turnIndicatorVisible('recap')).toBe(false);
  });

  it('uses a truthful turn label for board versus active clue states', () => {
    expect(turnIndicatorLabel('board')).toBe('SELECTS NEXT');
    expect(turnIndicatorLabel('question')).toBe('ON TURN');
    expect(turnIndicatorLabel('daily-double-question')).toBe('ON TURN');
  });

  it('keeps full Final wagers off shared scoreboards until recap', () => {
    expect(scoreboardWagersVisible('final-wager')).toBe(false);
    expect(scoreboardWagersVisible('final-question')).toBe(false);
    expect(scoreboardWagersVisible('final-review')).toBe(false);
    expect(scoreboardWagersVisible('recap')).toBe(true);
  });
});
""")
