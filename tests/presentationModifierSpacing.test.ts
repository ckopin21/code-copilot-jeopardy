import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/presentation-micro-polish.css', import.meta.url), 'utf8');

describe('presentation modifier spacing', () => {
  it('reserves vertical space for Daily Double and other modifier badges', () => {
    expect(css).toContain('.used-tile-topline:has(.used-question-modifiers)');
    expect(css).toContain('min-height: clamp(34px, 4.2vh, 48px);');
    expect(css).toContain('overflow: visible;');
    expect(css).toContain('transform: none;');
  });
});
