import type { QuestionValue, RoomSnapshot } from '../types';

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
    const baseQuestion = { questionId, category, value, used, dailyDouble: categoryIndex === 0 && rowIndex === 0, turnPlayerId, playedValue: used ? value * multiplier : undefined, modifiers: used && rowIndex === 1 ? ['2× POINTS', 'COMEBACK'] : undefined };
    if (!used) return baseQuestion;
    return {
      ...baseQuestion,
      results: players.slice(0, Math.min(2, players.length)).map((player, index) => ({
        playerId: player.id, playerName: player.name, playerAvatar: player.avatar, playerAvatarId: player.avatarId,
        playerAccent: player.accent, correct: index === 0, delta: index === 0 ? value * multiplier : -value,
        modifiers: index === 0 ? ['COMEBACK'] : undefined
      }))
    };
  }));
  return { ...base, phase: 'board', previousPhase: 'question', players, board: { categories: BOARD_CATEGORIES, questions }, currentQuestion: null, multiplier, turnPlayerId, remainingQuestions: questions.filter((question) => !question.used).length, resultPlayerIds: players.map((player) => player.id) };
}
