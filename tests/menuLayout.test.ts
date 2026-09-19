import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const menuLayout = readFileSync(new URL('../src/menu-desktop-layout.css', import.meta.url), 'utf8');
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

  it('lets the desktop host action stack fill its entire panel', () => {
    expect(menuLayout).toMatch(/\.showcase-menu \.host-menu-actions\s*\{[\s\S]*?width:\s*100%\s*!important/);
    expect(menuLayout).toMatch(/\.showcase-menu \.host-menu-actions\s*\{[\s\S]*?max-width:\s*none\s*!important/);
  });
});
