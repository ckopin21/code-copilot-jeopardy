import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('normal host layout regression', () => {
  it('keeps the empty-player practice state inside the board header', () => {
    const host = read('../src/components/HostAppV3.tsx');
    expect(host).toContain('connectedPlayers.length > 0 && <PlayerStrip');
    expect(host).toContain('PRACTICE · ${gameMode.name}');
  });

  it('loads the normal host layout overrides last', () => {
    const main = read('../src/main.tsx');
    expect(main.indexOf("import './normal-host-layout.css';"))
      .toBeGreaterThan(main.indexOf("import './game-modes.css';"));
  });

  it('aligns utility controls to the board without changing presentation mode', () => {
    const css = read('../src/normal-host-layout.css');
    expect(css).toContain('.showcase-host:not(.host-presentation-mode)');
    expect(css).toContain('--normal-host-stage-edge');
    expect(css).toContain('.dev-mode-trigger');
    expect(css).toContain('.dev-presentation-trigger');
    expect(css).toContain('.host-command-trigger');
    expect(css).not.toContain('.showcase-host.host-presentation-mode >');
  });
});
