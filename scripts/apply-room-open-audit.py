from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    found = text.count(old)
    if found != count:
        raise SystemExit(f"{path}: expected {count} matches, found {found}: {old[:120]!r}")
    file.write_text(text.replace(old, new, count))

p = 'src/lib/browserGameEngine.ts'
replace(
    p,
    """      if (record.state.expiresAt <= now) continue;
      const claimedSeats = new Set<number>();
""",
    """      if (record.state.expiresAt <= now) continue;
      // Session locking was removed from the product. Normalize older persisted rooms so they remain joinable.
      record.state.locked = false;
      record.state.settings.lockRoomOnStart = false;
      const claimedSeats = new Set<number>();
"""
)
replace(
    p,
    """      settings: { ...DEFAULT_SETTINGS, ...settings, selectedPackIds },
""",
    """      settings: { ...DEFAULT_SETTINGS, ...settings, selectedPackIds, lockRoomOnStart: false },
"""
)
replace(
    p,
    """    room.state.settings = { ...room.state.settings, ...updates, selectedPackIds };
""",
    """    room.state.settings = { ...room.state.settings, ...updates, selectedPackIds, lockRoomOnStart: false };
"""
)
replace(
    p,
    """    room.state.locked = room.state.settings.lockRoomOnStart;
""",
    """    room.state.locked = false;
"""
)

p = 'tests/browserGameEngine.test.ts'
old = """  it('honors room locking while reserved players can still reconnect', () => {
    const { engine, host } = setup({ lockRoomOnStart: true });
    const player = addPlayer(engine, host.roomCode, 'One');
    engine.startGame(host.roomCode, host.hostToken);

    expect(() => addPlayer(engine, host.roomCode, 'Two')).toThrow(/locked/i);
    engine.setPlayerConnected(host.roomCode, player.playerId, false);
    expect(() => engine.reconnectPlayer(host.roomCode, player.playerId, player.reconnectToken)).not.toThrow();
  });
"""
new = """  it('keeps rooms open even when a legacy lock setting is requested', () => {
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
"""
replace(p, old, new)

print('always-open room audit fix applied')
