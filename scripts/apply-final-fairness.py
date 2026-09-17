from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:160]!r}')
    file.write_text(text.replace(old, new, 1))

# Engine enforcement and protected downside for non-positive scores.
replace_once(
    'src/lib/browserGameEngine.ts',
    "import { calculateComebackAward } from './comebackScoring';\nimport { randomId } from './ids';",
    "import { calculateComebackAward } from './comebackScoring';\nimport { finalWagerRules } from './finalWagerRules';\nimport { randomId } from './ids';",
)
replace_once(
    'src/lib/browserGameEngine.ts',
    """    const max = room.state.settings.allowWagerBeyondScore ? room.state.settings.maxWager : Math.min(room.state.settings.maxWager, Math.max(0, player.score));
    if (!Number.isInteger(wager) || wager < 0 || wager > max) throw new Error(`Wager must be between 0 and ${max}`);""",
    """    const { maxWager } = finalWagerRules(room.state, player.id);
    if (!Number.isInteger(wager) || wager < 0 || wager > maxWager) throw new Error(`Wager must be between 0 and ${maxWager}`);""",
)
replace_once(
    'src/lib/browserGameEngine.ts',
    """    const wager = player.finalWager ?? 0;
    this.addScore(player, isCorrect ? wager : -wager, room.state.settings);""",
    """    const wager = player.finalWager ?? 0;
    const { protectedLoss } = finalWagerRules(room.state, player.id);
    const scoreDelta = isCorrect ? wager : protectedLoss ? 0 : -wager;
    this.addScore(player, scoreDelta, room.state.settings);""",
)

# Socket validation mirrors engine rules for clearer client errors.
replace_once(
    'src/lib/socket.ts',
    "import { randomId } from './ids';",
    "import { randomId } from './ids';\nimport { finalWagerRules } from './finalWagerRules';",
)
replace_once(
    'src/lib/socket.ts',
    """      const player = engine.snapshot(roomCode).players.find((candidate) => candidate.id === playerId);
      if (!player) throw new Error('Player not found');
      const allIn = player.score > 0 && wager === player.score;
      if (!presetWager(wager, true) && !allIn) throw new Error('Choose a preset wager or All In');
      engine.submitFinalWager(roomCode, playerId, reconnectToken, wager);""",
    """      const snapshot = engine.snapshot(roomCode);
      const player = snapshot.players.find((candidate) => candidate.id === playerId);
      if (!player) throw new Error('Player not found');
      const rules = finalWagerRules(snapshot, playerId);
      const allIn = rules.allInAllowed && wager === player.score;
      if (!presetWager(wager, true) && !allIn) throw new Error('Choose an available preset or All In');
      if (wager > rules.maxWager) throw new Error(`Final wager is capped at ${rules.maxWager.toLocaleString()}`);
      engine.submitFinalWager(roomCode, playerId, reconnectToken, wager);""",
)

# Phone UI explains the fairness adjustment and only presents legal choices.
replace_once(
    'src/components/PlayerApp.tsx',
    "import { turnIndicatorVisible } from '../lib/gameUiRules';",
    "import { turnIndicatorVisible } from '../lib/gameUiRules';\nimport { finalWagerRules } from '../lib/finalWagerRules';",
)
replace_once(
    'src/components/PlayerApp.tsx',
    """  const showTurnIndicator = turnIndicatorVisible(room.phase);

  return <main""",
    """  const showTurnIndicator = turnIndicatorVisible(room.phase);
  const finalWagerRule = isFinalParticipant ? finalWagerRules(room, me.id) : null;
  const showAllIn = Boolean(finalWagerRule?.allInAllowed && !FINAL_WAGER_PRESETS.some((value) => value === me.score));

  return <main""",
)
old_final = """    {room.phase === 'final-wager' && (isFinalParticipant ? <section className=\"phone-state-v2 final-phone-v2\"><div className=\"section-kicker gold\">FINAL WAGER</div><h1>{room.finalRound?.category}</h1>{me.finalWagerSubmitted ? <div className=\"response-locked\"><div className=\"lock-icon\">✓</div><h3>Wager locked</h3><strong className=\"locked-wager-number\">{(me.finalWager ?? 0).toLocaleString()}</strong></div> : <><p>Choose one wager.</p><div className=\"wager-grid phone fixed-wagers\">{FINAL_WAGER_PRESETS.map((value)=><button className={selectedFinalWager===value?'selected':''} key={value} onClick={()=>setSelectedFinalWager(value)}>{value.toLocaleString()}</button>)}<button className={`all-in-wager ${selectedFinalWager===me.score && me.score>0?'selected':''}`} disabled={me.score<=0} onClick={()=>setSelectedFinalWager(me.score)}>ALL IN · {me.score.toLocaleString()}</button></div><button className=\"primary-button giant\" disabled={selectedFinalWager===null} onClick={()=>void submitFinalWager()}>Lock {selectedFinalWager === null ? 'Wager' : selectedFinalWager.toLocaleString()}</button></>}{error && <p className=\"form-error\">{error}</p>}</section> : <section className=\"phone-state-v2\"><div className=\"section-kicker gold\">FINAL WAGER</div><h1>Watching this Final</h1><p>The Final roster was already locked when you joined.</p></section>)}"""
new_final = """    {room.phase === 'final-wager' && (isFinalParticipant ? <section className=\"phone-state-v2 final-phone-v2\"><div className=\"section-kicker gold\">FINAL WAGER</div><h1>{room.finalRound?.category}</h1>{me.finalWagerSubmitted ? <div className=\"response-locked\"><div className=\"lock-icon\">✓</div><h3>Wager locked</h3><strong className=\"locked-wager-number\">{(me.finalWager ?? 0).toLocaleString()}</strong></div> : <><p>Choose one wager.</p>{finalWagerRule?.protectedLoss && <div className=\"final-wager-rule comeback\"><strong>COMEBACK PROTECTION</strong><span>Up to {finalWagerRule.maxWager.toLocaleString()}. A miss will not lower your score.</span></div>}{finalWagerRule?.runawayLeaderCap && <div className=\"final-wager-rule leader\"><strong>LEADER CAP</strong><span>Your lead is at least 2× the next score, so Final is capped at {finalWagerRule.maxWager.toLocaleString()}.</span></div>}<div className=\"wager-grid phone fixed-wagers\">{FINAL_WAGER_PRESETS.map((value)=><button className={selectedFinalWager===value?'selected':''} disabled={Boolean(finalWagerRule && value > finalWagerRule.maxWager)} key={value} onClick={()=>setSelectedFinalWager(value)}>{value.toLocaleString()}</button>)}{showAllIn && <button className={`all-in-wager ${selectedFinalWager===me.score?'selected':''}`} onClick={()=>setSelectedFinalWager(me.score)}>ALL IN · {me.score.toLocaleString()}</button>}</div><button className=\"primary-button giant\" disabled={selectedFinalWager===null || Boolean(finalWagerRule && selectedFinalWager > finalWagerRule.maxWager)} onClick={()=>void submitFinalWager()}>Lock {selectedFinalWager === null ? 'Wager' : selectedFinalWager.toLocaleString()}</button></>}{error && <p className=\"form-error\">{error}</p>}</section> : <section className=\"phone-state-v2\"><div className=\"section-kicker gold\">FINAL WAGER</div><h1>Watching this Final</h1><p>The Final roster was already locked when you joined.</p></section>)}"""
replace_once('src/components/PlayerApp.tsx', old_final, new_final)

with Path('src/styles.css').open('a') as css:
    css.write("""

.final-wager-rule {
  display: grid;
  gap: .25rem;
  width: min(100%, 34rem);
  margin: .35rem auto .8rem;
  padding: .75rem 1rem;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 14px;
  background: rgba(7,17,44,.72);
  text-align: left;
}
.final-wager-rule strong { letter-spacing: .08em; font-size: .82rem; }
.final-wager-rule span { opacity: .84; font-size: .9rem; line-height: 1.35; }
.final-wager-rule.comeback strong { color: #86efac; }
.final-wager-rule.leader strong { color: #ffd166; }
""")

# Focused rule tests plus engine integration for protected downside.
Path('tests/finalWagerRules.test.ts').write_text("""import { describe, expect, it } from 'vitest';
import type { RoomState } from '../src/shared/types';
import { DEFAULT_SETTINGS } from '../src/shared/config';
import { finalWagerRules } from '../src/lib/finalWagerRules';

function state(scores: number[]): Pick<RoomState, 'players' | 'settings' | 'finalRound'> {
  const players = scores.map((score, index) => ({
    id: `p${index + 1}`, seat: index + 1, name: `P${index + 1}`, avatar: '⭐', accent: '#fff', score,
    connected: true, positiveStreak: 0, coldStreak: 0, onFire: false, isCold: false,
    buzzEligible: false, hasBuzzedThisQuestion: false, finalWager: null, finalWagerSubmitted: false,
    finalAnswer: null, finalAnswerSubmitted: false, finalResolved: false,
    stats: { correct: 0, incorrect: 0, longestStreak: 0, longestColdStreak: 0, dailyDoublesFound: 0, biggestWager: 0, fastestBuzzMs: null, pointsGained: 0, pointsLost: 0 }
  }));
  return {
    players,
    settings: { ...DEFAULT_SETTINGS },
    finalRound: { category: 'Final', question: 'Q', acceptedAnswers: ['A'], reviewPlayerIndex: 0, participantIds: players.map((player) => player.id), responsesClosed: false }
  };
}

describe('Final wager fairness', () => {
  it('protects non-positive players while giving them up to 1000 upside', () => {
    const rules = finalWagerRules(state([-700, 2400]), 'p1');
    expect(rules).toMatchObject({ maxWager: 1000, protectedLoss: true, runawayLeaderCap: false, allInAllowed: false });
  });

  it('caps a sole leader who has at least twice the next score', () => {
    const rules = finalWagerRules(state([6000, 2500, 1400]), 'p1');
    expect(rules).toMatchObject({ maxWager: 1000, protectedLoss: false, runawayLeaderCap: true, allInAllowed: false });
  });

  it('keeps normal Final wagering when the lead is competitive', () => {
    const rules = finalWagerRules(state([3500, 2200]), 'p1');
    expect(rules.runawayLeaderCap).toBe(false);
    expect(rules.allInAllowed).toBe(true);
    expect(rules.maxWager).toBe(DEFAULT_SETTINGS.maxWager);
  });

  it('does not cap a tied leader or a solo Final', () => {
    expect(finalWagerRules(state([3000, 3000]), 'p1').runawayLeaderCap).toBe(false);
    expect(finalWagerRules(state([6000]), 'p1').runawayLeaderCap).toBe(false);
  });
});
""")

path = Path('tests/browserGameEngine.test.ts')
text = path.read_text()
insert = """

  it('protects a non-positive Final player from losing more points on a miss', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true, allowNegativeScores: true });
    const player = addPlayer(engine, host.roomCode, 'Comeback');
    addPlayer(engine, host.roomCode, 'Leader');
    engine.startGame(host.roomCode, host.hostToken);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    engine.adjustScore(host.roomCode, host.hostToken, player.playerId, -10000);
    const before = engine.snapshot(host.roomCode).players.find((candidate) => candidate.id === player.playerId)!.score;
    expect(before).toBeLessThanOrEqual(0);
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    engine.submitFinalWager(host.roomCode, player.playerId, player.reconnectToken, 1000);
    const leader = engine.snapshot(host.roomCode).players.find((candidate) => candidate.id !== player.playerId)!;
    const leaderToken = (engine as unknown as { rooms: Map<string, { playerTokens: Record<string, string> }> }).rooms.get(host.roomCode)!.playerTokens[leader.id];
    engine.submitFinalWager(host.roomCode, leader.id, leaderToken, 0);
    engine.openFinalQuestion(host.roomCode, host.hostToken);
    engine.submitFinalAnswer(host.roomCode, player.playerId, player.reconnectToken, 'wrong answer');
    engine.submitFinalAnswer(host.roomCode, leader.id, leaderToken, 'answer');
    engine.beginFinalReview(host.roomCode, host.hostToken);
    engine.resolveFinalAnswer(host.roomCode, host.hostToken, player.playerId, false);
    expect(engine.snapshot(host.roomCode).players.find((candidate) => candidate.id === player.playerId)!.score).toBe(before);
  });

  it('enforces the 1000 Final cap on a runaway leader', () => {
    const { engine, host } = setup({ gameLength: 'quick', dailyDoublesEnabled: false, finalRoundEnabled: true, allowNegativeScores: true });
    const leader = addPlayer(engine, host.roomCode, 'Leader');
    const runner = addPlayer(engine, host.roomCode, 'Runner');
    engine.startGame(host.roomCode, host.hostToken);
    finishBoardWithoutScoring(engine, host.roomCode, host.hostToken);
    engine.adjustScore(host.roomCode, host.hostToken, leader.playerId, 20000);
    engine.adjustScore(host.roomCode, host.hostToken, runner.playerId, 1000);
    engine.beginFinalWagers(host.roomCode, host.hostToken);
    expect(() => engine.submitFinalWager(host.roomCode, leader.playerId, leader.reconnectToken, 1100)).toThrow(/0 and 1000/i);
    expect(() => engine.submitFinalWager(host.roomCode, leader.playerId, leader.reconnectToken, 1000)).not.toThrow();
  });
"""
pos = text.rfind('\n});')
if pos < 0:
    raise SystemExit('browserGameEngine test closing marker not found')
path.write_text(text[:pos] + insert + text[pos:])
