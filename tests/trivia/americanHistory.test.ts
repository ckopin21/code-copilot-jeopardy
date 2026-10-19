import { describe, expect, it } from 'vitest';
import { TriviaEngine } from '../../src/games/trivia/engine/TriviaEngine';
import { sanitizeRoomSnapshot } from '../../src/games/trivia/engine/snapshotSecurity';
import { builtInPacks } from '../../src/games/trivia/packs';
import { normalizeQuestionIdentity } from '../../src/games/trivia/packs/buildPack';
import { americanHistoryAPack } from '../../src/games/trivia/packs/american-history-a';
import { americanHistoryBPack } from '../../src/games/trivia/packs/american-history-b';
import { GAME_LENGTH_CONFIG } from '../../src/games/trivia/config';

const packs = [americanHistoryAPack, americanHistoryBPack];
const memory = (): Storage => {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; }, clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null, key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key); }, setItem: (key, value) => { data.set(key, value); }
  };
};

describe('matched American History versions', () => {
  it('registers separate versions with equal category, value, difficulty and response-mode coverage', () => {
    const coverage = (pack: typeof americanHistoryAPack) => pack.questions.map((q) =>
      [q.category, q.value, q.difficulty, q.responseMode, q.dailyDoubleEligible]);
    expect(coverage(packs[0])).toEqual(coverage(packs[1]));
    for (const pack of packs) {
      expect(builtInPacks).toContain(pack);
      expect(pack.questions).toHaveLength(42);
      expect(new Set(pack.questions.map((q) => q.category)).size).toBe(7);
      expect(pack.questions.reduce((total, q) => total + q.value, 0)).toBe(17_500);
    }
  });

  it('shares no prompts, semantic keys or answers and does not spell out another clue answer', () => {
    const questions = packs.flatMap((pack) => pack.questions);
    const prompts = questions.map((q) => normalizeQuestionIdentity(q.text));
    expect(new Set(prompts).size).toBe(84);
    expect(new Set(questions.map((q) => q.factKey)).size).toBe(84);
    const answersA = new Set(packs[0].questions.flatMap((q) => q.acceptedAnswers.map(normalizeQuestionIdentity)));
    const answersB = packs[1].questions.flatMap((q) => q.acceptedAnswers.map(normalizeQuestionIdentity));
    expect(answersB.filter((answer) => answersA.has(answer))).toEqual([]);
    for (const question of questions) {
      for (const other of questions.filter((q) => q.id !== question.id)) {
        for (const answer of other.acceptedAnswers) {
          const normalized = normalizeQuestionIdentity(answer);
          // Numbers/ordinals and very short aliases can occur in unrelated dates or titles.
          if (normalized.length < 4 || /^\d+(st|nd|rd|th)?$/.test(normalized)) continue;
          expect(` ${normalizeQuestionIdentity(question.text)} `, `${question.id} leaks ${other.id}: ${answer}`)
            .not.toContain(` ${normalized} `);
        }
      }
    }
  });

  for (const pack of packs) {
    for (const gameLength of ['quick', 'standard', 'marathon'] as const) {
      it(`${pack.id}: plays ${gameLength} with correct/incorrect scoring, private answers and an unused Final`, () => {
        const engine = new TriviaEngine(undefined, 60_000, memory());
        const host = engine.createRoom('https://example.test', {
          selectedPackIds: [pack.id], gameLength, randomizeCategories: false,
          dailyDoublesEnabled: false, dailyDoubleCount: 0, lateGameModifiers: false,
          streaksEnabled: false, timerSeconds: null, finalRoundEnabled: true
        });
        const players = ['United States', 'Spain', 'Norway'].map((name) => engine.joinPlayer(host.roomCode, { name, avatar: '🚀', accent: '#93c5fd' }));
        engine.startGame(host.roomCode, host.hostToken);
        const board = engine.snapshot(host.roomCode).board!;
        const config = GAME_LENGTH_CONFIG[gameLength];
        expect(board.questions).toHaveLength(config.categories * config.rows);
        expect(board.questions.every((q) => q.questionId.startsWith(pack.id))).toBe(true);
        const scores = players.map(() => 0);
        for (const [index, tile] of board.questions.entries()) {
          // Another player's turn never awards the fixed comeback boost.
          // That boost has its own rule tests; here verify the pack's base point ladder.
          const seat = (index + 1) % players.length;
          const player = players[seat];
          engine.selectQuestion(host.roomCode, host.hostToken, tile.questionId);
          expect(engine.snapshot(host.roomCode).currentQuestion?.turnPlayerId).not.toBe(player.playerId);
          engine.openBuzzers(host.roomCode, host.hostToken);
          engine.localBuzz(host.roomCode, host.hostToken, player.playerId);
          for (const role of ['player', 'presentation'] as const) {
            const privateView = sanitizeRoomSnapshot(engine.snapshot(host.roomCode), role, player.playerId);
            expect(privateView.currentQuestion?.acceptedAnswers).toBeUndefined();
            expect(privateView.currentQuestion?.explanation).toBeUndefined();
          }
          engine.revealAnswer(host.roomCode, host.hostToken);
          const correct = index % 2 === 0;
          engine.resolveAnswer(host.roomCode, host.hostToken, player.playerId, correct);
          scores[seat] += correct ? tile.value : -tile.value;
          expect(engine.snapshot(host.roomCode).players.map((p) => p.score), `clue ${index} value ${tile.value} effective ${engine.snapshot(host.roomCode).currentQuestion?.effectiveValue} correct ${correct}`).toEqual(scores);
          engine.advanceToBoard(host.roomCode, host.hostToken);
        }
        const final = engine.snapshot(host.roomCode);
        expect(final.phase).toBe('final-category');
        expect(final.finalRound?.participantIds).toHaveLength(3);
        const finalQuestion = pack.questions.find((q) => q.text === final.finalRound?.question)!;
        expect(finalQuestion).toBeDefined();
        expect(board.questions.map((q) => q.questionId)).not.toContain(finalQuestion.id);
        expect(sanitizeRoomSnapshot(final, 'player', players[0].playerId).finalRound?.question).toBe('');
        expect(sanitizeRoomSnapshot(final, 'presentation').finalRound?.acceptedAnswers).toEqual([]);
      });
    }
  }
});
