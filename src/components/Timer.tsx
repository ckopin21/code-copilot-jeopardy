import { useEffect, useState } from 'react';
import type { TimerState } from '../shared/types';

interface TimerProps {
  timer: TimerState;
  serverNow?: number;
}

interface TimerAnchor {
  remainingMs: number;
  localAt: number;
  running: boolean;
}

function clampedRemaining(timer: TimerState): number {
  if (!timer.durationMs) return 0;
  return Math.max(0, Math.min(timer.durationMs, timer.remainingMs ?? timer.durationMs));
}

export function Timer({ timer, serverNow }: TimerProps) {
  const [anchor, setAnchor] = useState<TimerAnchor>(() => ({
    remainingMs: clampedRemaining(timer),
    localAt: performance.now(),
    running: timer.running
  }));
  const [, forceTick] = useState(0);

  useEffect(() => {
    setAnchor({
      remainingMs: clampedRemaining(timer),
      localAt: performance.now(),
      running: timer.running
    });

    if (!timer.running) return;
    const id = window.setInterval(() => forceTick((value) => value + 1), 100);
    return () => window.clearInterval(id);
  }, [timer.running, timer.endsAt, timer.remainingMs, timer.durationMs, serverNow]);

  if (!timer.durationMs) return null;

  const elapsed = anchor.running ? performance.now() - anchor.localAt : 0;
  const remaining = Math.max(0, Math.min(timer.durationMs, anchor.remainingMs - elapsed));
  const ratio = Math.max(0, Math.min(1, remaining / timer.durationMs));
  const seconds = Math.min(Math.ceil(timer.durationMs / 1000), Math.ceil(remaining / 1000));

  return <div className={`timer ${ratio < .25 ? 'urgent' : ''}`} aria-live="polite"><span>{seconds}</span><div className="timer-track"><div className="timer-fill" style={{ transform: `scaleX(${ratio})` }} /></div></div>;
}
