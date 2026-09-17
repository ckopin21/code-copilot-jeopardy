import { useEffect, useMemo, useRef, useState } from 'react';
import { QUESTION_VALUES } from '../shared/types';
import type { QuestionValue, RoomSnapshot } from '../shared/types';
import { socket } from '../lib/socket';
import { calculateComebackAward } from '../lib/comebackScoring';
import { analyzeDevScenario, type DevLateMultiplier, type DevPlayerCount } from '../lib/devModeScenario';
import { PlayerStrip } from './PlayerStrip';
import { ScoreFlight, type ScoreFlightState } from './ScoreFlight';
import { ComebackBoostNotice } from './ComebackBoostNotice';

type CardState = 'ready' | 'active' | 'fire' | 'cold';
type RevealBeat = 0 | 1 | 2 | 3 | 4;
type TransitionPreview = { eyebrow: string; title: string; detail?: string; categories?: string[] } | null;

const DEFAULT_SCORES = [1000, 0, 0, 0, 0];

function asPlayerCount(value: number): DevPlayerCount {
  return Math.min(5, Math.max(2, value)) as DevPlayerCount;
}

function asMultiplier(value: number): DevLateMultiplier {
  return value === 2 || value === 3 ? value : 1;
}

function asQuestionValue(value: number): QuestionValue {
  return QUESTION_VALUES.includes(value as QuestionValue) ? value as QuestionValue : 100;
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toLocaleString()}`;
}

export function DevModeOverlay() {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [open, setOpen] = useState(false);
  const [playerCount, setPlayerCount] = useState<DevPlayerCount>(2);
  const [scores, setScores] = useState<number[]>(DEFAULT_SCORES);
  const [selectedSeat, setSelectedSeat] = useState(2);
  const [clueValue, setClueValue] = useState<QuestionValue>(100);
  const [lateMultiplier, setLateMultiplier] = useState<DevLateMultiplier>(1);
  const [doubleBoostsSpent, setDoubleBoostsSpent] = useState<0 | 1 | 2>(0);
  const [tripleBoostsSpent, setTripleBoostsSpent] = useState<0 | 1>(0);
  const [cardState, setCardState] = useState<CardState>('ready');
  const [flight, setFlight] = useState<ScoreFlightState | null>(null);
  const [modifierPreview, setModifierPreview] = useState<2 | 3 | null>(null);
  const [transition, setTransition] = useState<TransitionPreview>(null);
  const [revealBeat, setRevealBeat] = useState<RevealBeat>(0);
  const [showComebackBanner, setShowComebackBanner] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const onState = (snapshot: RoomSnapshot) => setRoom(snapshot);
    socket.on('room:state', onState);
    return () => socket.off('room:state', onState);
  }, []);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const scenarioInput = useMemo(() => ({
    playerCount,
    scores,
    selectedSeat,
    clueValue,
    lateMultiplier,
    doubleBoostsSpent,
    tripleBoostsSpent
  }), [playerCount, scores, selectedSeat, clueValue, lateMultiplier, doubleBoostsSpent, tripleBoostsSpent]);

  const analysis = useMemo(() => analyzeDevScenario(scenarioInput), [scenarioInput]);
  const matrix = useMemo(() => QUESTION_VALUES.map((value) => analyzeDevScenario({ ...scenarioInput, clueValue: value })), [scenarioInput]);

  const displayPlayers = useMemo(() => analysis.room.players.map((player) => {
    if (player.id !== analysis.player.id) return player;
    return {
      ...player,
      onFire: cardState === 'fire',
      isCold: cardState === 'cold',
      positiveStreak: cardState === 'fire' ? 4 : 0,
      coldStreak: cardState === 'cold' ? 3 : 0
    };
  }), [analysis.room.players, analysis.player.id, cardState]);

  const liveTurnPlayer = useMemo(() => {
    if (!room) return null;
    const id = room.currentQuestion?.turnPlayerId ?? room.turnPlayerId;
    return room.players.find((player) => player.id === id) ?? null;
  }, [room]);
  const liveNormalValue = room?.currentQuestion?.effectiveValue ?? (room ? clueValue * room.multiplier : 0);
  const liveComeback = room && liveTurnPlayer && liveNormalValue > 0
    ? calculateComebackAward(room, liveTurnPlayer, liveNormalValue)
    : null;

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };
  const later = (ms: number, action: () => void) => {
    const timer = window.setTimeout(action, ms);
    timersRef.current.push(timer);
  };
  const clearVisualPreviews = () => {
    clearTimers();
    setModifierPreview(null);
    setTransition(null);
    setRevealBeat(0);
    setShowComebackBanner(false);
    setFlight(null);
  };

  const previewModifier = (multiplier: 2 | 3) => {
    clearTimers();
    setModifierPreview(multiplier);
    later(1900, () => setModifierPreview(null));
  };

  const previewTransition = (kind: 'round' | 'daily' | 'final' | 'results') => {
    clearTimers();
    const categories = ['MOVIES', 'SCIENCE', 'HISTORY', 'GAMES', 'DISNEY'];
    const next: Exclude<TransitionPreview, null> = kind === 'round'
      ? { eyebrow: 'ROUND START', title: 'Tonight’s Categories', categories }
      : kind === 'daily'
        ? { eyebrow: 'SPECIAL QUESTION', title: 'DAILY DOUBLE', detail: 'One player. One locked wager.' }
        : kind === 'final'
          ? { eyebrow: 'THE BOARD IS COMPLETE', title: 'FINAL ROUND', detail: 'Developer preview' }
          : { eyebrow: 'GAME COMPLETE', title: 'FINAL RESULTS', detail: 'The podium is ready.' };
    setTransition(next);
    later(kind === 'round' ? 4200 : 1900, () => setTransition(null));
  };

  const previewFinalReveal = () => {
    clearTimers();
    setRevealBeat(1);
    later(650, () => setRevealBeat(2));
    later(1400, () => setRevealBeat(3));
    later(2150, () => setRevealBeat(4));
    later(3300, () => setRevealBeat(0));
  };

  const previewScore = (correct: boolean, forceComeback = false) => {
    const comebackBonus = forceComeback ? Math.max(analysis.comeback.bonus, analysis.normalValue) : correct ? analysis.comeback.bonus : 0;
    const delta = correct
      ? forceComeback && analysis.comeback.multiplier === 1 ? analysis.normalValue * 2 : analysis.correctValue
      : analysis.wrongValue;
    setFlight({
      id: `dev-flight-${Date.now()}`,
      questionId: 'dev-question',
      playerId: analysis.player.id,
      delta,
      correct,
      comebackBonus
    });
  };

  const setScore = (index: number, value: number) => {
    setScores((current) => {
      const next = [...current];
      next[index] = Number.isFinite(value) ? value : 0;
      return next;
    });
  };

  const loadLiveRoom = () => {
    if (!room) return;
    const livePlayers = room.players.slice(0, 5);
    const nextCount = asPlayerCount(Math.max(2, livePlayers.length));
    const nextScores = Array.from({ length: 5 }, (_, index) => livePlayers[index]?.score ?? 0);
    const turnId = room.currentQuestion?.turnPlayerId ?? room.turnPlayerId;
    const turnSeat = livePlayers.find((player) => player.id === turnId)?.seat ?? 1;
    const current = room.currentQuestion;
    const nextValue = current ? asQuestionValue(current.baseValue) : clueValue;
    const nextMultiplier = current ? asMultiplier(Math.round(current.effectiveValue / Math.max(1, current.baseValue))) : room.multiplier;
    const turnPlayer = livePlayers.find((player) => player.id === turnId) ?? livePlayers[0];
    const award = turnPlayer ? calculateComebackAward(room, turnPlayer, current?.effectiveValue ?? nextValue * nextMultiplier) : null;

    setPlayerCount(nextCount);
    setScores(nextScores);
    setSelectedSeat(Math.min(nextCount, Math.max(1, turnSeat)));
    setClueValue(nextValue);
    setLateMultiplier(nextMultiplier);
    if (award) {
      setDoubleBoostsSpent((2 - award.doubleUsesRemaining) as 0 | 1 | 2);
      setTripleBoostsSpent((1 - award.tripleUsesRemaining) as 0 | 1);
    }
  };

  const resetScenario = () => {
    clearVisualPreviews();
    setPlayerCount(2);
    setScores(DEFAULT_SCORES);
    setSelectedSeat(2);
    setClueValue(100);
    setLateMultiplier(1);
    setDoubleBoostsSpent(0);
    setTripleBoostsSpent(0);
    setCardState('ready');
  };

  const hostMode = new URLSearchParams(location.search).get('mode') === 'host';
  if (!hostMode) return null;

  const selectedActive = cardState === 'active' ? analysis.player.id : null;
  const selectedTurn = analysis.player.id;
  const comebackActive = analysis.comeback.multiplier > 1;
  const spectacleText = revealBeat === 1 ? 'LOCK IT IN' : revealBeat === 2 ? 'NO MORE CHANGES' : revealBeat === 3 ? 'THE ANSWER IS…' : 'REVEALED';

  return <>
    <button className={`dev-mode-trigger ${open ? 'active' : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Open developer mode">DEV</button>

    {open && <aside className="dev-mode-panel" aria-label="Developer mode test bench">
      <header className="dev-mode-header">
        <div><small>DEVELOPER MODE</small><strong>Feature Test Bench</strong><span>Sandbox only. Live game state is never changed.</span></div>
        <button onClick={() => setOpen(false)} aria-label="Close developer mode">×</button>
      </header>

      <section className="dev-section dev-live-mirror">
        <div className="dev-section-title"><strong>Live room mirror</strong><span>{room ? `${room.phase.replace(/-/g, ' ')} · ${room.players.length} player${room.players.length === 1 ? '' : 's'}` : 'Waiting for room state'}</span></div>
        {room && liveTurnPlayer ? <div className="dev-live-summary">
          <span>Turn: <b>{liveTurnPlayer.name}</b></span>
          <span>Normal: <b>{liveNormalValue.toLocaleString()}</b></span>
          <span>Comeback: <b>{liveComeback?.multiplier ?? 1}×</b></span>
          <span>Correct: <b>{(liveComeback?.points ?? liveNormalValue).toLocaleString()}</b></span>
        </div> : <p>No live turn player yet. The sandbox below is still fully usable.</p>}
        <button className="dev-button" disabled={!room} onClick={loadLiveRoom}>Copy live scores into sandbox</button>
      </section>

      <section className="dev-section">
        <div className="dev-section-title"><strong>Scenario</strong><span>Build any 2–5 player score state</span></div>
        <div className="dev-segmented" aria-label="Test player count">{([2, 3, 4, 5] as const).map((count) => <button key={count} className={playerCount === count ? 'selected' : ''} onClick={() => { setPlayerCount(count); setSelectedSeat((seat) => Math.min(seat, count)); }}>{count}P</button>)}</div>
        <div className="dev-score-inputs">{Array.from({ length: playerCount }, (_, index) => <label key={index} className={selectedSeat === index + 1 ? 'selected' : ''}>
          <button type="button" onClick={() => setSelectedSeat(index + 1)}>P{index + 1}{selectedSeat === index + 1 ? ' · TURN' : ''}</button>
          <input type="number" step="100" value={scores[index] ?? 0} onChange={(event) => setScore(index, Number(event.target.value))} aria-label={`Player ${index + 1} score`} />
        </label>)}</div>
        <div className="dev-form-grid">
          <label>Question value<select value={clueValue} onChange={(event) => setClueValue(asQuestionValue(Number(event.target.value)))}>{QUESTION_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Board modifier<select value={lateMultiplier} onChange={(event) => setLateMultiplier(asMultiplier(Number(event.target.value)))}><option value="1">1× normal</option><option value="2">2× final six</option><option value="3">3× final three</option></select></label>
          <label>2× uses already spent<select value={doubleBoostsSpent} onChange={(event) => setDoubleBoostsSpent(Number(event.target.value) as 0 | 1 | 2)}><option value="0">0 of 2</option><option value="1">1 of 2</option><option value="2">2 of 2</option></select></label>
          <label>3× uses already spent<select value={tripleBoostsSpent} onChange={(event) => setTripleBoostsSpent(Number(event.target.value) as 0 | 1)}><option value="0">0 of 1</option><option value="1">1 of 1</option></select></label>
          <label>Selected card state<select value={cardState} onChange={(event) => setCardState(event.target.value as CardState)}><option value="ready">Ready</option><option value="active">Buzz winner / active</option><option value="fire">On Fire</option><option value="cold">Cold Streak</option></select></label>
        </div>
      </section>

      <section className="dev-section">
        <div className="dev-section-title"><strong>Calculation inspector</strong><span>Uses production scoring functions</span></div>
        <div className="dev-calculation-hero">
          <div><small>SELECTED</small><strong>{analysis.player.name}</strong><span>{analysis.player.score.toLocaleString()} pts</span></div>
          <div className={comebackActive ? `boost x${analysis.comeback.multiplier}` : 'boost'}><small>COMEBACK</small><strong>{analysis.comeback.multiplier}×</strong><span>{comebackActive ? 'ACTIVE' : 'inactive'}</span></div>
        </div>
        <div className="dev-metric-grid">
          <div><small>Leader</small><b>{analysis.leaderScore.toLocaleString()}</b></div>
          <div><small>Deficit</small><b>{analysis.deficit.toLocaleString()}</b></div>
          <div><small>Last place</small><b>{analysis.isLastPlace ? 'YES' : 'NO'}</b></div>
          <div><small>Normal value</small><b>{analysis.normalValue.toLocaleString()}</b></div>
          <div><small>If selected is correct</small><b>{signed(analysis.correctValue)}</b></div>
          <div><small>If selected is wrong / no answer</small><b>{signed(analysis.wrongValue)}</b></div>
          <div><small>Other player correct</small><b>{signed(analysis.otherPlayerCorrectValue)}</b></div>
          <div><small>2× / 3× uses left</small><b>{analysis.comeback.doubleUsesRemaining} / {analysis.comeback.tripleUsesRemaining}</b></div>
        </div>
        <div className="dev-formula">{clueValue.toLocaleString()} × {lateMultiplier} board value = <b>{analysis.normalValue.toLocaleString()}</b>{comebackActive && <> → {analysis.comeback.multiplier}× comeback = <strong>{analysis.correctValue.toLocaleString()}</strong></>}</div>
        <div className="dev-final-rules"><span>FINAL MAX <b>{analysis.finalRules.maxWager.toLocaleString()}</b></span><span>LOSS PROTECTED <b>{analysis.finalRules.protectedLoss ? 'YES' : 'NO'}</b></span><span>LEADER CAP <b>{analysis.finalRules.runawayLeaderCap ? 'YES' : 'NO'}</b></span><span>ALL IN <b>{analysis.finalRules.allInAllowed ? 'YES' : 'NO'}</b></span></div>
        <div className="dev-matrix" aria-label="Comeback value matrix"><div className="head"><span>Clue</span><span>Normal</span><span>Boost</span><span>Correct</span></div>{matrix.map((item) => <div key={item.room.currentQuestion!.baseValue}><span>{item.room.currentQuestion!.baseValue}</span><span>{item.normalValue}</span><span>{item.comeback.multiplier}×</span><span>{item.correctValue}</span></div>)}</div>
      </section>

      <section className="dev-section">
        <div className="dev-section-title"><strong>Visual & animation lab</strong><span>Actual production components / CSS</span></div>
        <div className="dev-stage">
          <PlayerStrip players={displayPlayers} activeId={selectedActive} turnId={selectedTurn} turnLabel="ON TURN" />
          <div className="dev-question-source" data-question-id="dev-question"><small>DEV QUESTION</small><strong>{analysis.normalValue.toLocaleString()}</strong><span>{comebackActive ? `${analysis.normalValue.toLocaleString()} → ${analysis.correctValue.toLocaleString()} for ${analysis.player.name}` : 'Normal scoring'}</span></div>
        </div>
        <div className="dev-animation-grid">
          <button onClick={() => previewScore(true)}>Score +</button>
          <button onClick={() => previewScore(false)}>Score −</button>
          <button onClick={() => previewScore(true, true)}>Comeback flight</button>
          <button onClick={() => previewModifier(2)}>2× reveal</button>
          <button onClick={() => previewModifier(3)}>3× reveal</button>
          <button onClick={previewFinalReveal}>Final reveal</button>
          <button onClick={() => previewTransition('round')}>Round start</button>
          <button onClick={() => previewTransition('daily')}>Daily Double</button>
          <button onClick={() => previewTransition('final')}>Final Round</button>
          <button onClick={() => previewTransition('results')}>Results</button>
          <button disabled={!comebackActive} onClick={() => setShowComebackBanner((value) => !value)}>Comeback banner</button>
          <button className="clear" onClick={clearVisualPreviews}>Clear previews</button>
        </div>
      </section>

      <footer className="dev-mode-footer"><button onClick={resetScenario}>Reset sandbox</button><span>Nothing in this panel changes scores, questions, turns, or room state.</span></footer>
    </aside>}

    {flight && <ScoreFlight flight={flight} onImpact={() => {}} onComplete={() => setFlight(null)} />}
    {showComebackBanner && comebackActive && <ComebackBoostNotice room={analysis.room} surface="host" />}
    {modifierPreview && <div className={`modifier-reveal-overlay x${modifierPreview}`} aria-live="polite"><div className="modifier-reveal-card"><span>{modifierPreview === 2 ? 'FINAL SIX' : 'FINAL THREE'}</span><strong>{modifierPreview === 2 ? 'DOUBLE POINTS' : 'TRIPLE POINTS'}</strong><p>{modifierPreview === 2 ? 'Every question is now worth 2×.' : 'Every remaining question is now worth 3×.'}</p></div></div>}
    {revealBeat > 0 && <div className={`final-reveal-spectacle beat-${revealBeat}`} aria-live="assertive"><div className="final-reveal-card"><small>FINAL ROUND</small><strong>{spectacleText}</strong><div className="reveal-pulse-dots"><i/><i/><i/></div></div></div>}
    {transition && <div className={`game-transition-overlay ${transition.categories ? 'category-transition' : ''}`} aria-live="polite"><section><small>{transition.eyebrow}</small><h1>{transition.title}</h1>{transition.detail && <p>{transition.detail}</p>}{transition.categories && <div className="category-intro-grid">{transition.categories.map((category, index) => <span key={category} style={{ '--intro-index': index } as React.CSSProperties}>{category}</span>)}</div>}</section></div>}
  </>;
}
