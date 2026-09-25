import type { ComponentType } from 'react';

/**
 * Every game playable from this app. A game's client code, styles, and assets load only
 * when that game is opened, so games cannot affect each other's first paint.
 *
 * To add a game, see docs/adding-a-game.md. The matching server registration lives in
 * server/games.ts.
 */
export interface ClientGame {
  /** URL and server id, e.g. `?game=trivia`. Lowercase kebab-case, never reused. */
  id: string;
  title: string;
  /** Prefix for this game's browser storage keys. Defaults to `blue-stage-<id>`; never change it after release. */
  storageNamespace?: string;
  load: () => Promise<{ default: ComponentType }>;
}

export const GAMES: readonly ClientGame[] = [
  // Trivia predates multi-game support, so it keeps the original un-suffixed keys.
  { id: 'trivia', title: 'Blue Stage Trivia', storageNamespace: 'blue-stage', load: () => import('./trivia') }
];

export function storageNamespaceFor(game: ClientGame): string {
  return game.storageNamespace ?? `blue-stage-${game.id}`;
}

/** Opened when a URL has no `?game=`. Existing Join/Presentation links rely on this. */
export const DEFAULT_GAME_ID = 'trivia';

export function gameForUrl(href: string): ClientGame {
  const requested = new URL(href).searchParams.get('game');
  return GAMES.find((game) => game.id === requested) ?? GAMES.find((game) => game.id === DEFAULT_GAME_ID)!;
}
