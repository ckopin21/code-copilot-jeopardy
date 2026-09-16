import { HostApp } from './components/HostApp';
import { PlayerApp } from './components/PlayerApp';
import { PresentationApp } from './components/PresentationApp';
import './styles.css';

function go(mode: 'host' | 'player') {
  const url = new URL(location.href);
  url.search = `?mode=${mode}`;
  url.hash = '';
  location.href = url.toString();
}

export default function App() {
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode');
  if (mode === 'host') return <HostApp/>;
  if (mode === 'player') return <PlayerApp/>;
  if (mode === 'presentation') return <PresentationApp/>;
  return <main className="landing-screen"><div className="landing-glow"/><section className="landing-card"><div className="logo-lockup"><span>BLUE STAGE</span><strong>TRIVIA</strong></div><p>Fast buzzers. Big wagers. One final answer.</p><div className="landing-actions"><button className="primary-button giant" onClick={()=>go('host')}>Host a Game</button><button className="secondary-button giant" onClick={()=>go('player')}>Join on Phone</button></div><small>Original game-show visuals and procedural audio.</small></section></main>;
}
