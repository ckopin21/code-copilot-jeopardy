from pathlib import Path

path = Path('scripts/apply-audit-lifecycle-hardening.py')
text = path.read_text()

old = 'replace_once("src/components/HostAppV3.tsx", "id: crypto.randomUUID(),", "id: randomId(\'score-flight\'),")'
new = '''host_path = Path("src/components/HostAppV3.tsx")
host_text = host_path.read_text()
needle = "id: crypto.randomUUID(),"
if host_text.count(needle) != 2:
    raise SystemExit(f"src/components/HostAppV3.tsx: expected 2 randomUUID score ids, found {host_text.count(needle)}")
host_path.write_text(host_text.replace(needle, "id: randomId('score-flight'),"))'''
if old not in text:
    raise SystemExit('score-flight patch marker not found')
text = text.replace(old, new, 1)

# Keep the established Final rule: long-disconnected seats stay out. Only a player
# who was eligible on the final clue is rescued from a disconnect during that clue.
old = '''    """      if (room.state.settings.finalRoundEnabled && this.connectedPlayers(room).length > 0) this.prepareFinalRound(room);\n      else this.finishGame(room);""",\n    """      if (room.state.settings.finalRoundEnabled && room.state.players.length > 0) this.prepareFinalRound(room);\n      else this.finishGame(room);""",'''
new = '''    """      if (room.state.settings.finalRoundEnabled && this.connectedPlayers(room).length > 0) this.prepareFinalRound(room);\n      else this.finishGame(room);""",\n    """      const finalEligibleIds = current.participantIds ?? [];\n      const hasFinalist = this.connectedPlayers(room).length > 0 || finalEligibleIds.some((playerId) => room.state.players.some((player) => player.id === playerId));\n      if (room.state.settings.finalRoundEnabled && hasFinalist) this.prepareFinalRound(room, finalEligibleIds);\n      else this.finishGame(room);""",'''
if old not in text:
    raise SystemExit('Final transition patch marker not found')
text = text.replace(old, new, 1)

old = '''    """  private prepareFinalRound(room: RoomRecord): void {\n    const participantIds = this.connectedPlayers(room).map((player) => player.id);\n    if (!participantIds.length) { this.finishGame(room); return; }""",\n    """  private prepareFinalRound(room: RoomRecord): void {\n    // Freeze every reserved seat that was part of the game, not only the exact millisecond's\n    // connected set. Brief Wi-Fi drops at the last clue must not silently remove Final.\n    const participantIds = [...room.state.players].sort((a, b) => a.seat - b.seat).map((player) => player.id);\n    if (!participantIds.length) { this.finishGame(room); return; }""",'''
new = '''    """  private prepareFinalRound(room: RoomRecord): void {\n    const participantIds = this.connectedPlayers(room).map((player) => player.id);\n    if (!participantIds.length) { this.finishGame(room); return; }""",\n    """  private prepareFinalRound(room: RoomRecord, recentlyEligibleIds: string[] = []): void {\n    // Preserve normal connected-only Final eligibility, but rescue a controller that\n    // dropped during the final clue after already being part of that clue's roster.\n    const recentlyEligible = new Set(recentlyEligibleIds);\n    const participantIds = room.state.players\n      .filter((player) => player.connected || recentlyEligible.has(player.id))\n      .sort((a, b) => a.seat - b.seat)\n      .map((player) => player.id);\n    if (!participantIds.length) { this.finishGame(room); return; }""",'''
if old not in text:
    raise SystemExit('prepareFinalRound patch marker not found')
text = text.replace(old, new, 1)

path.write_text(text)
