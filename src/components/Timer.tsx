import { useEffect, useState } from 'react';
import type { TimerState } from '../shared/types';

interface TimerProps { timer: TimerState; serverNow?: number }
interface TimerAnchor { remainingMs: number; localAt: number; running: boolean }

function clampedRemaining(durationMs: number | null, remainingMs: number | null): number {
  if (!durationMs) return 0;
  return Math.max(0, Math.min(durationMs, remainingMs ?? durationMs));
}

export function Timer({ timer, serverNow }: TimerProps) {
  const { running, durationMs, endsAt, remainingMs } = timer;
  const [anchor, setAnchor] = useState<TimerAnchor>(() => ({
    remainingMs: clampedRemaining(durationMs, remainingMs),
    localAt: performance.now(),
    running
  }));
  const [, forceTick] = useState(0);

  useEffect(() => {
    setAnchor({ remainingMs: clampedRemaining(durationMs, remainingMs), localAt: performance.now(), running });
    if (!running) return;
    const id = window.setInterval(() => forceTick((value) => value + 1), 100);
    return () => window.clearInterval(id);
  }, [running, endsAt, remainingMs, durationMs, serverNow]);

  if (!durationMs) return null;
  const elapsed = anchor.running ? performance.now() - anchor.localAt : 0;
  const remaining = Math.max(0, Math.min(durationMs, anchor.remainingMs - elapsed));
  const ratio = Math.max(0, Math.min(1, remaining / durationMs));
  const seconds = Math.min(Math.ceil(durationMs / 1000), Math.ceil(remaining / 1000));
  return <div className={`timer ${ratio < .25 ? 'urgent' : ''}`} aria-live="polite"><span>{seconds}</span><div className="timer-track"><div className="timer-fill" style={{ transform: `scaleX(${ratio})` }} /></div></div>;
}
