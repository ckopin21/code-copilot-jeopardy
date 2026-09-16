from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    found = text.count(old)
    if found != count:
        raise SystemExit(f"{path}: expected {count} matches, found {found}: {old[:120]!r}")
    file.write_text(text.replace(old, new, count))


# Reconcile active gameplay when the host permanently removes a player.
p = 'src/lib/browserGameEngine.ts'
old = """  removePlayer(roomCode: string, hostToken: string, playerId: string): void {
    const room = this.hostRoom(roomCode, hostToken);
    this.clearUndo(room);
    room.state.players = room.state.players.filter((player) => player.id !== playerId);
    delete room.playerTokens[playerId];
    if (room.state.finalRound) {
      room.state.finalRound.participantIds = room.state.finalRound.participantIds.filter((idValue) => idValue !== playerId);
      if (room.state.phase === 'final-review') {
        const participants = new Set(room.state.finalRound.participantIds);
        const nextIndex = room.state.players.findIndex((player) => participants.has(player.id) && !player.finalResolved);
        if (nextIndex === -1) this.finishGame(room);
        else room.state.finalRound.reviewPlayerIndex = nextIndex;
      }
    }
    this.persist();
  }
"""
new = """  removePlayer(roomCode: string, hostToken: string, playerId: string): void {
    const room = this.hostRoom(roomCode, hostToken);
    const player = room.state.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new Error('Player not found');
    const current = room.state.currentQuestion;
    if (current?.dailyDoublePlayerId === playerId && (room.state.phase === 'daily-double-wager' || room.state.phase === 'daily-double-question')) {
      throw new Error('Finish or exit the active Daily Double before removing this player');
    }

    this.clearUndo(room);
    const removedBuzzWinner = current?.buzzWinnerId === playerId && !current.answerRevealed;
    if (current?.textResponses?.[playerId]) delete current.textResponses[playerId];
    room.state.players = room.state.players.filter((candidate) => candidate.id !== playerId);
    delete room.playerTokens[playerId];

    if (current && room.state.phase === 'question' && !current.answerRevealed) {
      if (current.responseMode === 'text') {
        const active = this.connectedPlayers(room);
        if (active.length === 0 || active.every((candidate) => Boolean(current.textResponses?.[candidate.id]))) this.closeTextResponsesInternal(room);
      } else if (removedBuzzWinner) {
        current.buzzWinnerId = null;
        room.state.players.forEach((candidate) => {
          candidate.buzzEligible = candidate.connected && (room.state.settings.allowRepeatBuzzAfterMiss || !current.attemptedPlayerIds.includes(candidate.id));
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
      if (room.state.phase === 'final-question' && !room.state.finalRound.responsesClosed) {
        const active = this.activeFinalParticipants(room);
        if (active.length === 0 || active.every((candidate) => candidate.finalAnswerSubmitted)) this.closeFinalResponsesInternal(room);
      }
      if (room.state.phase === 'final-review') {
        const participants = new Set(room.state.finalRound.participantIds);
        const nextIndex = room.state.players.findIndex((candidate) => participants.has(candidate.id) && !candidate.finalResolved);
        if (nextIndex === -1) this.finishGame(room);
        else room.state.finalRound.reviewPlayerIndex = nextIndex;
      }
    }
    this.persist();
  }
"""
replace(p, old, new)

# Final review progress should count Final participants, not raw player-array indices.
p = 'src/components/HostAppV3.tsx'
replace(
    p,
    'FINAL REVIEW {room.finalRound.reviewPlayerIndex + 1}/{room.players.length}',
    'FINAL REVIEW {room.finalRound.participantIds.findIndex((playerId) => playerId === reviewPlayer.id) + 1}/{room.finalRound.participantIds.length}'
)

# Do not replay dramatic transitions just because the host restored an already-running room.
p = 'src/components/HostEnhancements.tsx'
replace(
    p,
    "  const lastPhaseRef = useRef<RoomSnapshot['phase'] | null>(null);\n  const lastGameStartedRef = useRef<number | null>(null);",
    "  const lastPhaseRef = useRef<RoomSnapshot['phase'] | null>(null);\n  const lastGameStartedRef = useRef<number | null>(null);\n  const transitionHydratedRef = useRef(false);"
)
replace(
    p,
    "  useEffect(() => {\n    if (!room) return;\n    const previous = lastPhaseRef.current;",
    "  useEffect(() => {\n    if (!room) return;\n    if (!transitionHydratedRef.current) {\n      transitionHydratedRef.current = true;\n      lastPhaseRef.current = room.phase;\n      lastGameStartedRef.current = room.gameStartedAt;\n      return;\n    }\n    const previous = lastPhaseRef.current;"
)
replace(p, "      audio.cue('phase');\n    } else if (room.phase === 'daily-double-wager'", "      audio.cue('category');\n    } else if (room.phase === 'daily-double-wager'")
replace(p, "      audio.cue('phase');\n    } else if (room.phase === 'recap'", "      audio.cue('round');\n    } else if (room.phase === 'recap'")
replace(p, "      audio.cue('reveal');\n    }", "      audio.cue('winner');\n    }")

# Use the dedicated controller-diagnostic sound instead of the generic lock sound.
p = 'src/components/PlayerEnhancements.tsx'
replace(p, "audio.cue('locked')", "audio.cue('diagnostic')")

# Regression coverage for removal during live gameplay.
p = 'tests/browserGameEngine.test.ts'
text = Path(p).read_text()
marker = """  it('renames a player without changing identity or seat', () => {
"""
insert = """  it('reopens buzzers for remaining players when the current buzz winner is removed', () => {
    const { engine, host } = setup({ dailyDoublesEnabled: false, finalRoundEnabled: false });
    const one = addPlayer(engine, host.roomCode, 'One');
    const two = addPlayer(engine, host.roomCode, 'Two');
    engine.startGame(host.roomCode, host.hostToken);
    const tile = firstUnused(engine, host.roomCode);
    engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
    engine.openBuzzers(host.roomCode, host.hostToken);
    engine.localBuzz(host.roomCode, host.hostToken, one.playerId);

    engine.removePlayer(host.roomCode, host.hostToken, one.playerId);
    const state = engine.snapshot(host.roomCode);
    expect(state.currentQuestion?.buzzWinnerId).toBeNull();
    expect(state.currentQuestion?.buzzOpen).toBe(true);
    expect(state.players.find((player) => player.id === two.playerId)?.buzzEligible).toBe(true);
    expect(() => engine.localBuzz(host.roomCode, host.hostToken, two.playerId)).not.toThrow();
  });

  it('prevents deleting the active Daily Double owner mid-question', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: true, dailyDoubleCount: 16 });
    const player = addPlayer(engine, host.roomCode, 'Daily');
    engine.startGame(host.roomCode, host.hostToken);
    const daily = engine.snapshot(host.roomCode).board!.questions.find((question) => question.dailyDouble)!;
    engine.selectQuestion(host.roomCode, host.hostToken, daily.questionId, player.playerId);
    expect(() => engine.removePlayer(host.roomCode, host.hostToken, player.playerId)).toThrow(/Daily Double/i);
    expect(engine.snapshot(host.roomCode).players.some((candidate) => candidate.id === player.playerId)).toBe(true);
  });

"""
if marker not in text:
    raise SystemExit('test insertion marker not found')
Path(p).write_text(text.replace(marker, insert + marker, 1))

print('final audit fixes applied')
