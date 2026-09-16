from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected 1 match, found {count}: {old[:160]!r}")
    file.write_text(text.replace(old, new, 1))


# An empty result roster is meaningful for 0-player practice mode. Only migrate truly missing legacy state.
replace_once(
    'src/lib/browserGameEngine.ts',
    "if (record.state.phase === 'recap' && !record.state.resultPlayerIds?.length) {",
    "if (record.state.phase === 'recap' && record.state.resultPlayerIds === undefined) {"
)

# UI consumers must distinguish an intentionally empty frozen roster from legacy state without one.
replace_once(
    'src/components/HostAppV3.tsx',
    "const resultIds = room.resultPlayerIds?.length ? new Set(room.resultPlayerIds) : null;",
    "const resultIds = room.resultPlayerIds ? new Set(room.resultPlayerIds) : null;"
)
replace_once(
    'src/components/PresentationApp.tsx',
    "const ids = room.resultPlayerIds?.length ? new Set(room.resultPlayerIds) : null;",
    "const ids = room.resultPlayerIds ? new Set(room.resultPlayerIds) : null;"
)
replace_once(
    'src/components/PlayerApp.tsx',
    "const isResultPlayer = !room.resultPlayerIds?.length || room.resultPlayerIds.includes(me.id);",
    "const isResultPlayer = room.resultPlayerIds ? room.resultPlayerIds.includes(me.id) : true;"
)

# Regression: a player joining after an empty practice game must not enter the frozen results.
p = 'tests/browserGameEngine.test.ts'
text = Path(p).read_text()
marker = """  it('freezes recap results before players join after a non-Final game ends', () => {
"""
insert = """  it('keeps an empty practice result roster empty when someone joins after the game', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: false });
    engine.startGame(host.roomCode, host.hostToken);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    expect(engine.snapshot(host.roomCode).resultPlayerIds).toEqual([]);

    addPlayer(engine, host.roomCode, 'Late');
    expect(engine.snapshot(host.roomCode).resultPlayerIds).toEqual([]);
  });

"""
if marker not in text:
    raise SystemExit('practice result test insertion marker not found')
Path(p).write_text(text.replace(marker, insert + marker, 1))

print('empty result-roster sentinel fixes applied')
