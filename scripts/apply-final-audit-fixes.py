from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:160]!r}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/components/HostAppV3.tsx",
    '<label>Turn<select value={controllerId}',
    '<label className="turn-selector">Turn<select value={controllerId}',
)

replace_once(
    "src/lib/browserGameEngine.ts",
    "      current.buzzWinnerId = null;\n      room.state.players.forEach((candidate) => { candidate.buzzEligible = candidate.connected && (room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(candidate.id)); });",
    "      current.buzzWinnerId = null;\n      const participants = new Set(current.participantIds ?? room.state.players.map((candidate) => candidate.id));\n      room.state.players.forEach((candidate) => { candidate.buzzEligible = candidate.connected && participants.has(candidate.id) && (room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(candidate.id)); });",
)

tests = Path("tests/browserGameEngine.test.ts")
text = tests.read_text()
marker = "  it('keeps exact late-game multiplier windows', () => {"
if text.count(marker) != 1:
    raise SystemExit("Could not locate final audit test insertion point")
addition = """  it('lets the host explicitly move turn ownership on the board', () => {\n    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, turnOrderMode: 'manual' });\n    addPlayer(engine, host.roomCode, 'One');\n    const two = addPlayer(engine, host.roomCode, 'Two');\n    engine.startGame(host.roomCode, host.hostToken);\n    engine.setTurnPlayer(host.roomCode, host.hostToken, two.playerId);\n    expect(engine.snapshot(host.roomCode).turnPlayerId).toBe(two.playerId);\n    const tile = firstUnused(engine, host.roomCode);\n    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);\n    expect(engine.snapshot(host.roomCode).currentQuestion?.turnPlayerId).toBe(two.playerId);\n  });\n\n  it('does not let a late joiner enter a reopened steal window', () => {\n    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, timerSeconds: null, stealsEnabled: true });\n    const one = addPlayer(engine, host.roomCode, 'One');\n    const two = addPlayer(engine, host.roomCode, 'Two');\n    engine.startGame(host.roomCode, host.hostToken);\n    const tile = firstUnused(engine, host.roomCode);\n    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);\n    const late = addPlayer(engine, host.roomCode, 'Late');\n    engine.openBuzzers(host.roomCode, host.hostToken);\n    expect(engine.buzz(host.roomCode, one.playerId, one.reconnectToken).accepted).toBe(true);\n    engine.resolveAnswer(host.roomCode, host.hostToken, one.playerId, false);\n    const state = engine.snapshot(host.roomCode);\n    expect(state.currentQuestion?.buzzOpen).toBe(true);\n    expect(state.players.find((player) => player.id === two.playerId)?.buzzEligible).toBe(true);\n    expect(state.players.find((player) => player.id === late.playerId)?.buzzEligible).toBe(false);\n    expect(engine.buzz(host.roomCode, late.playerId, late.reconnectToken).accepted).toBe(false);\n  });\n\n"""
tests.write_text(text.replace(marker, addition + marker, 1))
