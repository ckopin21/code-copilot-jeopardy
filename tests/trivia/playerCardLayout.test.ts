import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('player card layout regression', () => {
  it('routes every live player state through the shared status primitive', () => {
    const component = read('../../src/games/trivia/components/PlayerStrip.tsx');
    const primitive = read('../../src/games/trivia/components/PlayerStatusStack.tsx');
    expect(component).toContain("import { PlayerStatusStack } from './PlayerStatusStack';");
    expect(component).toContain('<PlayerStatusStack');
    expect(component).toContain('streak={streakBadge}');
    expect(component).toContain('turn={turnBadge}');
    expect(primitive).toContain('data-status-count');
    expect(primitive).toContain('!hasStatus && fallback');
    expect(component).toContain('<strong title={player.name}>{player.name}</strong>');
    expect(component).not.toContain('position: absolute');
  });

  it('keeps status stacks in the owned grid lane rather than offsetting them', () => {
    const css = read('../../src/games/trivia/styles/ui-layout-contract.css');
    const statusStart = css.indexOf('.showcase-player-card .player-status-stack {');
    const statusEnd = css.indexOf('.showcase-player-card .player-status-stack :is', statusStart);
    const statusRules = css.slice(statusStart, statusEnd);

    expect(css).toContain("grid-template-areas: 'avatar main status'");
    expect(statusRules).toContain('grid-area: status !important;');
    expect(statusRules).toContain('position: static !important;');
    expect(statusRules).toContain('flex-direction: column;');
    expect(statusRules).toContain('gap: var(--ui-status-gap);');
    expect(statusRules).toContain('overflow: visible !important;');
    expect(statusRules).toContain('background: transparent !important;');
    expect(statusRules).toContain('box-shadow: none !important;');
    expect(statusRules).toContain('filter: none !important;');
    expect(statusRules).toContain('backdrop-filter: none !important;');
    expect(statusRules).not.toContain('position: absolute');
  });

  it('keeps the avatar shell centered and uses rendered glyph metrics instead of a platform-specific offset', () => {
    const css = read('../../src/games/trivia/styles/ui-layout-audit-fixes.css');
    const avatar = read('../../src/platform/players/PlayerAvatar.tsx');
    const playerStrip = read('../../src/games/trivia/components/PlayerStrip.tsx');
    const board = read('../../src/games/trivia/components/Board.tsx');

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
    const css = read('../../src/games/trivia/styles/ui-layout-audit-fixes.css');
    expect(css).toContain('.showcase-player-card .player-name strong');
    expect(css).toContain('text-overflow: ellipsis !important;');
    expect(css).toContain('white-space: nowrap !important;');
    expect(css).toContain('overflow-wrap: normal !important;');
  });

  it('keeps presentation player-card content vertically centered', () => {
    const css = read('../../src/games/trivia/styles/ui-layout-audit-fixes.css');
    expect(css).toContain('grid-template-rows: minmax(0, 1fr);');
    expect(css).toContain('align-items: center !important;');
    expect(css).toContain('align-content: center !important;');
    expect(css).toContain('.presentation-name-card:not(.practice) > .presentation-player-avatar');
    expect(css).toContain('align-self: center !important;');
  });

  it('fixes standalone and board-presentation card heights', () => {
    const css = read('../../src/games/trivia/styles/ui-layout-audit-fixes.css');
    expect(css).toContain('height: 116px !important;');
    expect(css).toContain('height: 96px !important;');
    expect(css).toContain('.presentation-name-card {');
    expect(css).toContain('height: 58px;');
    expect(css).toContain('height: 72px;');
  });

  it('defines one responsive status lane instead of per-state padding offsets', () => {
    const css = read('../../src/games/trivia/styles/ui-layout-contract.css');
    expect(css).toContain('--ui-status-lane: clamp(4.5rem, 10vw, 8.75rem);');
    expect(css).toContain('--ui-status-lane: 4.25rem;');
    expect(css).toContain('.showcase-player-card .player-status-stack .streak-ribbon > em { display: none; }');
    expect(css).toContain('max-inline-size: 100%;');
    expect(css).toContain('text-overflow: ellipsis;');
  });

  it('gives used-result player names enough line box for descenders in presentation mode', () => {
    const css = read('../../src/games/trivia/styles/ui-layout-audit-fixes.css');
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
