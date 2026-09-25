// Server registration for Blue Stage Trivia. Runs only in the Node room server.
import type { ServerGame } from '../../platform/rooms/types';
import type { GameSettings, RoomSnapshot } from './types';
import { TriviaEngine } from './engine/TriviaEngine';
import { sanitizeRoomSnapshot } from './engine/snapshotSecurity';
import { packSummaries } from './packs';

/** Sent to every screen in a room when a committed action changes a player's score. */
export type ScoreEvent = {
  roomCode: string;
  playerId: string;
  delta: number;
  previousScore: number;
  nextScore: number;
  questionId: string | null;
  actionId: string;
};

function gameStartedAt(payload: Record<string, unknown>): number {
  const value = Number(payload.gameStartedAt);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Missing or stale game context');
  return value;
}
function questionId(payload: Record<string, unknown>): string {
  const value = String(payload.questionId ?? '');
  if (!value) throw new Error('Missing or stale question context');
  return value;
}
const playerIdOf = (payload: Record<string, unknown>) => String(payload.playerId ?? '');

export const triviaServerGame: ServerGame<TriviaEngine, RoomSnapshot> = {
  id: 'trivia',
  // Kept as rooms.json so rooms saved before multi-game support still restore.
  storageFile: 'rooms.json',
  createEngine: (storage, { isRoomCodeTaken }) => new TriviaEngine(undefined, undefined, storage, { isRoomCodeTaken }),
  sanitize: sanitizeRoomSnapshot,
  httpRoutes: { '/api/packs': packSummaries },

  hostActions: {
    'host:update-settings': ({ engine, roomCode, hostToken, payload }) => engine.updateSettings(roomCode, hostToken, (payload.updates ?? {}) as Partial<GameSettings>),
    'host:start-game': ({ engine, roomCode, hostToken }) => engine.startGame(roomCode, hostToken),
    'host:reset-game': ({ engine, roomCode, hostToken }) => engine.resetGame(roomCode, hostToken),
    'host:select-question': ({ engine, roomCode, hostToken, payload }) => engine.selectQuestion(roomCode, hostToken, String(payload.questionId ?? ''), payload.dailyDoublePlayerId ? String(payload.dailyDoublePlayerId) : undefined),
    'host:cancel-question': ({ engine, roomCode, hostToken }) => engine.cancelQuestion(roomCode, hostToken),
    'host:daily-double-wager': ({ engine, roomCode, hostToken, payload }) => engine.setDailyDoubleWager(roomCode, hostToken, Number(payload.wager)),
    'host:open-buzzers': ({ engine, roomCode, hostToken }) => engine.openBuzzers(roomCode, hostToken),
    'host:close-buzzers': ({ engine, roomCode, hostToken }) => engine.closeBuzzers(roomCode, hostToken),
    'host:local-buzz': ({ engine, roomCode, hostToken, payload }) => engine.localBuzz(roomCode, hostToken, playerIdOf(payload)),
    'host:resolve-answer': ({ engine, roomCode, hostToken, payload }) => engine.resolveAnswer(roomCode, hostToken, playerIdOf(payload), Boolean(payload.correct)),
    'host:resolve-text': ({ engine, roomCode, hostToken, payload }) => engine.resolveTextResponse(roomCode, hostToken, playerIdOf(payload), Boolean(payload.correct)),
    'host:confirm-text-grades': ({ engine, roomCode, hostToken }) => engine.confirmTextResponses(roomCode, hostToken),
    'host:reveal-answer': ({ engine, roomCode, hostToken }) => engine.revealAnswer(roomCode, hostToken),
    'host:advance-board': ({ engine, roomCode, hostToken }) => engine.advanceToBoard(roomCode, hostToken),
    'host:adjust-score': ({ engine, roomCode, hostToken, payload }) => engine.adjustScore(roomCode, hostToken, playerIdOf(payload), Number(payload.delta)),
    'host:undo-last-score': ({ engine, roomCode, hostToken }) => engine.undoLastScoreAction(roomCode, hostToken),
    'host:rename-player': ({ engine, roomCode, hostToken, payload }) => engine.renamePlayer(roomCode, hostToken, playerIdOf(payload), String(payload.name ?? '')),
    'host:set-turn-player': ({ engine, roomCode, hostToken, payload }) => engine.setTurnPlayer(roomCode, hostToken, playerIdOf(payload)),
    'host:pause': ({ engine, roomCode, hostToken }) => engine.pause(roomCode, hostToken),
    'host:resume': ({ engine, roomCode, hostToken }) => engine.resume(roomCode, hostToken),
    'host:start-timer': ({ engine, roomCode, hostToken }) => engine.startTimer(roomCode, hostToken),
    'host:stop-timer': ({ engine, roomCode, hostToken }) => engine.stopTimer(roomCode, hostToken),
    'host:begin-final-wagers': ({ engine, roomCode, hostToken }) => engine.beginFinalWagers(roomCode, hostToken),
    'host:open-final-question': ({ engine, roomCode, hostToken }) => engine.openFinalQuestion(roomCode, hostToken),
    'host:begin-final-review': ({ engine, roomCode, hostToken, payload }) => engine.beginFinalReview(roomCode, hostToken, payload.forceClose === true),
    'host:resolve-final': ({ engine, roomCode, hostToken, payload }) => engine.resolveFinalAnswer(roomCode, hostToken, playerIdOf(payload), typeof payload.correct === 'boolean' ? payload.correct : undefined),
    'host:end-game': ({ engine, roomCode, hostToken }) => engine.endGame(roomCode, hostToken)
  },

  playerActions: {
    'player:buzz': ({ engine, roomCode, playerId, reconnectToken, payload }) => {
      const result = engine.buzz(roomCode, playerId, reconnectToken, questionId(payload), gameStartedAt(payload));
      return { accepted: result.accepted, reason: result.reason };
    },
    'player:text-response': ({ engine, roomCode, playerId, reconnectToken, payload }) =>
      engine.submitTextResponse(roomCode, playerId, reconnectToken, String(payload.answer ?? ''), questionId(payload), gameStartedAt(payload)),
    'player:daily-double-wager': ({ engine, roomCode, playerId, reconnectToken, payload }) =>
      engine.submitDailyDoubleWager(roomCode, playerId, reconnectToken, Number(payload.wager), questionId(payload), gameStartedAt(payload)),
    'player:final-wager': ({ engine, roomCode, playerId, reconnectToken, payload }) => {
      engine.submitFinalWager(roomCode, playerId, reconnectToken, Number(payload.wager), gameStartedAt(payload));
      return null;
    },
    'player:final-answer': ({ engine, roomCode, playerId, reconnectToken, payload }) => {
      engine.submitFinalAnswer(roomCode, playerId, reconnectToken, String(payload.answer ?? ''), gameStartedAt(payload));
      return null;
    }
  },

  // Score events drive the score-flight animation on Host and Presentation screens.
  onStateChange({ before, after, changeId, emitToRoom }) {
    if (!before || !after || after.phase === 'lobby') return;
    for (const player of after.players) {
      const previous = before.players.find((candidate) => candidate.id === player.id);
      if (!previous || previous.score === player.score) continue;
      const score: ScoreEvent = {
        roomCode: after.code,
        playerId: player.id,
        delta: player.score - previous.score,
        previousScore: previous.score,
        nextScore: player.score,
        questionId: after.currentQuestion?.questionId ?? before.currentQuestion?.questionId ?? null,
        actionId: `${changeId}:${player.id}`
      };
      emitToRoom('room:score', score);
    }
  }
};
