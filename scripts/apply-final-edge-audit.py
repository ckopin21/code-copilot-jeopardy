from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected 1 match, found {count}: {old[:160]!r}")
    file.write_text(text.replace(old, new, 1))


# Types: stable Final review identity and frozen result rosters.
p = 'src/shared/types.ts'
replace_once(p, """export interface FinalRoundState {
  category: string;
  question: string;
  acceptedAnswers: string[];
  explanation?: string;
  reviewPlayerIndex: number;
  participantIds: string[];
  responsesClosed: boolean;
}
""", """export interface FinalRoundState {
  category: string;
  question: string;
  acceptedAnswers: string[];
  explanation?: string;
  /** Index within participantIds. Kept for progress display and persisted-state compatibility. */
  reviewPlayerIndex: number;
  /** Stable identity for the player currently under Final review. */
  reviewPlayerId?: string | null;
  participantIds: string[];
  /** Players who were in the game when Final began. Late joins spectate until the next game. */
  rosterIds?: string[];
  responsesClosed: boolean;
}
""")
replace_once(p, """  finalRound: FinalRoundState | null;
  gameStartedAt: number | null;
  gameEndedAt: number | null;
""", """  finalRound: FinalRoundState | null;
  /** Frozen scoreboard roster used once a game reaches recap. */
  resultPlayerIds?: string[];
  gameStartedAt: number | null;
  gameEndedAt: number | null;
""")

# Engine: recovery safety, Final identity, late-join spectator state, and frozen results.
p = 'src/lib/browserGameEngine.ts'
replace_once(p, """function preferredDifficulty(value: number): Question['difficulty'] {
""", """function validStoredRooms(raw: string | null): boolean {
  if (!raw) return false;
  try { return Array.isArray(JSON.parse(raw)); }
  catch { return false; }
}
function preferredDifficulty(value: number): Question['difficulty'] {
""")
replace_once(p, """      if (record.state.finalRound) {
        record.state.finalRound.participantIds ??= previouslyConnected.length ? previouslyConnected : record.state.players.map((player) => player.id);
        record.state.finalRound.responsesClosed ??= record.state.phase === 'final-review' || record.state.phase === 'recap';
      }
""", """      if (record.state.finalRound) {
        const finalRound = record.state.finalRound;
        finalRound.participantIds ??= previouslyConnected.length ? previouslyConnected : record.state.players.map((player) => player.id);
        finalRound.rosterIds ??= record.state.players.map((player) => player.id);
        finalRound.responsesClosed ??= record.state.phase === 'final-review' || record.state.phase === 'recap';
        if (record.state.phase === 'final-review') {
          const unresolved = (playerId: string) => {
            const candidate = record.state.players.find((player) => player.id === playerId);
            return Boolean(candidate && !candidate.finalResolved);
          };
          if (!finalRound.reviewPlayerId || !unresolved(finalRound.reviewPlayerId)) {
            const legacyId = record.state.players[finalRound.reviewPlayerIndex]?.id;
            finalRound.reviewPlayerId = legacyId && finalRound.participantIds.includes(legacyId) && unresolved(legacyId)
              ? legacyId
              : finalRound.participantIds.find(unresolved) ?? null;
          }
          finalRound.reviewPlayerIndex = finalRound.reviewPlayerId
            ? Math.max(0, finalRound.participantIds.indexOf(finalRound.reviewPlayerId))
            : 0;
        }
      }
      if (record.state.phase === 'recap' && !record.state.resultPlayerIds?.length) {
        record.state.resultPlayerIds = record.state.finalRound?.rosterIds ?? record.state.players.map((player) => player.id);
      }
""")
replace_once(p, """      const previous = localStorage.getItem(STORAGE_KEY);
      if (previous && previous !== serialized) localStorage.setItem(STORAGE_BACKUP_KEY, previous);
      localStorage.setItem(STORAGE_KEY, serialized);
""", """      const previous = localStorage.getItem(STORAGE_KEY);
      if (previous && previous !== serialized && validStoredRooms(previous)) localStorage.setItem(STORAGE_BACKUP_KEY, previous);
      localStorage.setItem(STORAGE_KEY, serialized);
""")
replace_once(p, """  private activeFinalParticipants(room: RoomRecord): Player[] { return this.finalParticipants(room).filter((player) => player.connected); }

  snapshot(roomCode: string): RoomSnapshot {
""", """  private activeFinalParticipants(room: RoomRecord): Player[] { return this.finalParticipants(room).filter((player) => player.connected); }
  private setNextFinalReviewPlayer(room: RoomRecord): void {
    const finalRound = room.state.finalRound;
    if (!finalRound) return;
    const nextId = finalRound.participantIds.find((playerId) => {
      const player = room.state.players.find((candidate) => candidate.id === playerId);
      return Boolean(player && !player.finalResolved);
    });
    if (!nextId) {
      finalRound.reviewPlayerId = null;
      this.finishGame(room);
      return;
    }
    finalRound.reviewPlayerId = nextId;
    finalRound.reviewPlayerIndex = Math.max(0, finalRound.participantIds.indexOf(nextId));
  }

  snapshot(roomCode: string): RoomSnapshot {
""")
replace_once(p, """      selectedPackIds,
      finalRound: null,
      gameStartedAt: null,
""", """      selectedPackIds,
      finalRound: null,
      resultPlayerIds: [],
      gameStartedAt: null,
""")
replace_once(p, """  joinPlayer(roomCode: string, input: { name: string; avatar: string; accent: string }): PlayerJoinCredentials {
    const room = this.room(roomCode);
    if (room.state.locked || (room.state.phase !== 'lobby' && room.state.settings.lockRoomOnStart)) throw new Error('Room is locked');
    if (room.state.players.length >= 5) throw new Error('Room already has 5 players');
""", """  joinPlayer(roomCode: string, input: { name: string; avatar: string; accent: string }): PlayerJoinCredentials {
    const room = this.room(roomCode);
    if (room.state.players.length >= 5) throw new Error('Room already has 5 players');
""")
replace_once(p, """    const duplicateCount = room.state.players.filter((player) => player.name.toLowerCase() === input.name.toLowerCase()).length;
    const name = duplicateCount ? `${input.name} ${duplicateCount + 1}` : input.name;
    room.state.players.push({
      id: playerId, seat, name, avatar: input.avatar, accent: input.accent, score: 0, connected: true,
      positiveStreak: 0, coldStreak: 0, onFire: false, isCold: false, buzzEligible: false, hasBuzzedThisQuestion: false,
      finalWager: null, finalWagerSubmitted: false, finalAnswer: null, finalAnswerSubmitted: false, finalResolved: false,
      stats: defaultStats()
    });
""", """    const duplicateCount = room.state.players.filter((player) => player.name.toLowerCase() === input.name.toLowerCase()).length;
    const name = duplicateCount ? `${input.name} ${duplicateCount + 1}` : input.name;
    const finalRosterFrozen = Boolean(room.state.finalRound);
    room.state.players.push({
      id: playerId, seat, name, avatar: input.avatar, accent: input.accent, score: 0, connected: true,
      positiveStreak: 0, coldStreak: 0, onFire: false, isCold: false, buzzEligible: false, hasBuzzedThisQuestion: false,
      finalWager: finalRosterFrozen ? 0 : null,
      finalWagerSubmitted: finalRosterFrozen,
      finalAnswer: null,
      finalAnswerSubmitted: finalRosterFrozen,
      finalResolved: finalRosterFrozen,
      stats: defaultStats()
    });
""")
replace_once(p, """    if (room.state.finalRound) {
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
""", """    if (room.state.finalRound) {
      room.state.finalRound.participantIds = room.state.finalRound.participantIds.filter((idValue) => idValue !== playerId);
      room.state.finalRound.rosterIds = (room.state.finalRound.rosterIds ?? []).filter((idValue) => idValue !== playerId);
      if (room.state.phase === 'final-question' && !room.state.finalRound.responsesClosed) {
        const active = this.activeFinalParticipants(room);
        if (active.length === 0 || active.every((candidate) => candidate.finalAnswerSubmitted)) this.closeFinalResponsesInternal(room);
      }
      if (room.state.phase === 'final-review') this.setNextFinalReviewPlayer(room);
    }
    if (room.state.resultPlayerIds?.length) room.state.resultPlayerIds = room.state.resultPlayerIds.filter((idValue) => idValue !== playerId);
""")
replace_once(p, """    room.state.finalRound = null;
    room.state.gameStartedAt = null;
""", """    room.state.finalRound = null;
    room.state.resultPlayerIds = [];
    room.state.gameStartedAt = null;
""")
replace_once(p, """    room.state.gameStartedAt = Date.now();
    room.state.gameEndedAt = null;
    room.state.finalRound = null;
""", """    room.state.gameStartedAt = Date.now();
    room.state.gameEndedAt = null;
    room.state.finalRound = null;
    room.state.resultPlayerIds = [];
""")
replace_once(p, """      explanation: question.explanation,
      reviewPlayerIndex: 0,
      participantIds,
      responsesClosed: false
""", """      explanation: question.explanation,
      reviewPlayerIndex: 0,
      reviewPlayerId: null,
      participantIds,
      rosterIds: room.state.players.map((player) => player.id),
      responsesClosed: false
""")
replace_once(p, """    room.state.phase = 'final-review';
    const participants = new Set(finalRound.participantIds);
    const nextIndex = room.state.players.findIndex((player) => participants.has(player.id) && !player.finalResolved);
    if (nextIndex === -1) this.finishGame(room);
    else finalRound.reviewPlayerIndex = nextIndex;
""", """    room.state.phase = 'final-review';
    this.setNextFinalReviewPlayer(room);
""")
replace_once(p, """    player.finalResolved = true;
    const participants = new Set(room.state.finalRound.participantIds);
    const nextIndex = room.state.players.findIndex((candidate) => participants.has(candidate.id) && !candidate.finalResolved);
    if (nextIndex === -1) this.finishGame(room);
    else room.state.finalRound.reviewPlayerIndex = nextIndex;
""", """    player.finalResolved = true;
    this.setNextFinalReviewPlayer(room);
""")
replace_once(p, """  private finishGame(room: RoomRecord): void {
    room.state.phase = 'recap';
    room.state.gameEndedAt = Date.now();
    if (room.state.finalRound) room.state.finalRound.responsesClosed = true;
    this.stopTimerInternal(room);
  }
""", """  private finishGame(room: RoomRecord): void {
    room.state.phase = 'recap';
    room.state.gameEndedAt = Date.now();
    if (room.state.finalRound) room.state.finalRound.responsesClosed = true;
    const frozenRoster = room.state.finalRound?.rosterIds ?? room.state.players.map((player) => player.id);
    const existing = new Set(room.state.players.map((player) => player.id));
    room.state.resultPlayerIds = frozenRoster.filter((playerId) => existing.has(playerId));
    this.stopTimerInternal(room);
  }
""")

# Final snapshot privacy must follow the stable review player id.
p = 'src/lib/snapshotSecurity.ts'
replace_once(p, """  const finalReviewPlayerId = copy.phase === 'final-review' && copy.finalRound
    ? copy.players[copy.finalRound.reviewPlayerIndex]?.id ?? null
    : null;
""", """  const finalReviewPlayerId = copy.phase === 'final-review' && copy.finalRound
    ? copy.finalRound.reviewPlayerId
      ?? copy.finalRound.participantIds[copy.finalRound.reviewPlayerIndex]
      ?? copy.players[copy.finalRound.reviewPlayerIndex]?.id
      ?? null
    : null;
""")

# Host Final UI: only frozen participants block Final; stable review identity; frozen recap roster; join QR stays available.
p = 'src/components/HostAppV3.tsx'
replace_once(p, """  const reviewPlayer = room.phase === 'final-review' && room.finalRound ? room.players[room.finalRound.reviewPlayerIndex] : null;
  const settings = room.settings;
  const updateSettings = (updates: Partial<GameSettings>) => perform('host:update-settings', { updates });
  const showJoinControl = room.phase === 'lobby';
""", """  const reviewPlayerId = room.phase === 'final-review' && room.finalRound
    ? room.finalRound.reviewPlayerId ?? room.finalRound.participantIds[room.finalRound.reviewPlayerIndex]
    : null;
  const reviewPlayer = reviewPlayerId ? room.players.find((player) => player.id === reviewPlayerId) ?? null : null;
  const settings = room.settings;
  const updateSettings = (updates: Partial<GameSettings>) => perform('host:update-settings', { updates });
""")
replace_once(p, """  const pendingFinalWagers = connectedPlayers.filter((player) => !player.finalWagerSubmitted).length;
  const pointsAtStake = current ? current.dailyDouble
""", """  const finalParticipants = room.finalRound
    ? connectedPlayers.filter((player) => room.finalRound!.participantIds.includes(player.id))
    : connectedPlayers;
  const pendingFinalWagers = finalParticipants.filter((player) => !player.finalWagerSubmitted).length;
  const resultIds = room.resultPlayerIds?.length ? new Set(room.resultPlayerIds) : null;
  const recapPlayers = resultIds ? room.players.filter((player) => resultIds.has(player.id)) : room.players;
  const pointsAtStake = current ? current.dailyDouble
""")
replace_once(p, """        {showJoinControl && <button className=\"nav-button\" onClick={() => setShowJoin(true)}>Join QR</button>}
""", """        <button className=\"nav-button\" onClick={() => setShowJoin(true)}>Join QR</button>
""")
replace_once(p, """<SubmissionStatus players={connectedPlayers} field=\"finalWagerSubmitted\" />""", """<SubmissionStatus players={finalParticipants} field=\"finalWagerSubmitted\" />""")
replace_once(p, """<SubmissionStatus players={connectedPlayers} field=\"finalAnswerSubmitted\"/>""", """<SubmissionStatus players={finalParticipants} field=\"finalAnswerSubmitted\"/>""")
replace_once(p, """      {room.phase === 'recap' && <EndgameRecap players={room.players} onReset={() => void resetGame()} onMenu={goMenu} />}
""", """      {room.phase === 'recap' && <EndgameRecap players={recapPlayers} onReset={() => void resetGame()} onMenu={goMenu} />}
""")

# Presentation UI follows frozen Final and result rosters.
p = 'src/components/PresentationApp.tsx'
replace_once(p, """  const winners = useMemo(() => {
    if (!room || room.phase !== 'recap' || !room.players.length) return [];
    const max = Math.max(...room.players.map((player) => player.score));
    return room.players.filter((player) => player.score === max);
  }, [room]);
""", """  const resultPlayers = useMemo(() => {
    if (!room) return [];
    const ids = room.resultPlayerIds?.length ? new Set(room.resultPlayerIds) : null;
    return ids ? room.players.filter((player) => ids.has(player.id)) : room.players;
  }, [room]);
  const winners = useMemo(() => {
    if (!room || room.phase !== 'recap' || !resultPlayers.length) return [];
    const max = Math.max(...resultPlayers.map((player) => player.score));
    return resultPlayers.filter((player) => player.score === max);
  }, [room, resultPlayers]);
""")
replace_once(p, """  const connectedPlayers = room.players.filter((player) => player.connected);
  const reviewPlayer = room.phase === 'final-review' && room.finalRound ? room.players[room.finalRound.reviewPlayerIndex] : null;
""", """  const connectedPlayers = room.players.filter((player) => player.connected);
  const finalPlayers = room.finalRound ? connectedPlayers.filter((player) => room.finalRound!.participantIds.includes(player.id)) : connectedPlayers;
  const reviewPlayerId = room.phase === 'final-review' && room.finalRound
    ? room.finalRound.reviewPlayerId ?? room.finalRound.participantIds[room.finalRound.reviewPlayerIndex]
    : null;
  const reviewPlayer = reviewPlayerId ? room.players.find((player) => player.id === reviewPlayerId) ?? null : null;
""")
replace_once(p, """<div className=\"presentation-lock-status\">{connectedPlayers.map((player)=><span className={player.finalWagerSubmitted?'done':''} key={player.id}>{player.avatar} {player.name}</span>)}</div>""", """<div className=\"presentation-lock-status\">{finalPlayers.map((player)=><span className={player.finalWagerSubmitted?'done':''} key={player.id}>{player.avatar} {player.name}</span>)}</div>""")
replace_once(p, """<div className=\"presentation-response-count\"><strong>{connectedPlayers.filter((player)=>player.finalAnswerSubmitted).length}/{connectedPlayers.length}</strong><span>RESPONSES IN</span></div>""", """<div className=\"presentation-response-count\"><strong>{finalPlayers.filter((player)=>player.finalAnswerSubmitted).length}/{finalPlayers.length}</strong><span>RESPONSES IN</span></div>""")
replace_once(p, """<div className=\"presentation-scores-v2\">{[...room.players].sort((a,b)=>b.score-a.score).map((player)=><div key={player.id}><span>{player.avatar} {player.name}</span><strong>{player.score.toLocaleString()}</strong></div>)}</div>""", """<div className=\"presentation-scores-v2\">{[...resultPlayers].sort((a,b)=>b.score-a.score).map((player)=><div key={player.id}><span>{player.avatar} {player.name}</span><strong>{player.score.toLocaleString()}</strong></div>)}</div>""")

# Phone Final UI: late joins spectate; exact All In value is shown and zero remains valid.
p = 'src/components/PlayerApp.tsx'
replace_once(p, """  const showFinalWager = room.phase === 'final-wager' || room.phase === 'final-question' || room.phase === 'final-review';
  const questionMultiplier = current ? Math.max(1, Math.round(current.effectiveValue / Math.max(1, current.baseValue))) : 1;
""", """  const isFinalParticipant = Boolean(room.finalRound?.participantIds.includes(me.id));
  const isResultPlayer = !room.resultPlayerIds?.length || room.resultPlayerIds.includes(me.id);
  const showFinalWager = isFinalParticipant && (room.phase === 'final-wager' || room.phase === 'final-question' || room.phase === 'final-review');
  const questionMultiplier = current ? Math.max(1, Math.round(current.effectiveValue / Math.max(1, current.baseValue))) : 1;
""")
replace_once(p, """    {room.phase === 'final-category' && <section className=\"phone-state-v2\"><div className=\"section-kicker gold\">FINAL ROUND</div><h1>{room.finalRound?.category}</h1><p>Get ready to wager.</p></section>}
""", """    {room.phase === 'final-category' && (isFinalParticipant ? <section className=\"phone-state-v2\"><div className=\"section-kicker gold\">FINAL ROUND</div><h1>{room.finalRound?.category}</h1><p>Get ready to wager.</p></section> : <section className=\"phone-state-v2\"><div className=\"section-kicker gold\">FINAL ROUND</div><h1>Watching this Final</h1><p>You joined after the Final roster was locked. Your seat is ready for the next game.</p></section>)}
""")
replace_once(p, """    {room.phase === 'final-wager' && <section className=\"phone-state-v2 final-phone-v2\"><div className=\"section-kicker gold\">FINAL WAGER</div><h1>{room.finalRound?.category}</h1>{me.finalWagerSubmitted ? <div className=\"response-locked\"><div className=\"lock-icon\">✓</div><h3>Wager locked</h3><strong className=\"locked-wager-number\">{(me.finalWager ?? 0).toLocaleString()}</strong></div> : <><p>Choose one wager.</p><div className=\"wager-grid phone fixed-wagers\">{FINAL_WAGER_PRESETS.map((value)=><button className={selectedFinalWager===value?'selected':''} key={value} onClick={()=>setSelectedFinalWager(value)}>{value.toLocaleString()}</button>)}<button className={`all-in-wager ${selectedFinalWager===me.score && me.score>0?'selected':''}`} disabled={me.score<=0} onClick={()=>setSelectedFinalWager(me.score)}>ALL IN · {Math.max(0,me.score).toLocaleString()}</button></div><button className=\"primary-button giant\" disabled={selectedFinalWager===null} onClick={()=>void submitFinalWager()}>Lock {selectedFinalWager === null ? 'Wager' : selectedFinalWager.toLocaleString()}</button></>}{error && <p className=\"form-error\">{error}</p>}</section>}
""", """    {room.phase === 'final-wager' && (isFinalParticipant ? <section className=\"phone-state-v2 final-phone-v2\"><div className=\"section-kicker gold\">FINAL WAGER</div><h1>{room.finalRound?.category}</h1>{me.finalWagerSubmitted ? <div className=\"response-locked\"><div className=\"lock-icon\">✓</div><h3>Wager locked</h3><strong className=\"locked-wager-number\">{(me.finalWager ?? 0).toLocaleString()}</strong></div> : <><p>Choose one wager.</p><div className=\"wager-grid phone fixed-wagers\">{FINAL_WAGER_PRESETS.map((value)=><button className={selectedFinalWager===value?'selected':''} key={value} onClick={()=>setSelectedFinalWager(value)}>{value.toLocaleString()}</button>)}<button className={`all-in-wager ${selectedFinalWager===me.score && me.score>=0?'selected':''}`} disabled={me.score<0} onClick={()=>setSelectedFinalWager(me.score)}>ALL IN · {me.score.toLocaleString()}</button></div><button className=\"primary-button giant\" disabled={selectedFinalWager===null} onClick={()=>void submitFinalWager()}>Lock {selectedFinalWager === null ? 'Wager' : selectedFinalWager.toLocaleString()}</button></>}{error && <p className=\"form-error\">{error}</p>}</section> : <section className=\"phone-state-v2\"><div className=\"section-kicker gold\">FINAL WAGER</div><h1>Watching this Final</h1><p>The Final roster was already locked when you joined.</p></section>)}
""")
replace_once(p, """    {room.phase === 'final-question' && <section className=\"phone-state-v2 final-phone-v2\"><div className=\"section-kicker gold\">FINAL QUESTION</div>{me.finalWagerSubmitted && <div className=\"locked-wager-inline\">WAGER {me.finalWager?.toLocaleString()}</div>}<h1>{room.finalRound?.question}</h1><Timer timer={room.timer} serverNow={room.serverNow}/>{me.finalAnswerSubmitted ? <div className=\"response-locked\"><div className=\"lock-icon\">✓</div><h3>Answer locked</h3><p>{me.finalAnswer}</p></div> : <><textarea value={finalAnswer} maxLength={200} onChange={(event)=>setFinalAnswer(event.target.value)} placeholder=\"Type your answer\"/><button className=\"primary-button giant\" disabled={!finalAnswer.trim()} onClick={async()=>{try{await emitAck('player:final-answer',{...credentials,answer:finalAnswer})}catch(err){setError(err instanceof Error?err.message:'Failed')}}}>Lock Answer</button></>}</section>}
""", """    {room.phase === 'final-question' && (isFinalParticipant ? <section className=\"phone-state-v2 final-phone-v2\"><div className=\"section-kicker gold\">FINAL QUESTION</div>{me.finalWagerSubmitted && <div className=\"locked-wager-inline\">WAGER {me.finalWager?.toLocaleString()}</div>}<h1>{room.finalRound?.question}</h1><Timer timer={room.timer} serverNow={room.serverNow}/>{me.finalAnswerSubmitted ? <div className=\"response-locked\"><div className=\"lock-icon\">✓</div><h3>Answer locked</h3><p>{me.finalAnswer}</p></div> : <><textarea value={finalAnswer} maxLength={200} onChange={(event)=>setFinalAnswer(event.target.value)} placeholder=\"Type your answer\"/><button className=\"primary-button giant\" disabled={!finalAnswer.trim()} onClick={async()=>{try{await emitAck('player:final-answer',{...credentials,answer:finalAnswer})}catch(err){setError(err instanceof Error?err.message:'Failed')}}}>Lock Answer</button></>}</section> : <section className=\"phone-state-v2\"><div className=\"section-kicker gold\">FINAL QUESTION</div><h1>Watch the main screen</h1><p>You are spectating this Final and will play in the next game.</p></section>)}
""")
replace_once(p, """    {room.phase === 'final-review' && <section className=\"phone-state-v2\"><div className=\"section-kicker gold\">ANSWER REVEAL</div><div className=\"locked-wager-inline\">WAGER {(me.finalWager ?? 0).toLocaleString()}</div><h1>{room.finalRound?.acceptedAnswers?.[0]}</h1><p>Watch the main screen for scoring.</p></section>}
    {room.phase === 'recap' && <section className=\"phone-state-v2 phone-recap-v2\"><div className=\"section-kicker gold\">YOUR FINAL STATS</div><div className=\"phone-recap-hero\"><span>{me.avatar}</span><h1>{me.score.toLocaleString()}</h1><strong>{me.name}</strong></div><dl className=\"phone-stats-grid\"><dt>Correct</dt><dd>{me.stats.correct}</dd><dt>Incorrect</dt><dd>{me.stats.incorrect}</dd><dt>Accuracy</dt><dd>{accuracy}%</dd><dt>Longest streak</dt><dd>{me.stats.longestStreak}</dd><dt>Fastest buzz</dt><dd>{me.stats.fastestBuzzMs == null ? '—' : `${me.stats.fastestBuzzMs}ms`}</dd><dt>Points gained</dt><dd>{me.stats.pointsGained.toLocaleString()}</dd><dt>Points lost</dt><dd>{me.stats.pointsLost.toLocaleString()}</dd><dt>Biggest wager</dt><dd>{me.stats.biggestWager.toLocaleString()}</dd></dl><button className=\"secondary-button\" onClick={leaveToMenu}>Back to menu</button></section>}
""", """    {room.phase === 'final-review' && (isFinalParticipant ? <section className=\"phone-state-v2\"><div className=\"section-kicker gold\">ANSWER REVEAL</div><div className=\"locked-wager-inline\">WAGER {(me.finalWager ?? 0).toLocaleString()}</div><h1>{room.finalRound?.acceptedAnswers?.[0]}</h1><p>Watch the main screen for scoring.</p></section> : <section className=\"phone-state-v2\"><div className=\"section-kicker gold\">ANSWER REVEAL</div><h1>Watching the results</h1><p>Your seat is reserved for the next game.</p></section>)}
    {room.phase === 'recap' && (isResultPlayer ? <section className=\"phone-state-v2 phone-recap-v2\"><div className=\"section-kicker gold\">YOUR FINAL STATS</div><div className=\"phone-recap-hero\"><span>{me.avatar}</span><h1>{me.score.toLocaleString()}</h1><strong>{me.name}</strong></div><dl className=\"phone-stats-grid\"><dt>Correct</dt><dd>{me.stats.correct}</dd><dt>Incorrect</dt><dd>{me.stats.incorrect}</dd><dt>Accuracy</dt><dd>{accuracy}%</dd><dt>Longest streak</dt><dd>{me.stats.longestStreak}</dd><dt>Fastest buzz</dt><dd>{me.stats.fastestBuzzMs == null ? '—' : `${me.stats.fastestBuzzMs}ms`}</dd><dt>Points gained</dt><dd>{me.stats.pointsGained.toLocaleString()}</dd><dt>Points lost</dt><dd>{me.stats.pointsLost.toLocaleString()}</dd><dt>Biggest wager</dt><dd>{me.stats.biggestWager.toLocaleString()}</dd></dl><button className=\"secondary-button\" onClick={leaveToMenu}>Back to menu</button></section> : <section className=\"phone-state-v2\"><div className=\"section-kicker gold\">GAME COMPLETE</div><h1>Ready for the next game</h1><p>You joined after this game’s results were locked, so you are not included in this scoreboard.</p><button className=\"secondary-button\" onClick={leaveToMenu}>Back to menu</button></section>)}
""")

# Network wager validation: zero-score All In is valid; negative-score All In remains disabled/rejected.
p = 'src/lib/socket.ts'
replace_once(p, """      const allIn = player.score > 0 && wager === player.score;
""", """      const allIn = player.score >= 0 && wager === player.score;
""")

# Engine regression tests for backup integrity and late Final joins/review identity.
p = 'tests/browserGameEngine.test.ts'
replace_once(p, """    const recovered = new BrowserGameEngine(new FixedRandom(), 60_000).snapshot(host.roomCode);
    expect(recovered.code).toBe(expected.code);
    expect(recovered.board?.questions.length).toBe(expected.board?.questions.length);
  });
""", """    const recovered = new BrowserGameEngine(new FixedRandom(), 60_000).snapshot(host.roomCode);
    expect(recovered.code).toBe(expected.code);
    expect(recovered.board?.questions.length).toBe(expected.board?.questions.length);
    expect(() => JSON.parse(localStorage.getItem('blue-stage-p2p-engine-v2-backup') ?? '')).not.toThrow();
  });
""")
marker = """  it('locks Final answers at timeout without revealing until the host starts review', () => {
"""
insert = """  it('keeps Final review stable and late joins out of the frozen result roster', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true });
    const early = addPlayer(engine, host.roomCode, 'Early');
    const finalist = addPlayer(engine, host.roomCode, 'Finalist');
    engine.startGame(host.roomCode, host.hostToken);
    engine.removePlayer(host.roomCode, host.hostToken, early.playerId);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    engine.submitFinalWager(host.roomCode, finalist.playerId, finalist.reconnectToken, 0);
    engine.openFinalQuestion(host.roomCode, host.hostToken);
    engine.submitFinalAnswer(host.roomCode, finalist.playerId, finalist.reconnectToken, 'answer');
    engine.beginFinalReview(host.roomCode, host.hostToken);

    const beforeJoin = engine.snapshot(host.roomCode);
    expect(beforeJoin.finalRound?.reviewPlayerId).toBe(finalist.playerId);
    expect(beforeJoin.finalRound?.rosterIds).toEqual([finalist.playerId]);

    const late = addPlayer(engine, host.roomCode, 'Late');
    const afterJoin = engine.snapshot(host.roomCode);
    const lateState = afterJoin.players.find((player) => player.id === late.playerId)!;
    expect(lateState.seat).toBe(1);
    expect(lateState.finalWagerSubmitted).toBe(true);
    expect(lateState.finalAnswerSubmitted).toBe(true);
    expect(lateState.finalResolved).toBe(true);
    expect(afterJoin.finalRound?.participantIds).toEqual([finalist.playerId]);
    expect(afterJoin.finalRound?.reviewPlayerId).toBe(finalist.playerId);

    engine.resolveFinalAnswer(host.roomCode, host.hostToken, finalist.playerId, false);
    const recap = engine.snapshot(host.roomCode);
    expect(recap.phase).toBe('recap');
    expect(recap.resultPlayerIds).toEqual([finalist.playerId]);
  });

  it('freezes recap results before players join after a non-Final game ends', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: false });
    const original = addPlayer(engine, host.roomCode, 'Original');
    engine.startGame(host.roomCode, host.hostToken);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    expect(engine.snapshot(host.roomCode).phase).toBe('recap');

    const late = addPlayer(engine, host.roomCode, 'Late');
    const recap = engine.snapshot(host.roomCode);
    expect(recap.players.some((player) => player.id === late.playerId)).toBe(true);
    expect(recap.resultPlayerIds).toEqual([original.playerId]);
  });

"""
text = Path(p).read_text()
if marker not in text:
    raise SystemExit('Final test insertion marker not found')
Path(p).write_text(text.replace(marker, insert + marker, 1))

# Snapshot regression: stable review id and hidden Final question during wagering.
p = 'tests/snapshotSecurity.test.ts'
text = Path(p).read_text()
text = text.replace("""    state.finalRound!.reviewPlayerIndex = 1;
    state.players[0].finalResolved = true;
""", """    state.finalRound!.reviewPlayerIndex = 1;
    state.finalRound!.reviewPlayerId = 'two';
    state.players[0].finalResolved = true;
""", 1)
text = text.replace("""    state.finalRound!.reviewPlayerIndex = 0;

    const firstReview = sanitizeRoomSnapshot(state, 'host');
""", """    state.finalRound!.reviewPlayerIndex = 0;
    state.finalRound!.reviewPlayerId = 'one';

    const firstReview = sanitizeRoomSnapshot(state, 'host');
""", 1)
text = text.replace("""    state.finalRound!.reviewPlayerIndex = 1;
    const secondReview = sanitizeRoomSnapshot(state, 'host');
""", """    state.finalRound!.reviewPlayerIndex = 1;
    state.finalRound!.reviewPlayerId = 'two';
    const secondReview = sanitizeRoomSnapshot(state, 'host');
""", 1)
marker = """  it('hides answers, explanations, autogrades, and other typed responses before reveal', () => {
"""
insert = """  it('hides the Final question until the answer phase begins', () => {
    const state = snapshot();
    state.phase = 'final-wager';
    const wagering = sanitizeRoomSnapshot(state, 'player', 'one');
    expect(wagering.finalRound?.category).toBe('Final');
    expect(wagering.finalRound?.question).toBe('');

    state.phase = 'final-question';
    const answering = sanitizeRoomSnapshot(state, 'player', 'one');
    expect(answering.finalRound?.question).toBe('Question?');
  });

"""
if marker not in text:
    raise SystemExit('snapshot test insertion marker not found')
Path(p).write_text(text.replace(marker, insert + marker, 1))

print('final edge-case audit fixes applied')
