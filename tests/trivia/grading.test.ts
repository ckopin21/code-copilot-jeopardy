import { describe, expect, it } from 'vitest';
import { autoGradeAnswer, normalizeAnswer } from '../../src/games/trivia/grading';

describe('free-response auto grading', () => {
  it('ignores case, punctuation, and leading articles for exact answers', () => {
    expect(normalizeAnswer('The Milky-Way!')).toBe('milky way');
    expect(autoGradeAnswer('The Milky-Way!', ['Milky Way'])).toMatchObject({ correct: true, confidence: 'high' });
  });

  it('accepts a small typo as a medium-confidence suggestion', () => {
    expect(autoGradeAnswer('Cinderela', ['Cinderella'])).toMatchObject({ correct: true, confidence: 'medium' });
  });

  it('does not award a materially different answer', () => {
    expect(autoGradeAnswer('Mickey Mouse', ['Donald Duck']).correct).toBe(false);
  });
});
