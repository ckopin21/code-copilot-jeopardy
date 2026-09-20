import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('player card layout regression', () => {
  it('routes every Fire/Cold state through the reserved status stack', () => {
    const component = read('../src/components/PlayerStrip.tsx');
    expect(component).toContain('hasStreakStatus && <div className="player-status-stack">{streakBadge}{turnBadge}</div>');
    expect(component).toContain('<strong title={player.name}>{player.name}</strong>');
    expect(component).not.toContain('isTurn && hasStreakStatus\n              ? <div className="player-status-stack">');
  });

  it('keeps status stacks out of intrinsic card sizing', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    const statusStart = css.indexOf('.showcase-player-card .player-status-stack {');
    const statusEnd = css.indexOf('/* Used-result tiles reserve', statusStart);
    const statusRules = css.slice(statusStart, statusEnd);

    expect(statusRules).toContain('position: absolute !important;');
    expect(statusRules).toContain('transform: translateY(-50%) !important;');
    expect(statusRules).toContain('padding-right: 112px !important;');
    expect(statusRules).toContain('overflow: visible;');
    expect(statusRules).toContain('background: transparent !important;');
    expect(statusRules).toContain('box-shadow: none !important;');
    expect(statusRules).toContain('filter: none !important;');
    expect(statusRules).toContain('backdrop-filter: none !important;');
    expect(statusRules).not.toContain('position: static !important;\n  inset: auto !important;\n  transform: none !important;\n  grid-column: 3;');
  });

  it('keeps the avatar shell centered and uses rendered glyph metrics instead of a platform-specific offset', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    const avatar = read('../src/components/PlayerAvatar.tsx');
    const playerStrip = read('../src/components/PlayerStrip.tsx');
    const board = read('../src/components/Board.tsx');

    expect(css).toContain('.showcase-player-card .player-avatar-large {');
    expect(css).toContain('align-self: center !important;');
    expect(css).toContain('justify-self: center;');
    expect(css).not.toContain('transform: translateX(-2px);');
    expect(css).not.toContain('translateY(-0.04em)');

    expect(avatar).toContain('autoCenter = false');
    expect(avatar).toContain('document.createRange()');
    expect(avatar).toContain('new ResizeObserver(scheduleMeasure)');
    expect(avatar).toContain('translate3d(');
    expect(playerStrip).toContain('autoCenter />');
    expect(board).toContain('className="used-result-avatar-art" autoCenter');
  });

  it('uses single-line overflow handling instead of allowing names to resize scorecards', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    expect(css).toContain('.showcase-player-card .player-name strong');
    expect(css).toContain('text-overflow: ellipsis !important;');
    expect(css).toContain('white-space: nowrap !important;');
    expect(css).toContain('overflow-wrap: normal !important;');
  });

  it('keeps presentation player-card content vertically centered', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    expect(css).toContain('grid-template-rows: minmax(0, 1fr);');
    expect(css).toContain('align-items: center !important;');
    expect(css).toContain('align-content: center !important;');
    expect(css).toContain('.presentation-name-card:not(.practice) > .presentation-player-avatar');
    expect(css).toContain('align-self: center !important;');
  });

  it('fixes standalone and board-presentation card heights', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    expect(css).toContain('height: 116px !important;');
    expect(css).toContain('height: 96px !important;');
    expect(css).toContain('.presentation-name-card {');
    expect(css).toContain('height: 58px;');
    expect(css).toContain('height: 72px;');
  });

  it('keeps compact host streak pills readable without changing card height', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    expect(css).toContain('.showcase-host:not(.host-presentation-mode) .showcase-player-card .player-status-stack');
    expect(css).toContain('width: 72px;');
    expect(css).toContain('.streak-ribbon em {\n    display: none !important;');
    expect(css).toContain('min-width: max-content;');
    expect(css).toContain('overflow: visible !important;');
    expect(css).toContain('text-overflow: clip !important;');
  });

  it('gives used-result player names enough line box for descenders in presentation mode', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    const selector = '.question-tile.used.has-result .used-result-chip > b > span {';
    const start = css.indexOf(selector);
    const end = css.indexOf('}', start);
    const rule = css.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(rule).toContain('display: block;');
    expect(rule).toContain('white-space: nowrap;');
    expect(rule).toContain('line-height: 1.22;');
    expect(rule).toContain('padding-block: .08em .12em;');
  });

});
