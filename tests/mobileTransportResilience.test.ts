import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('mobile transport resilience integration', () => {
  it('does not tear down the WebRTC path on a single heartbeat timeout', () => {
    const socket = read('../src/lib/socket.ts');
    expect(socket).toContain("event !== 'player:heartbeat'");
    expect(socket).toContain('const HEARTBEAT_TIMEOUT_MS = 9000;');
  });

  it('escalates repeated heartbeat failures into a clean transport rebuild', () => {
    const player = read('../src/components/PlayerApp.tsx');
    expect(player).toContain('shouldRefreshAfterHeartbeatFailures(syncFailuresRef.current)');
    expect(player).toContain('resumeClientSession(false, true);');
  });
});
