import type { QuestionValue, RoomSnapshot } from '../shared/types';
import { PlayerStrip } from './PlayerStrip';
import { BoardPresentation } from './BoardPresentation';

export type DevVisualLabMode = 'lab' | 'presentation';

const BOARD_CATEGORIES = ['MOVIES & TV', 'SCIENCE', 'HISTORY', 'GAMES', 'DISNEY'];
const BOARD_VALUES: QuestionValue[] = [100, 200, 300, 400, 500];

export function buildDevPresentationRoom(base: RoomSnapshot, multiplier: 1 | 2 | 3): RoomSnapshot {
  const players = base.players.map((player, index) => ({
    ...player,
    positiveStreak: index === 0 ? Math.max(player.positiveStreak, 4) : player.positiveStreak,
    coldStreak: index === 1 ? Math.max(player.coldStreak, 3) : player.coldStreak,
    onFire: index === 0 ? true : player.onFire,
    isCold: index === 1 ? true : player.isCold
  }));

  const turnPlayerId = base.currentQuestion?.turnPlayerId ?? base.turnPlayerId ?? players[0]?.id ?? null;
  const questions = BOARD_CATEGORIES.flatMap((category, categoryIndex) => BOARD_VALUES.map((value, rowIndex) => {
    const questionId = `dev-presentation-${categoryIndex}-${rowIndex}`;
    const used = categoryIndex === 0 && rowIndex < 2;
    const baseQuestion = {
      questionId,
      category,
      value,
      used,
      dailyDouble: categoryIndex === 0 && rowIndex === 0,
      turnPlayerId,
      playedValue: used ? value * multiplier : undefined,
      modifiers: used && rowIndex === 1 ? ['2× POINTS', 'COMEBACK'] : undefined
    };
    if (!used) return baseQuestion;
    return {
      ...baseQuestion,
      results: players.slice(0, Math.min(2, players.length)).map((player, index) => ({
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar,
        playerAvatarId: player.avatarId,
        playerAccent: player.accent,
        correct: index === 0,
        delta: index === 0 ? value * multiplier : -value,
        modifiers: index === 0 ? ['COMEBACK'] : undefined
      }))
    };
  }));

  return {
    ...base,
    phase: 'board',
    previousPhase: 'question',
    players,
    board: { categories: BOARD_CATEGORIES, questions },
    currentQuestion: null,
    multiplier,
    turnPlayerId,
    remainingQuestions: questions.filter((question) => !question.used).length,
    resultPlayerIds: players.map((player) => player.id)
  };
}

export function DevPresentationLab({
  mode,
  scenarioRoom,
  presentationRoom,
  activePlayerId,
  questionId,
  questionValue,
  correctValue,
  comebackActive,
  onExitPresentationMode
}: {
  mode: DevVisualLabMode;
  scenarioRoom: RoomSnapshot;
  presentationRoom: RoomSnapshot;
  activePlayerId: string;
  questionId: string;
  questionValue: number;
  correctValue: number;
  comebackActive: boolean;
  onExitPresentationMode: () => void;
}) {
  if (mode === 'presentation') {
    return <main className="dev-board-presentation" data-dev-production-presentation="true">
      <BoardPresentation
        room={presentationRoom}
        onBack={onExitPresentationMode}
        onSelect={() => {}}
        onReview={() => {}}
      />
    </main>;
  }

  const activePlayer = scenarioRoom.players.find((player) => player.id === activePlayerId) ?? scenarioRoom.players[0] ?? null;

  return <main className="presentation-shell dev-presentation-surface" data-dev-expanded-lab="true">
    <PlayerStrip players={scenarioRoom.players} activeId={activePlayerId} turnId={activePlayerId} turnLabel="ON TURN" />
    <section className="presentation-question">
      <article>
        <div className="question-meta-v2"><span>DEV VISUAL LAB</span><strong>{questionValue.toLocaleString()} POINTS</strong></div>
        <h1>Visual & animation lab</h1>
        <div className="dev-presentation-value" data-question-id={questionId}>
          <small>QUESTION VALUE</small>
          <strong>{questionValue.toLocaleString()}</strong>
          {activePlayer && <span>{comebackActive ? `${questionValue.toLocaleString()} → ${correctValue.toLocaleString()} FOR ${activePlayer.name.toUpperCase()}` : `TESTING ${activePlayer.name.toUpperCase()}`}</span>}
        </div>
      </article>
    </section>
  </main>;
}
