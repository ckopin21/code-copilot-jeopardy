import { useMemo, useState } from 'react';
import { HostAppV3 } from './components/HostAppV3';
import { PlayerApp } from './components/PlayerApp';
import { PresentationApp } from './components/PresentationApp';
import { audio } from './lib/audio';
import { menuUrl, resetInstance } from './lib/resetInstance';
import './styles.css';
import './showcase.css';

const HOST_KEY = 'blue-stage-host-room';

function go(mode: 'host' | 'player', fresh = false) {
  audio.stop();
  const url = new URL('./', location.href);
  url.searchParams.set('mode', mode);
  if (fresh) url.searchParams.set('fresh', '1');
  location.href = url.toString();
}

export default function App() {
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode');
  if (mode === 'host') return <HostAppV3/>;
  if (mode === 'player') return <PlayerApp/>;
  if (mode === 'presentation') return <PresentationApp/>;
  return <Menu/>;
}

function Menu() {
  const [resetting, setResetting] = useState(false);
  const hasSavedHost = useMemo(() => Boolean(localStorage.getItem(HOST_KEY)), []);

  const hardReset = async () => {
    if (!confirm('Reset this entire Blue Stage instance? This clears saved rooms, seats, scores, and cached Blue Stage data, then reloads the newest build.')) return;
    setResetting(true);
    audio.stop();
    await resetInstance();
  };

  return <main className="menu-shell showcase-menu">
    <div className="menu-backdrop" aria-hidden="true"><i/><i/><i/></div>
    <section className="menu-card">
      <div className="brand-mark hero-brand"><span>BLUE STAGE</span><strong>TRIVIA</strong></div>
      <p className="menu-subtitle">A shared-screen game show with phone buzzers, wagers, streaks, and a dramatic finish.</p>
      <div className="menu-actions">
        <button className="primary-button menu-primary" onClick={()=>go('host', true)}><span>Start New Game</span><small>Fresh room, fresh board, zero scores</small></button>
        {hasSavedHost && <button className="secondary-button menu-secondary" onClick={()=>go('host')}><span>Continue Game</span><small>Reconnect to the saved host room</small></button>}
        <button className="secondary-button menu-secondary" onClick={()=>go('player')}><span>Join a Game</span><small>Use this device as a player controller</small></button>
      </div>
      <div className="menu-utility">
        <button className="text-button" disabled={resetting} onClick={() => void hardReset()}>{resetting ? 'Resetting…' : 'Reset Instance'}</button>
        <span>Use this after an update to clear every saved Blue Stage state and load cleanly.</span>
      </div>
    </section>
    <footer className="menu-footer"><span>PHONE BUZZERS</span><b>•</b><span>DAILY DOUBLES</span><b>•</b><span>FINAL ROUND</span></footer>
  </main>;
}

export { menuUrl };
