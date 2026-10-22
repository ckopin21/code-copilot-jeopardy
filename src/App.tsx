import { createElement, lazy, Suspense, useEffect, useState } from 'react';
import { GAMES, gameForUrl, storageNamespaceFor, wantsGamePicker } from './games/registry';
import { GamePicker } from './GamePicker';
import { setActiveGameId, setActiveGameStorageNamespace } from './platform/session/activeGame';

/** One lazily loaded root element per registered game, created once at startup. */
const GAME_ROOTS = new Map(GAMES.map((game) => [game.id, createElement(lazy(game.load))]));

/** Resolves the game for the current URL and points shared browser storage at it. */
function activateGameFromUrl(): string {
  if (wantsGamePicker(location.href)) { setActiveGameId(null); return PICKER; }
  const game = gameForUrl(location.href);
  setActiveGameId(game.id);
  setActiveGameStorageNamespace(storageNamespaceFor(game));
  return game.id;
}
const PICKER = '';
/** The picker keeps the page's original title from index.html. */
const DEFAULT_TITLE = document.title;

/** Platform shell: picks the game from the URL and lets that game own everything below it. */
export default function App() {
  const [gameId, setGameId] = useState(activateGameFromUrl);
  useEffect(() => {
    const onPopState = () => setGameId(activateGameFromUrl());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    document.title = GAMES.find((game) => game.id === gameId)?.title ?? DEFAULT_TITLE;
  }, [gameId]);

  if (gameId === PICKER) return <GamePicker games={GAMES}/>;
  return <Suspense fallback={<ShellLoading/>}>{GAME_ROOTS.get(gameId)}</Suspense>;
}

function ShellLoading() {
  return <main role="status" aria-live="polite" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#071a52', color: '#eaf4ff', fontFamily: 'system-ui, sans-serif' }}>
    Loading…
  </main>;
}
