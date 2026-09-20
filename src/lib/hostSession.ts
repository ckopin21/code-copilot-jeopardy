export const FRESH_HOST_QUERY = 'fresh';
export const NEW_GAME_HOST_QUERY = 'new-game';

export function isFreshHostUrl(href: string): boolean {
  const url = new URL(href);
  return url.searchParams.get('mode') === 'host' && url.searchParams.get(FRESH_HOST_QUERY) === '1';
}

export function stripFreshHostFlag(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(FRESH_HOST_QUERY);
  return url.href;
}


export function isNewGameHostUrl(href: string): boolean {
  const url = new URL(href);
  return url.searchParams.get('mode') === 'host' && url.searchParams.get(NEW_GAME_HOST_QUERY) === '1';
}

export function stripNewGameHostFlag(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(NEW_GAME_HOST_QUERY);
  return url.href;
}
