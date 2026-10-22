// Client entry for Deal or Dud. Loaded on demand by src/games/registry.ts.
import './styles.css';
import { useEffect, useState } from 'react';
import { HostApp } from './ui/HostApp';
import { PresentationApp } from './ui/PresentationApp';
import { PhoneApp } from './ui/phone/PhoneApp';
import { menuUrl, navigateInApp, pickerUrl } from '../../platform/session/resetInstance';
import { GAME_ID } from './types';

function DealMenu() {
  const go = (mode: string) => { const url = new URL(menuUrl({ game: GAME_ID })); url.searchParams.set('mode', mode); navigateInApp(url.toString()); };
  return <main className="dod-app dod-menu">
    <div className="dod-logo big">Deal <span>or</span> Dud</div>
    <p>Four players. One ridiculous business. Three sharks deciding whether to invest.</p>
    <div className="dod-menu-buttons">
      <button className="dod-primary big" onClick={() => go('host')}>📺 Host on this screen (TV)</button>
      <button className="dod-ghost big" onClick={() => go('player')}>📱 Join on this phone</button>
      <button className="dod-link" onClick={() => navigateInApp(pickerUrl())}>← All games</button>
    </div>
  </main>;
}

export default function DealOrDud() {
  const [search, setSearch] = useState(location.search);
  useEffect(() => {
    const onPopState = () => setSearch(location.search);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  const room = (params.get('room') ?? '').toUpperCase();
  if (mode === 'host') return <HostApp/>;
  if (mode === 'presentation') return <PresentationApp roomCode={room} token={params.get('display') ?? ''}/>;
  if (mode === 'player') return <PhoneApp urlRoomCode={room}/>;
  return <DealMenu/>;
}
