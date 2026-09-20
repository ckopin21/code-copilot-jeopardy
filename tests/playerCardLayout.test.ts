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
    expect(statusRules).not.toContain('position: static !important;\n  inset: auto !important;\n  transform: none !important;\n  grid-column: 3;');
  });

  it('uses single-line overflow handling instead of allowing names to resize scorecards', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    expect(css).toContain('.showcase-player-card .player-name strong');
    expect(css).toContain('text-overflow: ellipsis !important;');
    expect(css).toContain('white-space: nowrap !important;');
    expect(css).toContain('overflow-wrap: normal !important;');
  });

  it('fixes standalone and board-presentation card heights', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    expect(css).toContain('height: 116px !important;');
    expect(css).toContain('height: 96px !important;');
    expect(css).toContain('.presentation-name-card {');
    expect(css).toContain('height: 58px;');
    expect(css).toContain('height: 72px;');
  });

  it('keeps compact host badges readable without changing card height', () => {
    const css = read('../src/ui-layout-audit-fixes.css');
    expect(css).toContain('.showcase-host:not(.host-presentation-mode) .showcase-player-card .player-status-stack');
    expect(css).toContain('width: 72px;');
    expect(css).toContain('.streak-ribbon em {\n    display: none !important;');
  });
});
