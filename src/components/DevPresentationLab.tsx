import { useEffect, useMemo, useRef, useState } from 'react';
import { QUESTION_VALUES } from '../shared/types';
import type { GameMode, QuestionValue, RoomSnapshot } from '../shared/types';
import { analyzeDevScenario, type DevPlayerCount } from '../lib/devModeScenario';
import { PlayerStrip } from './PlayerStrip';
import { ScoreFlight, type ScoreFlightState } from './ScoreFlight';
import { ComebackBoostNotice } from './ComebackBoostNotice';
import { Board } from './Board';
import { BoardPresentation } from './BoardPresentation';

type RevealBeat = 0 | 1 | 2 | 3 | 4;
type TransitionPreview = { eyebrow: string; title: string; detail?: string; categories?: string[] } | null;
type PreviewSurface = 'question' | 'host-board' | 'presentation-board';

const DEFAULT_SCORES = [1200, 0, 0, 0, 0];
const BOARD_CATEGORIES = ['LONG CATEGORY NAME', 'MOVIES & TV', 'SCIENCE', 'HISTORY', 'GAMES'];
const BOARD_VALUES: QuestionValue[] = [100, 200, 300, 400, 500];
const LONG_NAMES = ['Alexandria Montgomery', 'Christopher Kensington', 'Samantha-Rose Williams', 'Maximilian Theodore', 'Charlotte-Josephine'];

function buildBoardPreviewRoom(base: RoomSnapshot, gameMode: GameMode, multiplier: 1 | 2 | 3): RoomSnapshot {
  const players = base.players.map((player, index) => ({
    ...player,
    name: LONG_NAMES[index] ?? player.name,
    positiveStreak: index === 0 ? 4 : index === 2 ? 2 : 0,
    coldStreak: index === 1 ? 3 : 0,
    onFire: index === 0,
    isCold: index === 1
  }));
  const questions = BOARD_CATEGORIES.flatMap((category, categoryIndex) => BOARD_VALUES.map((value, rowIndex) => {
    const questionId = `dev-board-${categoryIndex}-${rowIndex}`;
    const used = categoryIndex === 0 && rowIndex < 3;
    const baseQuestion = {
      questionId,
      category,
      value,
      used,
      dailyDouble: categoryIndex === 0 && rowIndex === 0,
      turnPlayerId: players[0]?.id ?? null,
      playedValue: used ? value * multiplier : undefined,
      modifiers: used && rowIndex === 1 ? ['2× POINTS', 'COMEBACK'] : undefined
    };
    if (!used) return baseQuestion;
    if (rowIndex === 0) return {
      ...baseQuestion,
      results: [
        { playerId: players[0].id, playerName: players[0].name, playerAvatar: players[0].avatar, correct: true, delta: value * multiplier, modifiers: ['DAILY DOUBLE', 'ON FIRE'] },
        { playerId: players[1].id, playerName: players[1].name, playerAvatar: players[1].avatar, correct: false, delta: -value, modifiers: ['COLD STREAK'] }
      ]
    };
    if (rowIndex === 1) return {
      ...baseQuestion,
      results: [
        { playerId: players[2].id, playerName: players[2].name, playerAvatar: players[2].avatar, correct: true, delta: value * multiplier, modifiers: ['COMEBACK'] },
        { playerId: players[3].id, playerName: players[3].name, playerAvatar: players[3].avatar, correct: false, delta: -value, modifiers: ['3× MODIFIER'] }
      ]
    };
    return {
      ...baseQuestion,
      results: players.slice(0, 4).map((player, index) => ({
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar,
        correct: index % 2 === 0,
        delta: index % 2 === 0 ? value * multiplier : -value
      }))
    };
  }));

  return {
    ...base,
    phase: 'board',
    previousPhase: 'question',
    players,
    settings: { ...base.settings, gameMode },
    board: { categories: BOARD_CATEGORIES, questions },
    currentQuestion: null,
    multiplier,
    turnPlayerId: players[0]?.id ?? null,
    remainingQuestions: questions.filter((question) => !question.used).length,
    resultPlayerIds: players.map((player) => player.id)
  };
}


function asPlayerCount(value: number): DevPlayerCount {
  return Math.min(5, Math.max(2, value)) as DevPlayerCount;
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toLocaleString()}`;
}

export function DevPresentationLab() {
  const hostMode = new URLSearchParams(location.search).get('mode') === 'host';
  const [open, setOpen] = useState(false);
  const [playerCount, setPlayerCount] = useState<DevPlayerCount>(5);
  const [scores, setScores] = useState(DEFAULT_SCORES);
  const [selectedSeat, setSelectedSeat] = useState(2);
  const [clueValue, setClueValue] = useState<QuestionValue>(400);
  const [longQuestion, setLongQuestion] = useState(false);
  const [previewSurface, setPreviewSurface] = useState<PreviewSurface>('question');
  const [previewGameMode, setPreviewGameMode] = useState<GameMode>('classic');
  const [previewMultiplier, setPreviewMultiplier] = useState<1 | 2 | 3>(2);
  const [flight, setFlight] = useState<ScoreFlightState | null>(null);
  const [modifierPreview, setModifierPreview] = useState<2 | 3 | null>(null);
  const [transition, setTransition] = useState<TransitionPreview>(null);
  const [revealBeat, setRevealBeat] = useState<RevealBeat>(0);
  const [showComebackBanner, setShowComebackBanner] = useState(false);
  const timersRef = useRef<number[]>([]);

  const analysis = useMemo(() => analyzeDevScenario({
    playerCount,
    scores,
    selectedSeat,
    clueValue,
    lateMultiplier: 1,
    doubleBoostsSpent: 0,
    tripleBoostsSpent: 0
  }), [playerCount, scores, selectedSeat, clueValue]);

  const boardRoom = useMemo(() => buildBoardPreviewRoom(analysis.room, previewGameMode, previewMultiplier), [analysis.room, previewGameMode, previewMultiplier]);

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };
  const later = (ms: number, action: () => void) => {
    const timer = window.setTimeout(action, ms);
    timersRef.current.push(timer);
  };
  const clearPreviews = () => {
    clearTimers();
    setFlight(null);
    setModifierPreview(null);
    setTransition(null);
    setRevealBeat(0);
    setShowComebackBanner(false);
  };

  useEffect(() => () => clearTimers(), []);
  useEffect(() => {
    if (!open) clearPreviews();
  }, [open]);

  const previewScore = (correct: boolean, forceComeback = false) => {
    const comebackBonus = forceComeback ? Math.max(analysis.comeback.bonus, analysis.normalValue) : correct ? analysis.comeback.bonus : 0;
    const delta = correct
      ? forceComeback && analysis.comeback.multiplier === 1 ? analysis.normalValue * 2 : analysis.correctValue
      : analysis.wrongValue;
    setFlight({
      id: `dev-presentation-flight-${Date.now()}`,
      questionId: 'dev-question',
      playerId: analysis.player.id,
      delta,
      correct,
      comebackBonus
    });
  };

  const previewModifier = (multiplier: 2 | 3) => {
    clearTimers();
    setModifierPreview(multiplier);
    later(1900, () => setModifierPreview(null));
  };

  const previewFinalReveal = () => {
    clearTimers();
    setRevealBeat(1);
    later(650, () => setRevealBeat(2));
    later(1400, () => setRevealBeat(3));
    later(2150, () => setRevealBeat(4));
    later(3300, () => setRevealBeat(0));
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

  if (!hostMode) return null;

  const comebackActive = analysis.comeback.multiplier > 1;
  const spectacleText = revealBeat === 1 ? 'LOCK IT IN' : revealBeat === 2 ? 'NO MORE CHANGES' : revealBeat === 3 ? 'THE ANSWER IS…' : 'REVEALED';
  const questionText = longQuestion
    ? 'This is an intentionally long developer question designed to verify that presentation-mode typography, player cards, value labels, timers, banners, and animation targets all fit cleanly on the screen without clipping or overlap.'
    : 'What would this question look like on the presentation screen?';

  return <>
    <button className={`dev-presentation-trigger ${open ? 'active' : ''}`} onClick={() => setOpen(true)} aria-label="Open presentation visual lab">PRES LAB</button>

    {open && <div className="dev-presentation-lab" role="dialog" aria-modal="true" aria-label="Presentation visual and animation lab">
      {previewSurface === 'question' && <main className="presentation-shell dev-presentation-surface">
        <PlayerStrip players={analysis.room.players} activeId={analysis.player.id} turnId={analysis.player.id} turnLabel="ON TURN" />
        <section className="presentation-question">
          <article>
            <div className="question-meta-v2"><span>DEV PRESENTATION PREVIEW</span><strong>{analysis.normalValue.toLocaleString()} POINTS</strong></div>
            <h1>{questionText}</h1>
            <div className="dev-presentation-value" data-question-id="dev-question">
              <small>QUESTION VALUE</small>
              <strong>{analysis.normalValue.toLocaleString()}</strong>
              {comebackActive && <span>{analysis.normalValue.toLocaleString()} → {analysis.correctValue.toLocaleString()} FOR {analysis.player.name.toUpperCase()}</span>}
            </div>
          </article>
        </section>
      </main>}

      {previewSurface === 'host-board' && <main className="dev-host-board-surface showcase-host">
        <PlayerStrip players={boardRoom.players} activeId={boardRoom.players[0]?.id ?? null} turnId={boardRoom.turnPlayerId} turnLabel="ON TURN" />
        <section className="game-stage board-stage-v2 showcase-board-stage">
          <div className="board-header-v2">
            <div><div className="section-kicker">ROUND IN PROGRESS</div><strong>{boardRoom.remainingQuestions} questions left</strong><small className="game-mode-pill">{previewGameMode === 'classic' ? 'CLASSIC' : 'FREE RESPONSE'}</small></div>
            <div className="board-actions"><button className="nav-button">Pause</button><button className="nav-button">Presentation</button></div>
          </div>
          {boardRoom.multiplier > 1 && <div className={`modifier-banner x${boardRoom.multiplier}`}><span>{boardRoom.multiplier === 2 ? 'FINAL SIX' : 'FINAL THREE'}</span><strong>{boardRoom.multiplier === 2 ? 'DOUBLE POINTS' : 'TRIPLE POINTS'}</strong></div>}
          <Board board={boardRoom.board!} multiplier={boardRoom.multiplier} onSelect={() => {}} onReview={() => {}} />
        </section>
      </main>}

      {previewSurface === 'presentation-board' && <main className="dev-board-presentation">
        <BoardPresentation room={boardRoom} onBack={() => {}} onSelect={() => {}} onReview={() => {}} />
      </main>}

      <aside className="dev-presentation-controls">
        <header><div><small>DEV · PRESENTATION VIEW</small><strong>Visual & Animation Lab</strong></div><button onClick={() => setOpen(false)} aria-label="Close presentation preview">×</button></header>
        <p>This is the real presentation layout filling the current browser viewport. Controls float above it and do not affect fit.</p>

        <div className="dev-presentation-control-row">
          <label>Players<select value={playerCount} onChange={(event) => { const count = asPlayerCount(Number(event.target.value)); setPlayerCount(count); setSelectedSeat((seat) => Math.min(seat, count)); }}><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></label>
          <label>Turn<select value={selectedSeat} onChange={(event) => setSelectedSeat(Number(event.target.value))}>{Array.from({ length: playerCount }, (_, index) => <option key={index} value={index + 1}>P{index + 1}</option>)}</select></label>
          <label>Value<select value={clueValue} onChange={(event) => setClueValue(Number(event.target.value) as QuestionValue)}>{QUESTION_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
        <div className="dev-presentation-control-row dev-board-controls">
          <label>Surface<select aria-label="Preview surface" value={previewSurface} onChange={(event) => setPreviewSurface(event.target.value as PreviewSurface)}><option value="question">Question</option><option value="host-board">Host board</option><option value="presentation-board">Presentation board</option></select></label>
          <label>Game mode<select aria-label="Preview game mode" value={previewGameMode} onChange={(event) => setPreviewGameMode(event.target.value as GameMode)}><option value="classic">Classic</option><option value="free-response">Free Response</option></select></label>
          <label>Board modifier<select aria-label="Preview board multiplier" value={previewMultiplier} onChange={(event) => setPreviewMultiplier(Number(event.target.value) as 1 | 2 | 3)}><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option></select></label>
        </div>

        <div className="dev-presentation-scores">{Array.from({ length: playerCount }, (_, index) => <label key={index}><span>P{index + 1}</span><input type="number" step="100" value={scores[index] ?? 0} onChange={(event) => setScores((current) => { const next = [...current]; next[index] = Number(event.target.value) || 0; return next; })}/></label>)}</div>
        <label className="dev-presentation-toggle"><input type="checkbox" checked={longQuestion} onChange={(event) => setLongQuestion(event.target.checked)}/><span>Stress-test long question text</span></label>

        <div className="dev-presentation-readout"><span>Normal <b>{analysis.normalValue.toLocaleString()}</b></span><span>Comeback <b>{analysis.comeback.multiplier}×</b></span><span>Correct <b>{signed(analysis.correctValue)}</b></span><span>Wrong <b>{signed(analysis.wrongValue)}</b></span></div>

        <div className="dev-presentation-actions">
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
          <button className="clear" onClick={clearPreviews}>Clear</button>
        </div>
      </aside>

      {flight && <ScoreFlight flight={flight} onImpact={() => {}} onComplete={() => setFlight(null)} />}
      {showComebackBanner && comebackActive && <ComebackBoostNotice room={analysis.room} surface="host" />}
      {modifierPreview && <div className={`modifier-reveal-overlay x${modifierPreview}`} aria-live="polite"><div className="modifier-reveal-card"><span>{modifierPreview === 2 ? 'FINAL SIX' : 'FINAL THREE'}</span><strong>{modifierPreview === 2 ? 'DOUBLE POINTS' : 'TRIPLE POINTS'}</strong><p>{modifierPreview === 2 ? 'Every question is now worth 2×.' : 'Every remaining question is now worth 3×.'}</p></div></div>}
      {revealBeat > 0 && <div className={`final-reveal-spectacle beat-${revealBeat}`} aria-live="assertive"><div className="final-reveal-card"><small>FINAL ROUND</small><strong>{spectacleText}</strong><div className="reveal-pulse-dots"><i/><i/><i/></div></div></div>}
      {transition && <div className={`game-transition-overlay ${transition.categories ? 'category-transition' : ''}`} aria-live="polite"><section><small>{transition.eyebrow}</small><h1>{transition.title}</h1>{transition.detail && <p>{transition.detail}</p>}{transition.categories && <div className="category-intro-grid">{transition.categories.map((category, index) => <span key={category} style={{ '--intro-index': index } as React.CSSProperties}>{category}</span>)}</div>}</section></div>}
    </div>}
  </>;
}
