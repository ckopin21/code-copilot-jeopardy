from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    found = text.count(old)
    if found != count:
        raise SystemExit(f"{path}: expected {count} matches, found {found}: {old[:120]!r}")
    file.write_text(text.replace(old, new, count))


# Keep host question-history UI aligned with the authoritative engine when Undo restores a ruling.
p = 'src/components/HostAppV3.tsx'
needle = """  const recordAttempt = useCallback((playerId: string, correct: boolean) => {
"""
insert = """  useEffect(() => {
    const onScoreUndo = (event: Event) => {
      const restored = (event as CustomEvent<RoomSnapshot>).detail;
      const question = restored?.currentQuestion;
      if (!question) return;
      saveHistory((previous) => previous.map((entry) => entry.questionId === question.questionId
        ? { ...entry, attempts: entry.attempts.slice(0, -1) }
        : entry));
      setScoreFlights([]);
      setScoreOverrides({});
    };
    window.addEventListener('blue-stage:score-undo', onScoreUndo);
    return () => window.removeEventListener('blue-stage:score-undo', onScoreUndo);
  }, [saveHistory]);

"""
text = Path(p).read_text()
if needle not in text:
    raise SystemExit('HostApp undo insertion marker not found')
Path(p).write_text(text.replace(needle, insert + needle, 1))

# Dispatch the restored snapshot after an Undo and make reduced-motion mode non-blocking.
p = 'src/components/HostEnhancements.tsx'
replace(
    p,
    """  const runControllerTest = () => {
""",
    """  const undoLastScore = async () => {
    setActionMessage('');
    try {
      const restored = await emitAck<RoomSnapshot>('host:undo-last-score', { roomCode: credentials.roomCode, hostToken: credentials.hostToken });
      window.dispatchEvent(new CustomEvent<RoomSnapshot>('blue-stage:score-undo', { detail: restored }));
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Undo failed');
    }
  };

  const runControllerTest = () => {
"""
)
replace(
    p,
    """    if (!next) return;
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
""",
    """    if (!next || accessibility.reduceMotion) return;
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
"""
)
replace(
    p,
    """  }, [room?.phase, room?.gameStartedAt, room?.gameEndedAt, room?.currentQuestion?.questionId, room?.board?.categories.join('|')]);

  useEffect(() => () => {
""",
    """  }, [room?.phase, room?.gameStartedAt, room?.gameEndedAt, room?.currentQuestion?.questionId, room?.board?.categories.join('|'), accessibility.reduceMotion]);

  useEffect(() => {
    if (!accessibility.reduceMotion) return;
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    setTransition(null);
  }, [accessibility.reduceMotion]);

  useEffect(() => () => {
"""
)
replace(
    p,
    """        <button className=\"drawer-wide-button\" onClick={() => void hostAction('host:undo-last-score')}>↶ Undo Last Score / Ruling</button>
""",
    """        <button className=\"drawer-wide-button\" onClick={() => void undoLastScore()}>↶ Undo Last Score / Ruling</button>
"""
)

print('undo/accessibility audit fixes applied')
