// Turns snapshot changes into music and stings on the one screen that plays sound.
import { useEffect, useRef } from 'react';
import type { DealSnapshot, Phase } from '../types';
import { dealAudio, type MusicTrack } from './dealAudio';
import { TUTORIAL_TIMELINE } from '../ui/labels';
import { tutorialElapsed } from '../ui/TvStage';
import { useNarration } from './useNarration';

const MUSIC_FOR: Record<Phase, MusicTrack> = {
  lobby: 'lobby', tutorial: 'lobby', build: 'bed', stage: 'bed',
  offers: 'offers', 'offers-reveal': 'offers', partner: 'offers', reveal: null, break: 'lobby',
  final: null, forecast: 'offers', 'forecast-result': null, gameover: 'lobby'
};

const TICKING_PHASES: readonly Phase[] = ['build', 'offers', 'partner', 'forecast'];

export function useSoundtrack(room: DealSnapshot | null, enabled: boolean, onTutorialDone?: () => void): void {
  const previous = useRef<DealSnapshot | null>(null);
  const narrated = useRef<string>('');
  const ticked = useRef('');
  useNarration(room, enabled);

  const audioSettings = room?.settings.audio;
  useEffect(() => { if (audioSettings) dealAudio.applySettings(audioSettings); }, [audioSettings]);

  useEffect(() => {
    const before = previous.current;
    previous.current = room;
    if (!room || !enabled) { if (!enabled) void dealAudio.music(null); return; }
    void dealAudio.music(room.paused ? null : MUSIC_FOR[room.phase]);
    if (!before || before.code !== room.code) return;
    const changed = before.phase !== room.phase;
    const round = room.round;
    if (changed) {
      if ((room.phase === 'tutorial' || room.phase === 'build') && (before.phase === 'lobby')) void dealAudio.sting('fanfare', 0.9);
      if (room.phase === 'stage') void dealAudio.sting('pitch', 0.8);
      if (room.phase === 'reveal' && round?.result) void dealAudio.sting(round.result.verdict === 'good' ? 'good' : 'bad', 1);
      if (room.phase === 'offers-reveal') void dealAudio.sting('reveal-card', 0.8);
      if (room.phase === 'final') void dealAudio.sting('fanfare', 0.8);
      if (room.phase === 'gameover') void dealAudio.sting('winner', 1);
      if (before.phase === 'tutorial') dealAudio.stopNarration();
    }
    // A shark peeked: a soft card flip. Never loud over speech.
    if (round && before.round?.index === round.index && room.phase === 'stage' && round.peeks.length > (before.round?.peeks.length ?? 0)) void dealAudio.sting('reveal-card', 0.4);
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

  // Tutorial narration follows the shared timeline; the host tab ends the tutorial when the last line finishes.
  useEffect(() => {
    if (!room || room.phase !== 'tutorial') { narrated.current = ''; return; }
    const offset = room.serverNow - Date.now();
    const id = window.setInterval(() => {
      const elapsed = tutorialElapsed(room, Date.now(), offset);
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
