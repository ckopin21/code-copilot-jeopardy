import type { BoardState, Player, RoomSnapshot } from '../shared/types';
import { buildDevScenario } from '../lib/devModeScenario';
import { Board } from './Board';
import { BoardPresentation } from './BoardPresentation';
import { EndgameRecap } from './EndgameRecap';
import { PlayerStrip } from './PlayerStrip';

const LONG_NAMES = [
  'Alexandria Montgomery-Wellington',
  'Christopher Bartholomew Rodriguez',
  'Maximilian Theodore Kensington',
  'Samantha Jean-Luc O’Callaghan',
  'Benjamin Alexander Fitzpatrick'
];

function stressPlayers(): Player[] {
  const room = buildDevScenario({
    playerCount: 5,
    scores: [12400, 9800, 7600, 4300, -1200],
    selectedSeat: 1,
    clueValue: 1000,
    lateMultiplier: 3,
    doubleBoostsSpent: 1,
    tripleBoostsSpent: 0
  });
  return room.players.map((player, index) => ({
    ...player,
    name: LONG_NAMES[index],
    score: [12400, 9800, 7600, 4300, -1200][index],
    positiveStreak: index === 0 ? 5 : index === 2 ? 2 : 0,
    coldStreak: index === 1 ? 4 : 0,
    onFire: index === 0,
    isCold: index === 1,
    finalWager: [2000, 1800, 1500, 900, 0][index],
    finalWagerSubmitted: true,
    stats: {
      ...player.stats,
      correct: 7 - index,
      incorrect: 1 + index,
      longestStreak: index === 0 ? 5 : 3,
      longestColdStreak: index === 1 ? 4 : 2,
      dailyDoublesFound: index % 2,
      biggestWager: [2000, 1800, 1500, 900, 0][index],
      fastestBuzzMs: 180 + index * 47,
      pointsGained: 5000 - index * 450,
      pointsLost: 600 + index * 230
    }
  }));
}

function stressBoard(players: Player[]): BoardState {
  const categories = [
    'EXTREMELY LONG MOVIES & TELEVISION',
    'WORLD HISTORY ACROSS THE CENTURIES',
    'SCIENCE, NATURE & TECHNOLOGY',
    'SPORTS, GAMES & COMPETITION',
    'DISNEY PARKS, FILMS & CHARACTERS'
  ];
  const values = [100, 200, 300, 400, 500] as const;
  const questions = categories.flatMap((category, categoryIndex) => values.map((value, row) => {
    const questionId = `stress-${categoryIndex}-${row}`;
    if (row === 0 && categoryIndex === 0) {
      return {
        questionId,
        category,
        value,
        used: true,
        dailyDouble: true,
        playedValue: 3000,
        modifiers: ['3× TRIPLE POINTS', 'DAILY DOUBLE'],
        turnPlayerId: players[0].id,
        results: [
          {
            playerId: players[0].id,
            playerName: players[0].name,
            playerAvatar: players[0].avatar,
            correct: true,
            delta: 9000,
            modifiers: ['ON FIRE', 'COMEBACK 3×']
          },
          {
            playerId: players[1].id,
            playerName: players[1].name,
            playerAvatar: players[1].avatar,
            correct: false,
            delta: -3000,
            modifiers: ['COLD STREAK']
          }
        ]
      };
    }
    if (row === 0 && categoryIndex === 1) {
      return {
        questionId,
        category,
        value,
        used: true,
        dailyDouble: false,
        playedValue: 300,
        modifiers: ['3× TRIPLE POINTS'],
        turnPlayerId: players[2].id,
        results: players.map((player, index) => ({
          playerId: player.id,
          playerName: player.name,
          playerAvatar: player.avatar,
          correct: index % 2 === 0,
          delta: index % 2 === 0 ? 900 : -300,
          modifiers: index === 2 ? ['COMEBACK 2×'] : []
        }))
      };
    }
    if (row === 0 && categoryIndex === 2) {
      return { questionId, category, value, used: true, dailyDouble: false, playedValue: 300, results: [] };
    }
    return { questionId, category, value, used: false, dailyDouble: false, turnPlayerId: null, results: [] };
  }));
  return { categories, questions };
}

function stressRoom(): RoomSnapshot {
  const base = buildDevScenario({
    playerCount: 5,
    scores: [12400, 9800, 7600, 4300, -1200],
    selectedSeat: 1,
    clueValue: 1000,
    lateMultiplier: 3,
    doubleBoostsSpent: 1,
    tripleBoostsSpent: 0
  });
  const players = stressPlayers();
  return {
    ...base,
    phase: 'board',
    players,
    board: stressBoard(players),
    currentQuestion: null,
    multiplier: 3,
    turnPlayerId: players[0].id,
    remainingQuestions: 22,
    resultPlayerIds: players.map((player) => player.id)
  };
}

export function DevLayoutAuditHarness() {
  const params = new URLSearchParams(location.search);
  if (params.get('layoutAudit') !== '1') return null;
  const testCase = params.get('case') ?? 'players';
  const room = stressRoom();
  const players = room.players;

  if (testCase === 'board-presentation') {
    return <BoardPresentation
      room={room}
      onBack={() => {}}
      onSelect={() => {}}
      onReview={() => {}}
    />;
  }

  if (testCase === 'board') {
    return <main className="host-shell showcase-host ui-audit-harness">
      <PlayerStrip players={players} activeId={players[0].id} turnId={players[0].id} turnLabel="ON TURN" />
      <section className="game-stage board-stage-v2 showcase-board-stage">
        <div className="board-header-v2"><div><div className="section-kicker">LAYOUT STRESS</div><strong>22 questions left</strong><small className="game-mode-pill">FREE RESPONSE</small></div></div>
        <div className="modifier-banner x3"><span>FINAL THREE</span><strong>TRIPLE POINTS</strong></div>
        <Board board={room.board!} multiplier={3} onSelect={() => {}} onReview={() => {}} />
      </section>
    </main>;
  }

  if (testCase === 'presentation-question') {
    return <main className="presentation-shell ui-audit-harness">
      <PlayerStrip players={players} activeId={players[0].id} turnId={players[0].id} turnLabel="ON TURN" showWagers />
      <section className="presentation-question">
        <article>
          <div className="question-meta-v2"><span>SCIENCE, NATURE & TECHNOLOGY</span><strong>3,000 POINTS</strong><em>FREE RESPONSE</em></div>
          <h1>This intentionally long question verifies that a dense five-player Presentation layout can show a full question, long player names, streak badges, turn ownership, wagers, and late-game modifiers without clipping, truncation, overlap, or content leaving the viewport.</h1>
          <div className="presentation-response-count"><strong>5/5</strong><span>RESPONSES IN</span></div>
          <div className="answer-reveal-v2 presentation-answer"><small>CORRECT ANSWER</small><strong>An intentionally long accepted answer that must wrap cleanly inside its container</strong></div>
        </article>
      </section>
    </main>;
  }

  if (testCase === 'endgame') {
    return <main className="host-shell showcase-host ui-audit-harness"><EndgameRecap players={players} onReset={() => {}} onMenu={() => {}} /></main>;
  }

  return <main className="host-shell showcase-host ui-audit-harness">
    <PlayerStrip players={players} activeId={players[0].id} turnId={players[0].id} turnLabel="ON TURN" showWagers />
    <section className="full-state"><div className="state-card"><div className="section-kicker">LAYOUT STRESS</div><h1>Dynamic player-card combinations</h1></div></section>
  </main>;
}
