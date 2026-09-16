import { describe, expect, it } from 'vitest';
import { isFreshHostUrl, stripFreshHostFlag } from '../src/lib/hostSession';

describe('host session URL lifecycle', () => {
  it('recognizes the one-shot fresh host flag', () => {
    expect(isFreshHostUrl('https://example.test/game/?mode=host&fresh=1')).toBe(true);
    expect(isFreshHostUrl('https://example.test/game/?mode=host')).toBe(false);
    expect(isFreshHostUrl('https://example.test/game/?mode=player&fresh=1')).toBe(false);
  });

  it('removes only the fresh flag and preserves the room path and other query values', () => {
    const cleaned = new URL(stripFreshHostFlag('https://example.test/code-copilot-jeopardy/?mode=host&fresh=1&debug=1'));
    expect(cleaned.pathname).toBe('/code-copilot-jeopardy/');
    expect(cleaned.searchParams.get('mode')).toBe('host');
    expect(cleaned.searchParams.get('debug')).toBe('1');
    expect(cleaned.searchParams.has('fresh')).toBe(false);
  });
});
