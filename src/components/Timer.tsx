import { useEffect, useState } from 'react';
import type { TimerState } from '../shared/types';

export function Timer({ timer }: { timer: TimerState }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!timer.running) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [timer.running]);
  if (!timer.durationMs) return null;
  const remaining = timer.running && timer.endsAt ? Math.max(0, timer.endsAt - now) : timer.remainingMs ?? 0;
  const ratio = Math.max(0, Math.min(1, remaining / timer.durationMs));
  return <div className={`timer ${ratio < .25 ? 'urgent' : ''}`} aria-live="polite"><span>{Math.ceil(remaining / 1000)}</span><div className="timer-track"><div className="timer-fill" style={{ transform: `scaleX(${ratio})` }} /></div></div>;
}
