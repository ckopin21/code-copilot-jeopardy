from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:140]!r}")
    file.write_text(text.replace(old, new, 1))


# Current-question roster is frozen when a clue starts so late joins cannot affect an active clue.
replace_once(
    "src/shared/types.ts",
    "  /** Player whose turn selected this question. */\n  turnPlayerId: string | null;\n  /** True when the answer window expired with no response and the turn owner was penalized. */",
    "  /** Player whose turn selected this question. */\n  turnPlayerId: string | null;\n  /** Players eligible to answer this question. Late joins wait until the next clue. */\n  participantIds?: string[];\n  /** True when the answer window expired with no response and the turn owner was penalized. */",
)

# Turn rotation/reconnect hardening and per-question participation.
replace_once(
    "src/lib/browserGameEngine.ts",
    "  private connectedPlayers(room: RoomRecord): Player[] { return room.state.players.filter((player) => player.connected).sort((a, b) => a.seat - b.seat); }\n  private ensureTurnPlayer(room: RoomRecord): Player | null {\n    const connected = this.connectedPlayers(room);\n    if (!connected.length) { room.state.turnPlayerId = null; return null; }\n    const current = connected.find((player) => player.id === room.state.turnPlayerId) ?? connected[0];\n    room.state.turnPlayerId = current.id;\n    return current;\n  }\n  private advanceTurn(room: RoomRecord): void {\n    if (room.state.settings.turnOrderMode === 'manual') { this.ensureTurnPlayer(room); return; }\n    const connected = this.connectedPlayers(room);\n    if (!connected.length) { room.state.turnPlayerId = null; return; }\n    const index = connected.findIndex((player) => player.id === room.state.turnPlayerId);\n    room.state.turnPlayerId = connected[(index < 0 ? 0 : index + 1) % connected.length].id;\n  }",
    "  private connectedPlayers(room: RoomRecord): Player[] { return room.state.players.filter((player) => player.connected).sort((a, b) => a.seat - b.seat); }\n  private nextConnectedAfterSeat(room: RoomRecord, seat: number): Player | null {\n    const connected = this.connectedPlayers(room);\n    if (!connected.length) return null;\n    return connected.find((player) => player.seat > seat) ?? connected[0];\n  }\n  private currentQuestionParticipants(room: RoomRecord): Player[] {\n    const connected = this.connectedPlayers(room);\n    const ids = room.state.currentQuestion?.participantIds;\n    if (!ids) return connected;\n    const eligible = new Set(ids);\n    return connected.filter((player) => eligible.has(player.id));\n  }\n  private ensureTurnPlayer(room: RoomRecord): Player | null {\n    const connected = this.connectedPlayers(room);\n    if (!connected.length) { room.state.turnPlayerId = null; return null; }\n    const current = connected.find((player) => player.id === room.state.turnPlayerId);\n    if (current) return current;\n    const priorSeat = room.state.players.find((player) => player.id === room.state.turnPlayerId)?.seat ?? 0;\n    const replacement = this.nextConnectedAfterSeat(room, priorSeat) ?? connected[0];\n    room.state.turnPlayerId = replacement.id;\n    return replacement;\n  }\n  private advanceTurn(room: RoomRecord): void {\n    if (room.state.settings.turnOrderMode === 'manual') { this.ensureTurnPlayer(room); return; }\n    const currentSeat = room.state.players.find((player) => player.id === room.state.turnPlayerId)?.seat ?? 0;\n    const next = this.nextConnectedAfterSeat(room, currentSeat);\n    room.state.turnPlayerId = next?.id ?? null;\n  }",
)

replace_once(
    "src/lib/browserGameEngine.ts",
    "      record.state.settings.turnOrderMode ??= 'join-order';\n      record.state.turnPlayerId ??= null;\n      const claimedSeats = new Set<number>();",
    "      record.state.settings.turnOrderMode ??= 'join-order';\n      record.state.turnPlayerId ??= null;\n      if (record.state.currentQuestion && !record.state.currentQuestion.participantIds) {\n        record.state.currentQuestion.participantIds = record.state.players.map((player) => player.id);\n      }\n      const claimedSeats = new Set<number>();",
)

replace_once(
    "src/lib/browserGameEngine.ts",
    "  reconnectPlayer(roomCode: string, playerId: string, reconnectToken: string): PlayerJoinCredentials {\n    const [room, player] = this.playerRoom(roomCode, playerId, reconnectToken);\n    player.connected = true;\n    this.persist();\n    return { playerId, reconnectToken, roomCode: room.state.code };\n  }",
    "  reconnectPlayer(roomCode: string, playerId: string, reconnectToken: string): PlayerJoinCredentials {\n    const [room, player] = this.playerRoom(roomCode, playerId, reconnectToken);\n    player.connected = true;\n    const current = room.state.currentQuestion;\n    if (room.state.phase === 'board') this.ensureTurnPlayer(room);\n    if (current?.buzzOpen && !current.buzzWinnerId && current.responseMode !== 'text') {\n      const participating = !current.participantIds || current.participantIds.includes(player.id);\n      player.buzzEligible = participating && (room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(player.id));\n    }\n    this.persist();\n    return { playerId, reconnectToken, roomCode: room.state.code };\n  }",
)

replace_once(
    "src/lib/browserGameEngine.ts",
    "    player.connected = connected;\n    if (!connected) {\n      player.buzzEligible = false;",
    "    player.connected = connected;\n    if (!connected) {\n      player.buzzEligible = false;",
)

replace_once(
    "src/lib/browserGameEngine.ts",
    "      if (room.state.phase === 'question' && current?.responseMode === 'text' && !current.answerRevealed) {\n        const active = this.connectedPlayers(room);\n        if (active.length === 0 || active.every((candidate) => Boolean(current.textResponses?.[candidate.id]))) this.closeTextResponsesInternal(room);\n      }",
    "      if (room.state.phase === 'question' && current?.responseMode === 'text' && !current.answerRevealed) {\n        const active = this.currentQuestionParticipants(room);\n        if (active.length === 0 || active.every((candidate) => Boolean(current.textResponses?.[candidate.id]))) this.closeTextResponsesInternal(room);\n      }",
)

replace_once(
    "src/lib/browserGameEngine.ts",
    "    }\n    this.touch(room);\n    this.persist();\n  }\n  suspendPlayer",
    "    } else {\n      const current = room.state.currentQuestion;\n      if (current?.buzzOpen && !current.buzzWinnerId && current.responseMode !== 'text') {\n        const participating = !current.participantIds || current.participantIds.includes(player.id);\n        player.buzzEligible = participating && (room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(player.id));\n      }\n    }\n    if (room.state.phase === 'board') this.ensureTurnPlayer(room);\n    this.touch(room);\n    this.persist();\n  }\n  suspendPlayer",
)

replace_once(
    "src/lib/browserGameEngine.ts",
    "  renamePlayer(roomCode: string, hostToken: string, playerId: string, requestedName: string): RoomSnapshot {\n    const room = this.hostRoom(roomCode, hostToken);\n    const player = room.state.players.find((item) => item.id === playerId);\n    if (!player) throw new Error('Player not found');\n    const clean = requestedName.trim().replace(/\\s+/g, ' ').slice(0, 24);\n    if (!clean) throw new Error('Enter a player name');\n    const duplicateCount = room.state.players.filter((candidate) => candidate.id !== playerId && candidate.name.toLowerCase() === clean.toLowerCase()).length;\n    player.name = duplicateCount ? `${clean} ${duplicateCount + 1}`.slice(0, 24) : clean;\n    this.persist();\n    return this.snapshot(roomCode);\n  }",
    "  renamePlayer(roomCode: string, hostToken: string, playerId: string, requestedName: string): RoomSnapshot {\n    const room = this.hostRoom(roomCode, hostToken);\n    const player = room.state.players.find((item) => item.id === playerId);\n    if (!player) throw new Error('Player not found');\n    const clean = requestedName.trim().replace(/\\s+/g, ' ').slice(0, 24);\n    if (!clean) throw new Error('Enter a player name');\n    const duplicateCount = room.state.players.filter((candidate) => candidate.id !== playerId && candidate.name.toLowerCase() === clean.toLowerCase()).length;\n    player.name = duplicateCount ? `${clean} ${duplicateCount + 1}`.slice(0, 24) : clean;\n    this.persist();\n    return this.snapshot(roomCode);\n  }\n\n  setTurnPlayer(roomCode: string, hostToken: string, playerId: string): RoomSnapshot {\n    const room = this.hostRoom(roomCode, hostToken);\n    if (room.state.phase !== 'board') throw new Error('Turn selection is only available on the board');\n    const player = this.connectedPlayers(room).find((candidate) => candidate.id === playerId);\n    if (!player) throw new Error('Choose a connected player');\n    room.state.turnPlayerId = player.id;\n    this.persist();\n    return this.snapshot(roomCode);\n  }",
)

replace_once(
    "src/lib/browserGameEngine.ts",
    "    const removedBuzzWinner = current?.buzzWinnerId === playerId && !current.answerRevealed;\n    if (current?.textResponses?.[playerId]) delete current.textResponses[playerId];\n    room.state.players = room.state.players.filter((candidate) => candidate.id !== playerId);\n    delete room.playerTokens[playerId];",
    "    const removedBuzzWinner = current?.buzzWinnerId === playerId && !current.answerRevealed;\n    const removedTurnOwner = room.state.turnPlayerId === playerId;\n    const removedSeat = player.seat;\n    if (current?.textResponses?.[playerId]) delete current.textResponses[playerId];\n    room.state.players = room.state.players.filter((candidate) => candidate.id !== playerId);\n    delete room.playerTokens[playerId];\n    if (removedTurnOwner) room.state.turnPlayerId = this.nextConnectedAfterSeat(room, removedSeat)?.id ?? null;",
)

replace_once(
    "src/lib/browserGameEngine.ts",
    "      if (current.responseMode === 'text') {\n        const active = this.connectedPlayers(room);\n        if (active.length === 0 || active.every((candidate) => Boolean(current.textResponses?.[candidate.id]))) this.closeTextResponsesInternal(room);\n      } else if (removedBuzzWinner) {",
    "      if (current.responseMode === 'text') {\n        const active = this.currentQuestionParticipants(room);\n        if (active.length === 0 || active.every((candidate) => Boolean(current.textResponses?.[candidate.id]))) this.closeTextResponsesInternal(room);\n      } else if (removedBuzzWinner) {",
)

replace_once(
    "src/lib/browserGameEngine.ts",
    "        room.state.players.forEach((candidate) => {\n          candidate.buzzEligible = candidate.connected && (room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(candidate.id));\n        });",
    "        const participants = new Set(current.participantIds ?? room.state.players.map((candidate) => candidate.id));\n        room.state.players.forEach((candidate) => {\n          candidate.buzzEligible = candidate.connected && participants.has(candidate.id) && (room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(candidate.id));\n        });",
)

replace_once(
    "src/lib/browserGameEngine.ts",
    "      turnPlayerId: turnPlayer?.id ?? null,\n      timedOut: false,",
    "      turnPlayerId: turnPlayer?.id ?? null,\n      participantIds: connected.map((player) => player.id),\n      timedOut: false,",
)

replace_once(
    "src/lib/browserGameEngine.ts",
    "    current.buzzOpen = true;\n    current.buzzWinnerId = null;\n    current.buzzOpenedAt = Date.now();\n    room.state.players.forEach((player) => { player.buzzEligible = player.connected && (room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(player.id)); });",
    "    current.buzzOpen = true;\n    current.buzzWinnerId = null;\n    current.buzzOpenedAt = Date.now();\n    const participants = new Set(current.participantIds ?? room.state.players.map((player) => player.id));\n    room.state.players.forEach((player) => { player.buzzEligible = player.connected && participants.has(player.id) && (room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(player.id)); });",
)

replace_once(
    "src/lib/browserGameEngine.ts",
    "    const trimmed = answer.trim().slice(0, 200);\n    if (!trimmed) throw new Error('Enter an answer first');",
    "    if (current.participantIds && !current.participantIds.includes(player.id)) throw new Error('You joined after this question started. Wait for the next question.');\n    const trimmed = answer.trim().slice(0, 200);\n    if (!trimmed) throw new Error('Enter an answer first');",
)

replace_once(
    "src/lib/browserGameEngine.ts",
    "    const active = this.connectedPlayers(room);\n    const allSubmitted = active.length > 0 && active.every((candidate) => Boolean(current.textResponses?.[candidate.id]));",
    "    const active = this.currentQuestionParticipants(room);\n    const allSubmitted = active.length > 0 && active.every((candidate) => Boolean(current.textResponses?.[candidate.id]));",
)

# Expose authoritative manual turn selection through host transport.
replace_once(
    "src/lib/socket.ts",
    "    case 'host:rename-player': return engine.renamePlayer(roomCode, hostToken, String(payload.playerId ?? ''), String(payload.name ?? ''));\n    case 'host:suspend-player': {",
    "    case 'host:rename-player': return engine.renamePlayer(roomCode, hostToken, String(payload.playerId ?? ''), String(payload.name ?? ''));\n    case 'host:set-turn-player': return engine.setTurnPlayer(roomCode, hostToken, String(payload.playerId ?? ''));\n    case 'host:suspend-player': {",
)

# Host score animation: actual comeback amount + automatic unanswered/timeout score flight.
replace_once(
    "src/components/HostAppV3.tsx",
    "import { menuUrl, resetInstance } from '../lib/resetInstance';",
    "import { menuUrl, resetInstance } from '../lib/resetInstance';\nimport { calculateComebackAward } from '../lib/comebackScoring';",
)
replace_once(
    "src/components/HostAppV3.tsx",
    "  const revealRunningRef = useRef(false);",
    "  const revealRunningRef = useRef(false);\n  const lastPenaltySnapshotRef = useRef<RoomSnapshot | null>(null);",
)
replace_once(
    "src/components/HostAppV3.tsx",
    "  const handleScoreImpact = useCallback((flight: ScoreFlightState) => {",
    "  useEffect(() => {\n    const previous = lastPenaltySnapshotRef.current;\n    lastPenaltySnapshotRef.current = room;\n    const question = room?.currentQuestion;\n    const previousQuestion = previous?.currentQuestion;\n    if (!room || !previous || !question?.timedOut || previousQuestion?.questionId !== question.questionId || previousQuestion.timedOut) return;\n    const ownerId = question.turnPlayerId;\n    if (!ownerId) return;\n    const before = previous.players.find((player) => player.id === ownerId);\n    const after = room.players.find((player) => player.id === ownerId);\n    if (!before || !after || before.score === after.score) return;\n    setScoreOverrides((currentOverrides) => ({ ...currentOverrides, [ownerId]: before.score }));\n    setScoreFlights((currentFlights) => [...currentFlights, {\n      id: crypto.randomUUID(),\n      questionId: question.questionId,\n      playerId: ownerId,\n      delta: after.score - before.score,\n      correct: false\n    }]);\n    audio.cue('wrong');\n  }, [room]);\n\n  const handleScoreImpact = useCallback((flight: ScoreFlightState) => {",
)
replace_once(
    "src/components/HostAppV3.tsx",
    "    const signedDelta = correct ? pointsAtStake : settings.allowNegativeScores ? -pointsAtStake : -Math.min(Math.max(0, player.score), pointsAtStake);",
    "    const awardedPoints = correct && !current.dailyDouble ? calculateComebackAward(room, player, pointsAtStake).points : pointsAtStake;\n    const signedDelta = correct ? awardedPoints : settings.allowNegativeScores ? -pointsAtStake : -Math.min(Math.max(0, player.score), pointsAtStake);",
)
replace_once(
    "src/components/HostAppV3.tsx",
    "  const revealAnswer = async () => {\n    if (!current || revealRunningRef.current) return;\n    const unansweredOwnerId = current.responseMode !== 'text' && !current.dailyDouble && !current.buzzWinnerId && !current.answerRevealed\n      ? current.turnPlayerId\n      : null;\n    const penaltyFlight = unansweredOwnerId ? prepareScoreFlight(unansweredOwnerId, false) : null;\n    const ok = await perform('host:reveal-answer');\n    if (!ok) {\n      if (unansweredOwnerId) cancelPreparedScore(unansweredOwnerId);\n      return;\n    }\n    if (penaltyFlight) setScoreFlights((previous) => [...previous, penaltyFlight]);\n    audio.cue('reveal');\n  };",
    "  const revealAnswer = async () => {\n    if (!current || revealRunningRef.current) return;\n    const ok = await perform('host:reveal-answer');\n    if (!ok) return;\n    audio.cue('reveal');\n  };",
)
replace_once(
    "src/components/HostAppV3.tsx",
    "            {connectedPlayers.length > 0 && <label>Turn<select value={controllerId} onChange={(event) => setControllerId(event.target.value)}>{connectedPlayers.map((player) => <option key={player.id} value={player.id}>{player.avatar} {player.name}</option>)}</select></label>}",
    "            {connectedPlayers.length > 0 && <label>Turn<select value={controllerId} onChange={(event) => { const playerId = event.target.value; setControllerId(playerId); void perform('host:set-turn-player', { playerId }); }}>{connectedPlayers.map((player) => <option key={player.id} value={player.id}>{player.avatar} {player.name}</option>)}</select></label>}",
)

# Score-flight source falls back to the visible question card when the board tile is not mounted.
replace_once(
    "src/components/ScoreFlight.tsx",
    "      const source = findByData('questionId', flight.questionId);\n      const scoreTarget = findByData('playerScore', flight.playerId);",
    "      const source = findByData('questionId', flight.questionId)\n        ?? document.querySelector<HTMLElement>('.question-stage .question-card-v2, .presentation-question > article, .phone-question-stage-v2');\n      const scoreTarget = findByData('playerScore', flight.playerId);",
)

# Manual turn chooser was unintentionally hidden by an obsolete Daily Double rule.
replace_once(
    "src/interaction-polish.css",
    "/* The old Daily Double controller selector is intentionally gone. */\n.board-actions > label {\n  display: none;\n}",
    "/* Turn control remains visible so the host can override/repair ownership when needed. */\n.board-actions > label {\n  display: inline-flex;\n  align-items: center;\n  gap: 7px;\n  min-height: 36px;\n  padding: 5px 8px 5px 11px;\n  border: 1px solid rgba(255,209,102,.34);\n  border-radius: 10px;\n  background: rgba(255,209,102,.08);\n  color: #ffd166;\n  font-size: .68rem;\n  font-weight: 1000;\n  letter-spacing: .08em;\n  text-transform: uppercase;\n}\n.board-actions > label select {\n  min-height: 28px;\n  max-width: 180px;\n  border: 1px solid rgba(255,255,255,.16);\n  border-radius: 7px;\n  background: #071d2b;\n  color: #f4fbff;\n  font: inherit;\n  font-size: .72rem;\n  letter-spacing: 0;\n  text-transform: none;\n}",
)

# Late joiners see a spectator message instead of controls for the already-running clue.
replace_once(
    "src/components/PlayerApp.tsx",
    "  const myResponse = current?.textResponses?.[me.id];\n  const isFinalParticipant = Boolean(room.finalRound?.participantIds.includes(me.id));",
    "  const myResponse = current?.textResponses?.[me.id];\n  const isQuestionParticipant = !current?.participantIds || current.participantIds.includes(me.id);\n  const isFinalParticipant = Boolean(room.finalRound?.participantIds.includes(me.id));",
)
replace_once(
    "src/components/PlayerApp.tsx",
    "      {current.responseMode === 'text' && !current.dailyDouble ? <div className=\"text-response-panel\">",
    "      {!isQuestionParticipant && !current.answerRevealed ? <div className=\"spoken-answer-panel\"><div className=\"section-kicker\">NEXT QUESTION</div><h1>Watching this one</h1><p>You joined after this question started. You’ll be active on the next question.</p></div> : current.responseMode === 'text' && !current.dailyDouble ? <div className=\"text-response-panel\">",
)

# Expand the audit with edge cases that were previously untested.
tests = Path("tests/browserGameEngine.test.ts")
text = tests.read_text()
marker = "  it('keeps exact late-game multiplier windows', () => {"
if text.count(marker) != 1:
    raise SystemExit("Could not locate browser engine audit insertion point")
added = """  it('lets the host set an authoritative turn and manual mode keeps it after a clue', () => {\n    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, turnOrderMode: 'manual' });\n    const one = addPlayer(engine, host.roomCode, 'One');\n    const two = addPlayer(engine, host.roomCode, 'Two');\n    engine.startGame(host.roomCode, host.hostToken);\n    engine.setTurnPlayer(host.roomCode, host.hostToken, two.playerId);\n    expect(engine.snapshot(host.roomCode).turnPlayerId).toBe(two.playerId);\n\n    const tile = firstUnused(engine, host.roomCode);\n    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);\n    engine.revealAnswer(host.roomCode, host.hostToken);\n    engine.advanceToBoard(host.roomCode, host.hostToken);\n    expect(engine.snapshot(host.roomCode).turnPlayerId).toBe(two.playerId);\n    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === one.playerId)?.connected).toBe(true);\n  });\n\n  it('rotates forward when the current turn owner disconnects on the board', () => {\n    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false });\n    const one = addPlayer(engine, host.roomCode, 'One');\n    const two = addPlayer(engine, host.roomCode, 'Two');\n    const three = addPlayer(engine, host.roomCode, 'Three');\n    engine.startGame(host.roomCode, host.hostToken);\n    engine.setTurnPlayer(host.roomCode, host.hostToken, two.playerId);\n    engine.setPlayerConnected(host.roomCode, two.playerId, false);\n    expect(engine.snapshot(host.roomCode).turnPlayerId).toBe(three.playerId);\n    engine.reconnectPlayer(host.roomCode, two.playerId, two.reconnectToken);\n    expect(engine.snapshot(host.roomCode).turnPlayerId).toBe(three.playerId);\n    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === one.playerId)?.connected).toBe(true);\n  });\n\n  it('keeps late joiners out of a clue that already started, then includes them on the next clue', () => {\n    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, timerSeconds: null });\n    const one = addPlayer(engine, host.roomCode, 'One');\n    engine.startGame(host.roomCode, host.hostToken);\n    const first = firstUnused(engine, host.roomCode);\n    engine.selectQuestion(host.roomCode, host.hostToken, first.questionId);\n    const late = addPlayer(engine, host.roomCode, 'Late');\n    engine.openBuzzers(host.roomCode, host.hostToken);\n    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === late.playerId)?.buzzEligible).toBe(false);\n    expect(engine.buzz(host.roomCode, late.playerId, late.reconnectToken).accepted).toBe(false);\n    expect(engine.buzz(host.roomCode, one.playerId, one.reconnectToken).accepted).toBe(true);\n    engine.revealAnswer(host.roomCode, host.hostToken);\n    engine.resolveAnswer(host.roomCode, host.hostToken, one.playerId, true);\n    engine.advanceToBoard(host.roomCode, host.hostToken);\n\n    const second = firstUnused(engine, host.roomCode);\n    engine.selectQuestion(host.roomCode, host.hostToken, second.questionId);\n    engine.openBuzzers(host.roomCode, host.hostToken);\n    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === late.playerId)?.buzzEligible).toBe(true);\n  });\n\n  it('restores live buzzer eligibility when an original participant reconnects', () => {\n    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false, timerSeconds: null });\n    const one = addPlayer(engine, host.roomCode, 'One');\n    addPlayer(engine, host.roomCode, 'Two');\n    engine.startGame(host.roomCode, host.hostToken);\n    const tile = firstUnused(engine, host.roomCode);\n    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);\n    engine.openBuzzers(host.roomCode, host.hostToken);\n    engine.setPlayerConnected(host.roomCode, one.playerId, false);\n    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === one.playerId)?.buzzEligible).toBe(false);\n    engine.reconnectPlayer(host.roomCode, one.playerId, one.reconnectToken);\n    expect(engine.snapshot(host.roomCode).players.find((player) => player.id === one.playerId)?.buzzEligible).toBe(true);\n    expect(engine.buzz(host.roomCode, one.playerId, one.reconnectToken).accepted).toBe(true);\n  });\n\n"""
tests.write_text(text.replace(marker, added + marker, 1))
