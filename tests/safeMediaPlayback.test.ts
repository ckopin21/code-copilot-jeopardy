import { describe, expect, it, vi } from 'vitest';
import { playMediaSafely } from '../src/lib/safeMediaPlayback';

describe('safe media playback', () => {
  it('returns immediately when play returns a pending promise', () => {
    const play = vi.fn(() => new Promise<void>(() => {}));
    expect(playMediaSafely({ play })).toBeUndefined();
    expect(play).toHaveBeenCalledOnce();
  });

  it('swallows rejected play promises', async () => {
    const play = vi.fn(() => Promise.reject(new Error('autoplay blocked')));
    expect(playMediaSafely({ play })).toBeUndefined();
    await Promise.resolve();
    expect(play).toHaveBeenCalledOnce();
  });

  it('swallows synchronous play failures', () => {
    const play = vi.fn(() => { throw new Error('media failure'); });
    expect(() => playMediaSafely({ play })).not.toThrow();
  });
});
