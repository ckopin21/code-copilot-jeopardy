import { createElement, lazy, Suspense, useEffect, useState } from 'react';
import { GAMES, gameForUrl, storageNamespaceFor } from './games/registry';
import { setActiveGameStorageNamespace } from './platform/session/activeGame';

/** One lazily loaded root element per registered game, created once at startup. */
const GAME_ROOTS = new Map(GAMES.map((game) => [game.id, createElement(lazy(game.load))]));

/** Resolves the game for the current URL and points shared browser storage at it. */
function activateGameFromUrl(): string {
  const game = gameForUrl(location.href);
  setActiveGameStorageNamespace(storageNamespaceFor(game));
  return game.id;
}

/** Platform shell: picks the game from the URL and lets that game own everything below it. */
export default function App() {
  const [gameId, setGameId] = useState(activateGameFromUrl);
  useEffect(() => {
    const onPopState = () => setGameId(activateGameFromUrl());
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
