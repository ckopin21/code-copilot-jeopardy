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
  load: () => Promise<{ default: ComponentType }>;
}

export const GAMES: readonly ClientGame[] = [
  { id: 'trivia', title: 'Blue Stage Trivia', load: () => import('./trivia') }
];

/** Opened when a URL has no `?game=`. Existing Join/Presentation links rely on this. */
export const DEFAULT_GAME_ID = 'trivia';

export function gameForUrl(href: string): ClientGame {
  const requested = new URL(href).searchParams.get('game');
  return GAMES.find((game) => game.id === requested) ?? GAMES.find((game) => game.id === DEFAULT_GAME_ID)!;
}
