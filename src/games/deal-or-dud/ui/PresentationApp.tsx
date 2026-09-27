import { usePresentationRoom } from './net';
import { TvStage } from './TvStage';
import { JoinCard, JoinedList } from './JoinCard';
import { useAutoSound } from '../audio/useAutoSound';
import { useSoundtrack } from '../audio/useSoundtrack';
import { toggleFullscreen } from '../../../platform/ui/fullscreen';

/** Read-only TV display opened from the Host's display link. It plays the soundtrack by default (the host tab can turn its own sound off in settings). */
export function PresentationApp({ roomCode, token }: { roomCode: string; token: string }) {
  const { room, error } = usePresentationRoom(roomCode, token);
  const { soundOn, unlockSound } = useAutoSound();
  useSoundtrack(room, soundOn);
  if (!room) return <main className="dod-app dod-loading"><p>{error || 'Connecting to the studio…'}</p></main>;
  return <main className="dod-app dod-tv">
    <TvStage room={room}
      extra={room.phase === 'lobby' && <JoinCard room={room} joinUrl={room.joinUrl}><JoinedList room={room}/></JoinCard>}
      hostBar={<nav className="dod-hostbar is-display">
      {!soundOn && <button onClick={() => void unlockSound()} title="Browsers keep a page silent until you click it">🔊 Play sound here</button>}
      <button onClick={() => void toggleFullscreen()}>⛶</button>
    </nav>}/>
  </main>;
}
