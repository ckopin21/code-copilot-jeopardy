import { useState } from 'react';
import { usePresentationRoom } from './net';
import { TvStage } from './TvStage';
import { dealAudio } from '../audio/dealAudio';
import { useSoundtrack } from '../audio/useSoundtrack';
import { toggleFullscreen } from '../../../platform/ui/fullscreen';

/** Read-only TV display opened from the Host's display link. Sound here is opt-in so the room never hears two soundtracks. */
export function PresentationApp({ roomCode, token }: { roomCode: string; token: string }) {
  const { room, error } = usePresentationRoom(roomCode, token);
  const [soundOn, setSoundOn] = useState(false);
  useSoundtrack(room, soundOn);
  if (!room) return <main className="dod-app dod-loading"><p>{error || 'Connecting to the studio…'}</p></main>;
  return <main className="dod-app dod-tv">
    <TvStage room={room} hostBar={<nav className="dod-hostbar is-display">
      {!soundOn && <button onClick={() => void dealAudio.unlock().then(setSoundOn)} title="Turn this on only if the host screen's sound is off">🔊 Play sound here</button>}
      <button onClick={() => void toggleFullscreen()}>⛶</button>
    </nav>}/>
  </main>;
}
