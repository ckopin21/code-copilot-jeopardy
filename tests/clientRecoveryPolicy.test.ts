import { describe, expect, it } from 'vitest';
import {
  CLIENT_BACKGROUND_REFRESH_MS,
  HEARTBEAT_FAILURES_BEFORE_REFRESH,
  shouldForceClientTransportReset,
  shouldRefreshAfterHeartbeatFailures
} from '../src/lib/clientRecoveryPolicy';

describe('client recovery policy', () => {
  it('rebuilds transport after bfcache restoration', () => {
    expect(shouldForceClientTransportReset('pageshow', { persisted: true })).toBe(true);
    expect(shouldForceClientTransportReset('pageshow', { persisted: false })).toBe(false);
  });

  it('rebuilds transport after a meaningful background suspension', () => {
    expect(shouldForceClientTransportReset('visibility', { hiddenForMs: CLIENT_BACKGROUND_REFRESH_MS })).toBe(true);
    expect(shouldForceClientTransportReset('visibility', { hiddenForMs: CLIENT_BACKGROUND_REFRESH_MS - 1 })).toBe(false);
  });

  it('always rebuilds transport when connectivity returns', () => {
    expect(shouldForceClientTransportReset('online')).toBe(true);
  });

  it('does not rebuild for a brief app switch', () => {
    expect(CLIENT_BACKGROUND_REFRESH_MS).toBe(5000);
    expect(shouldForceClientTransportReset('visibility', { hiddenForMs: 3000 })).toBe(false);
  });

  it('requires repeated heartbeat failures before rebuilding transport', () => {
    expect(HEARTBEAT_FAILURES_BEFORE_REFRESH).toBe(2);
    expect(shouldRefreshAfterHeartbeatFailures(1)).toBe(false);
    expect(shouldRefreshAfterHeartbeatFailures(2)).toBe(true);
    expect(shouldRefreshAfterHeartbeatFailures(3)).toBe(true);
  });
});
