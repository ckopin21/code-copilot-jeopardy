import type { AnyServerGame } from './roomServer';
import { triviaServerGame } from '../src/games/trivia/server';

/**
 * Every game the room server hosts. The first entry is the default for `room:create`
 * requests that don't name a game. Keep ids in sync with src/games/registry.ts.
 */
export const SERVER_GAMES: readonly AnyServerGame[] = [triviaServerGame];
