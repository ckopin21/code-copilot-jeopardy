import { useEffect, useRef, useState } from 'react';
import type { TimerState } from '../shared/types';

interface TimerProps {
  timer: TimerState;
  serverNow?: number;
}

export function Timer({ timer, serverNow }: TimerProps) {
  const [, forceTick] = useState(0);
  const anchorRef = useRef({
    key: '',
    localAt: performance.now(),
    serverAt: serverNow ?? Date.now(),
    remainingAt: timer.remainingMs ?? timer.durationMs ?? 0
  });

  const key = `${timer.running}|${timer.endsAt ?? 'none'}|${timer.remainingMs ?? 'none'}|${timer.durationMs ?? 'none'}|${serverNow ?? 'local'}`;
  if (anchorRef.current.key !== key) {
    anchorRef.current = {
      key,
      localAt: performance.now(),
      serverAt: serverNow ?? Date.now(),
      remainingAt: Math.max(0, Math.min(timer.durationMs ?? Number.POSITIVE_INFINITY, timer.remainingMs ?? timer.durationMs ?? 0))
    };
  }

  useEffect(() => {
    if (!timer.running) return;
    const id = window.setInterval(() => forceTick((value) => value + 1), 100);
    return () => window.clearInterval(id);
  }, [timer.running, timer.endsAt]);

  if (!timer.durationMs) return null;

  const elapsedLocal = performance.now() - anchorRef.current.localAt;
  let remaining: number;
  if (!timer.running) {
    remaining = timer.remainingMs ?? 0;
  } else if (timer.endsAt && serverNow !== undefined) {
    const estimatedServerNow = anchorRef.current.serverAt + elapsedLocal;
    remaining = timer.endsAt - estimatedServerNow;
  } else {
    remaining = anchorRef.current.remainingAt - elapsedLocal;
  }

  remaining = Math.max(0, Math.min(timer.durationMs, remaining));
  const ratio = Math.max(0, Math.min(1, remaining / timer.durationMs));
  const seconds = Math.min(Math.ceil(timer.durationMs / 1000), Math.ceil(remaining / 1000));

  return <div className={`timer ${ratio < .25 ? 'urgent' : ''}`} aria-live="polite"><span>{seconds}</span><div className="timer-track"><div className="timer-fill" style={{ transform: `scaleX(${ratio})` }} /></div></div>;
}
