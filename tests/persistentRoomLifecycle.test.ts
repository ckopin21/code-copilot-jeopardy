import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('persistent room lifecycle regression', () => {
  it('returns the host to the main menu without reloading the page', () => {
    const host = read('../src/components/HostAppV3.tsx');
    expect(host).toContain("await perform('host:pause')");
    expect(host).toContain("navigateInApp(menuUrl())");
    expect(host).not.toContain("location.href = menuUrl()");
  });

  it('reuses the saved host room when Start New Game is requested', () => {
    const host = read('../src/components/HostAppV3.tsx');
    expect(host).toContain("let snapshot = await emitAck<RoomSnapshot>('host:reconnect'");
    expect(host).toContain("snapshot = await emitAck<RoomSnapshot>('host:reset-game'");
    expect(host).toContain("localStorage.removeItem(`blue-stage-history-${parsed.roomCode}`)");
  });

  it('keeps host authority maintenance active while the host is on the menu route', () => {
    const socket = read('../src/lib/socket.ts');
    expect(socket).toContain("if (!hostRoomCode || !ownsHostAuthority(hostRoomCode)) return;");
    expect(socket).toContain("if (hostRoomCode && ownsHostAuthority(hostRoomCode)) emitRoom(hostRoomCode);");
    expect(socket).not.toContain("if (currentMode() !== 'host' || !hostRoomCode || !ownsHostAuthority(hostRoomCode)) return;");
  });

  it('offers Start New Game from completed-game surfaces', () => {
    const recap = read('../src/components/EndgameRecap.tsx');
    expect(recap).toContain('Start New Game');
    expect(recap).toContain('podium-new-game-button');
    expect(recap).not.toContain('>Reset Game</button>');
  });
});
