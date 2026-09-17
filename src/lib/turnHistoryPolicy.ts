import { BrowserGameEngine, type RoomRecord } from './browserGameEngine';

const INSTALL_KEY = Symbol.for('blue-stage.turn-history-policy');
type PatchedPrototype = typeof BrowserGameEngine.prototype & { [INSTALL_KEY]?: boolean };

const prototype = BrowserGameEngine.prototype as PatchedPrototype;

if (!prototype[INSTALL_KEY]) {
  prototype[INSTALL_KEY] = true;
  const originalSelectQuestion = prototype.selectQuestion;

  prototype.selectQuestion = function patchedSelectQuestion(...args: Parameters<BrowserGameEngine['selectQuestion']>) {
    const snapshot = originalSelectQuestion.apply(this, args);
    const [roomCode, , questionId] = args;
    const internals = this as unknown as { rooms: Map<string, RoomRecord> };
    const record = internals.rooms.get(roomCode.toUpperCase());
    const tile = record?.state.board?.questions.find((question) => question.questionId === questionId);

    if (record && tile) {
      tile.turnPlayerId = record.state.currentQuestion?.turnPlayerId ?? record.state.turnPlayerId;
      // setHostConnected persists the authoritative room after the turn-owner annotation.
      this.setHostConnected(roomCode, true);
      return this.snapshot(roomCode);
    }

    return snapshot;
  };
}
