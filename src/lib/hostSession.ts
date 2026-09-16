export const FRESH_HOST_QUERY = 'fresh';

export function isFreshHostUrl(href: string): boolean {
  const url = new URL(href);
  return url.searchParams.get('mode') === 'host' && url.searchParams.get(FRESH_HOST_QUERY) === '1';
}

export function stripFreshHostFlag(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(FRESH_HOST_QUERY);
  return url.href;
}
