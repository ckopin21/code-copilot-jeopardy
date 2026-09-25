import { createElement, lazy, Suspense, useEffect, useState } from 'react';
import { GAMES, gameForUrl } from './games/registry';

/** One lazily loaded root element per registered game, created once at startup. */
const GAME_ROOTS = new Map(GAMES.map((game) => [game.id, createElement(lazy(game.load))]));

/** Platform shell: picks the game from the URL and lets that game own everything below it. */
export default function App() {
  const [gameId, setGameId] = useState(() => gameForUrl(location.href).id);
  useEffect(() => {
    const onPopState = () => setGameId(gameForUrl(location.href).id);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return <Suspense fallback={<ShellLoading/>}>{GAME_ROOTS.get(gameId)}</Suspense>;
}

function ShellLoading() {
  return <main role="status" aria-live="polite" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#071a52', color: '#eaf4ff', fontFamily: 'system-ui, sans-serif' }}>
    Loading…
  </main>;
}
