import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('dynamic UI layout regression', () => {
  it('loads the comprehensive layout repairs last', () => {
    const main = read('../src/main.tsx');
    expect(main.indexOf("import './ui-layout-audit-fixes.css';"))
      .toBeGreaterThan(main.indexOf("import './normal-host-layout.css';"));
  });

  it('keeps player names, statuses, result names, turn badges, and podium names untruncated', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    for (const selector of [
      '.presentation-player-main strong',
      '.presentation-player-main small',
      '.showcase-player-card .player-name',
      '.streak-ribbon b',
      '.showcase-player-card.is-turn .turn-beacon',
      '.podium-name',
      '.question-tile.used.has-result .used-result-chip b'
    ]) expect(css).toContain(selector);
    expect(css).toContain('text-overflow: clip !important;');
    expect(css).toContain('white-space: normal !important;');
  });

  it('uses dedicated flow space for stacked status and result modifiers', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    expect(css).toContain('.showcase-player-card .player-status-stack');
    expect(css).toContain('position: static !important;');
    expect(css).toContain('grid-template-rows: auto minmax(0, 1fr) !important;');
    expect(css).toContain('flex-wrap: wrap !important;');
  });

  it('does not hide five-player presentation status text', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    expect(css).toContain('.presentation-name-strip[data-player-count="5"] .presentation-player-main small');
    expect(css).toContain('display: block !important;');
  });
});
