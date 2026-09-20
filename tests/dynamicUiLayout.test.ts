import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('dynamic UI layout regression', () => {
  it('loads the comprehensive layout repairs last', () => {
    const main = read('../src/main.tsx');
    expect(main.indexOf("import './ui-layout-audit-fixes.css';"))
      .toBeGreaterThan(main.indexOf("import './normal-host-layout.css';"));
  });

  it('keeps live player identities single-line while long-form result and podium text may wrap', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    for (const selector of [
      '.presentation-player-main strong',
      '.presentation-player-main small',
      '.showcase-player-card .player-name',
      '.showcase-player-card .player-name strong',
      '.podium-name',
      '.question-tile.used.has-result .used-result-chip b'
    ]) expect(css).toContain(selector);
    expect(css).toContain('text-overflow: ellipsis !important;');
    expect(css).toContain('white-space: nowrap !important;');
    expect(css).toContain('text-overflow: clip !important;');
    expect(css).toContain('white-space: normal !important;');
  });

  it('isolates stacked player status from card sizing while result modifiers keep dedicated flow rows', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    expect(css).toContain('.showcase-player-card .player-status-stack');
    expect(css).toContain('position: absolute !important;');
    expect(css).toContain('transform: translateY(-50%) !important;');
    expect(css).toContain('grid-template-rows: auto minmax(0, 1fr) !important;');
    expect(css).toContain('flex-wrap: wrap !important;');
  });

  it('does not hide five-player presentation status text', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    expect(css).toContain('.presentation-name-strip[data-player-count="5"] .presentation-player-main small');
    expect(css).toContain('display: block !important;');
  });

  it('keeps avatar sizing anchors across host, presentation, results, and player UI without title spacing', () => {
    const css = read('../src/player-customization.css');
    for (const selector of [
      '.player-avatar-large .player-avatar-art',
      '.presentation-player-avatar .player-avatar-art',
      '.roster-avatar .player-avatar-art',
      '.podium-avatar .player-avatar-art',
      '.phone-header-v2 .phone-avatar .player-avatar-art',
      '.recap-player-heading > .player-avatar-art',
      '.presentation-winner-identity > .player-avatar-art'
    ]) expect(css).toContain(selector);

    expect(css).not.toContain('.player-avatar-frame');
    expect(css).not.toContain('[data-frame=');
    expect(css).toContain('.player-avatar-content');
    expect(css).not.toContain('.player-title-badge');
  });
});
