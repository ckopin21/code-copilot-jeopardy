import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const menuLayout = readFileSync(new URL('../src/menu-desktop-layout.css', import.meta.url), 'utf8');
const interactionPolish = readFileSync(new URL('../src/interaction-polish.css', import.meta.url), 'utf8');
const spaceEfficiency = readFileSync(new URL('../src/space-efficiency.css', import.meta.url), 'utf8');

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

  it('centers and constrains the desktop host and join controls', () => {
    expect(interactionPolish).not.toMatch(/\.showcase-menu \.menu-actions\s*\{[\s\S]*?width:/);

    expect(menuLayout).toMatch(/\.showcase-menu \.host-menu-actions\s*\{[\s\S]*?width:\s*min\(680px,\s*88%\)\s*!important/);
    expect(menuLayout).toMatch(/\.showcase-menu \.host-menu-actions\s*\{[\s\S]*?max-width:\s*680px\s*!important/);
    expect(menuLayout).toMatch(/\.showcase-menu \.host-menu-actions\s*\{[\s\S]*?justify-self:\s*center/);

    expect(menuLayout).toMatch(/\.showcase-menu \.join-game-button\s*\{[\s\S]*?width:\s*min\(340px,\s*88%\)\s*!important/);
    expect(menuLayout).toMatch(/\.showcase-menu \.join-game-button\s*\{[\s\S]*?height:\s*auto\s*!important/);
    expect(menuLayout).toMatch(/\.showcase-menu \.join-game-button\s*\{[\s\S]*?min-height:\s*clamp\(92px,\s*12vh,\s*128px\)\s*!important/);
  });
});
