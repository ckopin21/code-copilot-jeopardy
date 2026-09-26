// Runs the hosts on the one screen that plays sound: phase lines, time warnings, and lobby prefetching.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { DealSnapshot } from '../types';
import { narrator } from './narrator';
import { dueWarning, lobbyPrefetch, planNarration } from './narrationPlan';

export function useNarration(room: DealSnapshot | null, enabled: boolean): void {
  const previous = useRef<DealSnapshot | null>(null);
  const warned = useRef(new Set<string>());

  useEffect(() => {
    const before = previous.current;
    previous.current = room;
    if (!room || !enabled) { narrator.stop(); return; }
    if (room.paused) { if (!before?.paused) narrator.stop(); return; }
    if (!before) return;
    const plan = planNarration(before, room);
    if (plan) narrator.say(plan);
    else if (before.phase !== room.phase) narrator.stop();
  }, [room, enabled]);

  // Time warnings follow the server clock; each fires once.
  useEffect(() => {
    if (!room || !enabled || room.paused || !room.clock?.endsAt) return;
    const offset = room.serverNow - Date.now();
    const endsAt = room.clock.endsAt;
    const id = window.setInterval(() => {
      const due = dueWarning(room, endsAt - (Date.now() + offset));
      if (!due || warned.current.has(due.key)) return;
      warned.current.add(due.key);
      narrator.say({ items: [{ fixed: due.line }], interrupt: false, staleMs: 2_500 });
    }, 250);
    return () => window.clearInterval(id);
  }, [room, enabled]);

  // Lobby: render everyone's name lines while people are still joining.
  const prefetched = useRef('');
  useEffect(() => {
    if (!room || !enabled || room.phase !== 'lobby') return;
    const key = room.players.map((player) => `${player.lookSet}:${player.name}:${player.sayAs ?? ''}`).join('|');
    if (key === prefetched.current) return;
    prefetched.current = key;
    narrator.prefetch(lobbyPrefetch(room));
  }, [room, enabled]);
}

/** The line the hosts are saying right now, for captions. */
export function useNarrationCaption(): string | null {
  return useSyncExternalStore((listener) => narrator.onChange(listener), () => narrator.caption, () => null);
}
