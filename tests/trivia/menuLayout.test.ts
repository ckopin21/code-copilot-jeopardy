import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const main = readFileSync(new URL('../../src/games/trivia/styles/index.ts', import.meta.url), 'utf8');
const menuLayout = readFileSync(new URL('../../src/games/trivia/styles/menu-desktop-layout.css', import.meta.url), 'utf8');
const interactionPolish = readFileSync(new URL('../../src/games/trivia/styles/interaction-polish.css', import.meta.url), 'utf8');
const spaceEfficiency = readFileSync(new URL('../../src/games/trivia/styles/space-efficiency.css', import.meta.url), 'utf8');

describe('menu layout ownership', () => {
  it('uses one authoritative desktop menu geometry layer', () => {
    expect(main).toContain("import './menu-desktop-layout.css';");
    expect(main).not.toContain('fullscreen-menu-edge.css');
    expect(spaceEfficiency).not.toContain('.showcase-menu');
  });

  it('makes desktop/F11 layouts edge-to-edge without requiring Fullscreen API state', () => {
    expect(menuLayout).toContain('@media (min-width: 900px)');
    expect(menuLayout).toMatch(/\.showcase-menu \.menu-card-v2\s*\{[\s\S]*?width:\s*100vw\s*!important/);
    expect(menuLayout).toMatch(/\.showcase-menu \.menu-card-v2\s*\{[\s\S]*?border:\s*0\s*!important/);
    expect(menuLayout).toMatch(/\.showcase-menu\.menu-shell-v2\s*\{[\s\S]*?padding:\s*clamp\([^;]+\) 0 clamp\(/);
  });

  it('keeps Fullscreen API mode edge-to-edge too', () => {
    expect(menuLayout).toMatch(/\.showcase-menu\.menu-fullscreen \.menu-card-v2\s*\{[\s\S]*?width:\s*100vw\s*!important/);
    expect(menuLayout).toMatch(/\.showcase-menu\.menu-fullscreen \.menu-card-v2\s*\{[\s\S]*?border:\s*0\s*!important/);
  });

  it('keeps the desktop panel group compact and centers its controls', () => {
    expect(interactionPolish).not.toMatch(/\.showcase-menu \.menu-actions\s*\{[\s\S]*?width:/);

    expect(menuLayout).toMatch(/\.showcase-menu \.menu-mode-grid\s*\{[\s\S]*?width:\s*min\(1280px,/);
    expect(menuLayout).toMatch(/\.showcase-menu \.menu-mode-grid\s*\{[\s\S]*?max-width:\s*1280px/);

    expect(menuLayout).toMatch(/\.showcase-menu \.host-menu-actions\s*\{[\s\S]*?width:\s*min\(760px,\s*92%\)\s*!important/);
    expect(menuLayout).toMatch(/\.showcase-menu \.host-menu-actions\s*\{[\s\S]*?max-width:\s*760px\s*!important/);
    expect(menuLayout).toMatch(/\.showcase-menu \.host-menu-actions\s*\{[\s\S]*?justify-self:\s*center/);

    expect(menuLayout).toMatch(/\.showcase-menu \.player-menu-section\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\)/);
    expect(menuLayout).toMatch(/\.showcase-menu \.join-game-button\s*\{[\s\S]*?width:\s*min\(340px,\s*88%\)\s*!important/);
    expect(menuLayout).toMatch(/\.showcase-menu \.join-game-button\s*\{[\s\S]*?align-self:\s*center/);
    expect(menuLayout).toMatch(/\.showcase-menu \.join-game-button\s*\{[\s\S]*?min-height:\s*clamp\(78px,\s*9vh,\s*96px\)\s*!important/);
  });
});
