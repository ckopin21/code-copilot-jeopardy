from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/lib/browserGameEngine.ts",
    """      } else if (room.state.phase === 'daily-double-question' && room.state.currentQuestion && !room.state.currentQuestion.answerRevealed) {
        this.penalizeUnansweredTurn(room);
      } else if (room.state.settings.autoCloseBuzzersAtZero && room.state.currentQuestion?.buzzOpen) {""",
    """      } else if (room.state.phase === 'daily-double-question' && room.state.currentQuestion && !room.state.currentQuestion.answerRevealed) {
        // Daily Double timer expiry ends the clock only. The host still reveals
        // the answer and judges Correct/Incorrect so timeout never auto-scores a loss.
      } else if (room.state.settings.autoCloseBuzzersAtZero && room.state.currentQuestion?.buzzOpen) {""",
)

test_path = Path("tests/browserGameEngine.test.ts")
text = test_path.read_text()
anchor = """  it('reconnects a reserved seat without changing player identity or seat', () => {"""
new_test = """  it('keeps a Daily Double host-judged after its timer expires', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: true, dailyDoubleCount: 16, finalRoundEnabled: false, timerSeconds: 5, allowNegativeScores: true, allowWagerBeyondScore: true });
    const player = addPlayer(engine, host.roomCode, 'Daily Timer');
    engine.startGame(host.roomCode, host.hostToken);
    const daily = engine.snapshot(host.roomCode).board!.questions.find((question) => question.dailyDouble)!;
    engine.selectQuestion(host.roomCode, host.hostToken, daily.questionId, player.playerId);
    engine.setDailyDoubleWager(host.roomCode, host.hostToken, 100);
    const before = engine.snapshot(host.roomCode).players.find((candidate) => candidate.id === player.playerId)!.score;
    const endsAt = engine.snapshot(host.roomCode).timer.endsAt!;

    engine.tick(endsAt + 1);

    const expired = engine.snapshot(host.roomCode);
    expect(expired.currentQuestion?.timedOut).toBe(false);
    expect(expired.currentQuestion?.answerRevealed).toBe(false);
    expect(expired.players.find((candidate) => candidate.id === player.playerId)!.score).toBe(before);

    engine.revealAnswer(host.roomCode, host.hostToken);
    expect(() => engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, true)).not.toThrow();
    expect(engine.snapshot(host.roomCode).players.find((candidate) => candidate.id === player.playerId)!.score).toBe(before + 100);
  });

"""
if anchor not in text:
    raise SystemExit("browserGameEngine test anchor not found")
test_path.write_text(text.replace(anchor, new_test + anchor, 1))

css_path = Path("src/turn-rules-polish.css")
css = css_path.read_text()
append = """

/* Keep the bold turn treatment outside score/name flow so large scores never collide with it. */
.showcase-player-card.is-turn .turn-beacon {
  position: absolute;
  top: -13px;
  right: 12px;
  z-index: 8;
  margin: 0;
  pointer-events: none;
}
.presentation-name-card.is-turn .presentation-turn-beacon {
  position: absolute;
  top: -13px;
  right: 10px;
  z-index: 8;
  width: auto;
  max-width: calc(100% - 44px);
  margin: 0;
  pointer-events: none;
}
@media (max-width: 760px) {
  .showcase-player-card.is-turn .turn-beacon {
    top: -11px;
    right: 8px;
  }
}
"""
if "Keep the bold turn treatment outside score/name flow" not in css:
    css_path.write_text(css + append)
