// Turns snapshot changes into music and stings on the one screen that plays sound.
import { useEffect, useRef } from 'react';
import type { DealSnapshot, Phase } from '../types';
import { dealAudio, type MusicTrack, type Sting } from './dealAudio';
import { TUTORIAL_TIMELINE, clockElapsed, revealSchedule } from '../ui/labels';
import { useNarration } from './useNarration';

const MUSIC_FOR: Record<Phase, MusicTrack> = {
  lobby: 'lobby', tutorial: 'lobby', build: 'bed', stage: 'bed',
  offers: 'offers', reveal: null, break: 'lobby',
  final: null, forecast: 'offers', 'forecast-result': null, gameover: 'celebrate'
};

/**
 * A musical sting that opens a phase (the fanfare, the round sting, the winner). The phase's loop waits until the sting
 * has played, so two pieces of music never overlap. `key` ties the hold to one phase; a new phase drops it.
 */
interface Hold { key: string; ready: boolean }
const phaseKey = (room: DealSnapshot) => `${room.code}:${room.gameNumber}:${room.roundIndex}:${room.phase}`;
/** The sting that opens a phase, if any. */
function openingSting(before: DealSnapshot, room: DealSnapshot): { name: Sting; level: number } | null {
  if ((room.phase === 'tutorial' || room.phase === 'build') && before.phase === 'lobby') return { name: 'fanfare', level: 0.9 };
  if (room.phase === 'stage') return { name: 'pitch', level: 0.8 };
  if (room.phase === 'final') return { name: 'fanfare', level: 0.8 };
  if (room.phase === 'gameover') return { name: 'winner', level: 1 };
  return null;
}

const TICKING_PHASES: readonly Phase[] = ['build', 'offers', 'forecast'];

export function useSoundtrack(room: DealSnapshot | null, enabled: boolean, onTutorialDone?: () => void): void {
  const previous = useRef<DealSnapshot | null>(null);
  const narrated = useRef<string>('');
  const ticked = useRef('');
  const revealCues = useRef(new Set<string>());
  const hold = useRef<Hold | null>(null);
  const holdTimer = useRef(0);
  useNarration(room, enabled);

  const audioSettings = room?.settings.audio;
  useEffect(() => { if (audioSettings) dealAudio.applySettings(audioSettings); }, [audioSettings]);
  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  useEffect(() => {
    const before = previous.current;
    previous.current = room;
    if (!room || !enabled) { if (!enabled) void dealAudio.music(null); return; }
    const sameRoom = !!before && before.code === room.code;
    const changed = sameRoom && before.phase !== room.phase;
    const key = phaseKey(room);
    if (hold.current && hold.current.key !== key) { hold.current = null; window.clearTimeout(holdTimer.current); }
    // A phase that opens with a musical sting: the sting plays alone, then the phase's loop comes in.
    // (A screen opened mid-phase has no "before" and goes straight to the loop.)
    const opener = changed ? openingSting(before, room) : null;
    if (opener) {
      const current: Hold = { key, ready: false };
      hold.current = current;
      window.clearTimeout(holdTimer.current);
      void dealAudio.sting(opener.name, opener.level).then((seconds) => {
        holdTimer.current = window.setTimeout(() => {
          if (hold.current !== current) return;
          current.ready = true;
          const latest = previous.current;
          if (latest && !latest.paused && phaseKey(latest) === current.key) void dealAudio.music(MUSIC_FOR[latest.phase]);
        }, seconds * 1000);
      });
    }
    const waiting = hold.current?.key === key && !hold.current.ready;
    void dealAudio.music(room.paused || waiting ? null : MUSIC_FOR[room.phase]);
    if (!sameRoom) return;
    const round = room.round;
    if (changed) {
      if (room.phase === 'reveal') void dealAudio.sting('drumroll', 0.9);
      if (before.phase === 'tutorial') dealAudio.stopNarration();
    }
    // A shark said "I'm out!": the buzzer.
    if (round && before.round?.index === round.index && room.phase === 'stage' && round.out.length > (before.round?.out.length ?? 0)) void dealAudio.sting('bad', 0.7);
    if (round && before.round?.index === round.index && round.lockedOffers.length > (before.round?.lockedOffers.length ?? 0) && room.phase === 'offers') void dealAudio.sting('lock', 0.5);
  }, [room, enabled]);

  // Countdown ticks in the last five seconds of the decision clocks (not on stage, where people talk).
  useEffect(() => {
    if (!room || !enabled || room.paused || !room.clock?.endsAt || !TICKING_PHASES.includes(room.phase)) return;
    const offset = room.serverNow - Date.now();
    const endsAt = room.clock.endsAt;
    const id = window.setInterval(() => {
      const seconds = Math.ceil((endsAt - (Date.now() + offset)) / 1000);
      const key = `${endsAt}:${seconds}`;
      if (seconds < 1 || seconds > 5 || ticked.current === key) return;
      ticked.current = key;
      void dealAudio.sting('tick', 0.6);
    }, 100);
    return () => window.clearInterval(id);
  }, [room, enabled]);

  // The reveal: a card flip as each bid turns over, then a fanfare for the total (a buzzer when nobody bid).
  useEffect(() => {
    if (!room || !enabled || room.paused || room.phase !== 'reveal' || !room.clock || !room.round?.result) return;
    const offset = room.serverNow - Date.now();
    const schedule = revealSchedule(room.clock.totalMs);
    const total = room.round.result.total;
    const base = `${room.code}:${room.gameNumber}:${room.roundIndex}`;
    const cues: { at: number; key: string; play: () => void }[] = [
      ...schedule.flips.map((at, index) => ({ at, key: `${base}:flip${index}`, play: () => void dealAudio.sting('reveal-card', 0.9) })),
      { at: schedule.total, key: `${base}:total`, play: () => void dealAudio.sting(total > 0 ? 'good' : 'bad', 1) }
    ];
    const id = window.setInterval(() => {
      const elapsed = clockElapsed(room, Date.now(), offset);
      for (const cue of cues) {
        if (elapsed < cue.at || revealCues.current.has(cue.key)) continue;
        revealCues.current.add(cue.key);
        if (elapsed < cue.at + 1) cue.play();
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [room, enabled]);

  // Tutorial narration follows the shared timeline; the host tab ends the tutorial when the last line finishes.
  useEffect(() => {
    if (!room || room.phase !== 'tutorial') { narrated.current = ''; return; }
    const offset = room.serverNow - Date.now();
    const id = window.setInterval(() => {
      const elapsed = clockElapsed(room, Date.now(), offset);
      const current = [...TUTORIAL_TIMELINE].reverse().find((item) => elapsed >= item.start);
      const key = current ? `${room.tutorialRun}:${current.step.id}` : '';
      if (enabled && current && narrated.current !== key && !room.paused) {
        narrated.current = key;
        void dealAudio.narrate(`${current.step.id}.mp3`);
      }
      const last = TUTORIAL_TIMELINE[TUTORIAL_TIMELINE.length - 1];
      if (elapsed > last.start + last.seconds + 0.8) { window.clearInterval(id); onTutorialDone?.(); }
    }, 200);
    return () => window.clearInterval(id);
  }, [room, enabled, onTutorialDone]);
}
