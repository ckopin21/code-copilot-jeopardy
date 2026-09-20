import { describe, expect, it } from 'vitest';
import {
  CLIENT_BACKGROUND_REFRESH_MS,
  shouldForceClientTransportReset
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
});
