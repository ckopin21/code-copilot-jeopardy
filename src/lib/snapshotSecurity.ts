import type { RoomSnapshot, TextResponseState } from '../shared/types';

export type SnapshotRole = 'host' | 'player' | 'presentation';

function hiddenResponse(response: TextResponseState, keepAnswer = false): TextResponseState {
  return {
    ...response,
    answer: keepAnswer ? response.answer : '',
    autoCorrect: false,
    autoConfidence: 'low',
    resolvedCorrect: null
  };
}

export function sanitizeRoomSnapshot(snapshot: RoomSnapshot, role: SnapshotRole, playerId?: string): RoomSnapshot {
  const copy = structuredClone(snapshot);
  const finalReviewPlayerId = copy.phase === 'final-review' && copy.finalRound
    ? copy.players[copy.finalRound.reviewPlayerIndex]?.id ?? null
    : null;
  const revealAllFinal = copy.phase === 'recap';

  copy.players = copy.players.map((player) => {
    if (role === 'host') {
      const answerVisible = revealAllFinal || (copy.phase === 'final-review' && (player.finalResolved || player.id === finalReviewPlayerId));
      return answerVisible ? player : { ...player, finalAnswer: null };
    }

    const own = role === 'player' && player.id === playerId;
    const publiclyRevealed = revealAllFinal || (copy.phase === 'final-review' && (player.finalResolved || player.id === finalReviewPlayerId));
    if (own || publiclyRevealed) return player;
    return { ...player, finalWager: null, finalAnswer: null };
  });

  if (copy.currentQuestion) {
    if (!copy.currentQuestion.answerRevealed) {
      copy.currentQuestion.acceptedAnswers = undefined;
      copy.currentQuestion.explanation = undefined;
    }
    const responses = copy.currentQuestion.textResponses;
    if (responses && !copy.currentQuestion.answerRevealed) {
      copy.currentQuestion.textResponses = Object.fromEntries(Object.entries(responses).map(([id, response]) => {
        const own = role === 'player' && id === playerId;
        return [id, hiddenResponse(response, own)];
      }));
    }
  }

  if (copy.phase === 'daily-double-wager' && copy.currentQuestion) copy.currentQuestion.text = '';

  if (copy.finalRound) {
    const finalQuestionVisible = copy.phase === 'final-question' || copy.phase === 'final-review' || revealAllFinal;
    if (!finalQuestionVisible) copy.finalRound.question = '';
    const finalAnswerVisible = copy.phase === 'final-review' || revealAllFinal;
    if (!finalAnswerVisible) {
      copy.finalRound.acceptedAnswers = [];
      copy.finalRound.explanation = undefined;
    }
  }

  return copy;
}
