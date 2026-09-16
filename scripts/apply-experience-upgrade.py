from pathlib import Path


def patch(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    found = text.count(old)
    if found != count:
        raise SystemExit(f"{path}: expected {count} matches, found {found}: {old[:100]!r}")
    file.write_text(text.replace(old, new, count))


p = 'src/lib/browserGameEngine.ts'
patch(p, "const STORAGE_KEY = 'blue-stage-p2p-engine-v2';\nconst ROOM_TTL_MS", "const STORAGE_KEY = 'blue-stage-p2p-engine-v2';\nconst STORAGE_BACKUP_KEY = 'blue-stage-p2p-engine-v2-backup';\nconst ROOM_TTL_MS")
patch(p, "function loadRooms(): RoomRecord[] {\n  try {\n    const raw = localStorage.getItem(STORAGE_KEY);\n    if (!raw) return [];\n    const parsed = JSON.parse(raw) as RoomRecord[];\n    return Array.isArray(parsed) ? parsed : [];\n  } catch { return []; }\n}", "function loadRooms(): RoomRecord[] {\n  const parse = (raw: string | null): RoomRecord[] | null => {\n    if (!raw) return null;\n    try {\n      const parsed = JSON.parse(raw) as RoomRecord[];\n      return Array.isArray(parsed) ? parsed : null;\n    } catch {\n      return null;\n    }\n  };\n  return parse(localStorage.getItem(STORAGE_KEY)) ?? parse(localStorage.getItem(STORAGE_BACKUP_KEY)) ?? [];\n}")
patch(p, "  private persist(): void {\n    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.rooms.values()])); }\n    catch { /* keep the in-memory game running */ }\n  }", "  private persist(): void {\n    try {\n      const serialized = JSON.stringify([...this.rooms.values()]);\n      const previous = localStorage.getItem(STORAGE_KEY);\n      if (previous && previous !== serialized) localStorage.setItem(STORAGE_BACKUP_KEY, previous);\n      localStorage.setItem(STORAGE_KEY, serialized);\n    } catch { /* keep the in-memory game running */ }\n  }")
patch(p, "    const pool = selectedPacks.flatMap((pack) => pack.questions);", "    const pool = selectedPacks.flatMap((pack) => pack.questions.filter((question) => question.id !== pack.finalQuestionId));")

p = 'src/components/HostAppV3.tsx'
patch(p, "      const activePlayers = room.players.filter((player) => player.connected);\n      const index = Number(event.key) - 1;\n      if (index >= 0 && index < activePlayers.length) void perform('host:local-buzz', { playerId: activePlayers[index].id });", "      const seat = Number(event.key);\n      const player = room.players.find((candidate) => candidate.connected && candidate.seat === seat);\n      if (player) void perform('host:local-buzz', { playerId: player.id });")
patch(p, "    const activePlayers = room.players.filter((player) => player.connected);\n    const poll = () => {\n      navigator.getGamepads?.().forEach((pad, index) => {\n        if (!pad || !activePlayers[index]) return;", "    const poll = () => {\n      navigator.getGamepads?.().forEach((pad, index) => {\n        const player = room.players.find((candidate) => candidate.connected && candidate.seat === index + 1);\n        if (!pad || !player) return;")
patch(p, "        if (pressed) void perform('host:local-buzz', { playerId: activePlayers[index].id });", "        if (pressed) void perform('host:local-buzz', { playerId: player.id });")
patch(p, "  const showJoinControl = room.phase === 'lobby' || room.phase === 'board';", "  const showJoinControl = room.phase === 'lobby';")
patch(p, "              const keyIndex = connectedPlayers.findIndex((candidate) => candidate.id === player.id);\n              return <div className={`roster-row ${player.connected ? '' : 'reserved'}`} key={player.id}><span className=\"roster-avatar\">{player.avatar}</span><div><strong>{player.name}</strong><small>{player.connected ? `Connected · key ${keyIndex + 1}` : 'Disconnected · seat reserved'}</small></div>", "              return <div className={`roster-row ${player.connected ? '' : 'reserved'}`} key={player.id}><span className=\"roster-avatar\">{player.avatar}</span><div><strong>{player.name}</strong><small>{player.connected ? `Seat ${player.seat} · key ${player.seat}` : `Seat ${player.seat} · disconnected · reserved`}</small></div>")

p = 'src/lib/audio.ts'
patch(p, "type Cue = 'click' | 'open' | 'buzz' | 'locked' | 'correct' | 'wrong' | 'daily-double' | 'fire' | 'cold' | 'phase' | 'reveal';", "export type Cue = 'click' | 'open' | 'buzz' | 'locked' | 'correct' | 'wrong' | 'daily-double' | 'fire' | 'cold' | 'phase' | 'reveal' | 'category' | 'round' | 'score' | 'winner' | 'diagnostic';")
patch(p, "  cue(name: Cue): void {\n    if (!this.context || !this.effects || this.settings.muted) return;", "  cue(name: Cue): void {\n    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('blue-stage:audio-cue', { detail: name }));\n    if (!this.context || !this.effects || this.settings.muted) return;")
patch(p, "      phase: [[330, 0, .06], [494, .06, .08], [659, .13, .14]],\n      reveal: [[523, 0, .06], [659, .055, .07], [784, .11, .09], [1047, .19, .18]]", "      phase: [[330, 0, .06], [494, .06, .08], [659, .13, .14]],\n      reveal: [[523, 0, .06], [659, .055, .07], [784, .11, .09], [1047, .19, .18]],\n      category: [[392, 0, .07], [523, .07, .08], [659, .14, .1], [784, .23, .18]],\n      round: [[196, 0, .12], [392, .09, .12], [523, .2, .14], [784, .32, .24]],\n      score: [[659, 0, .05], [880, .05, .12]],\n      winner: [[523, 0, .08], [659, .07, .08], [784, .14, .1], [1047, .23, .28]],\n      diagnostic: [[523, 0, .06], [784, .08, .12]]")

p = 'src/components/ScoreFlight.tsx'
patch(p, "import { useEffect } from 'react';", "import { useEffect } from 'react';\nimport { audio } from '../lib/audio';")
patch(p, "        onImpact(flight);\n        scoreTarget.classList.remove('score-impact-pulse-correct', 'score-impact-pulse-wrong');", "        onImpact(flight);\n        audio.cue('score');\n        scoreTarget.classList.remove('score-impact-pulse-correct', 'score-impact-pulse-wrong');")

p = 'src/lib/accessibility.ts'
patch(p, "  reduceMotion: boolean;\n}", "  reduceMotion: boolean;\n  soundCaptions: boolean;\n}")
patch(p, "  reduceMotion: false\n};", "  reduceMotion: false,\n  soundCaptions: false\n};")
patch(p, "  root.dataset.reduceMotion = preferences.reduceMotion ? 'true' : 'false';", "  root.dataset.reduceMotion = preferences.reduceMotion ? 'true' : 'false';\n  root.dataset.soundCaptions = preferences.soundCaptions ? 'true' : 'false';")

p = 'tests/browserGameEngine.test.ts'
text = Path(p).read_text()
insert = """

  it('falls back to the recovery snapshot when the primary room snapshot is corrupt', () => {
    const { engine, host } = setup();
    addPlayer(engine, host.roomCode, 'Recovery');
    engine.startGame(host.roomCode, host.hostToken);
    const expected = engine.snapshot(host.roomCode);
    engine.pause(host.roomCode, host.hostToken);
    localStorage.setItem('blue-stage-p2p-engine-v2', '{broken');
    const recovered = new BrowserGameEngine(new FixedRandom(), 60_000).snapshot(host.roomCode);
    expect(recovered.code).toBe(expected.code);
    expect(recovered.board?.questions.length).toBe(expected.board?.questions.length);
  });
"""
marker = "\n  it('restores an active timer instead of erasing it on host reload', () => {"
if marker not in text:
    raise SystemExit('test insertion marker not found')
Path(p).write_text(text.replace(marker, insert + marker, 1))

print('final integration hardening applied')
