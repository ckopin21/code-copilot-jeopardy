/** Room-code alphabet without look-alike characters (no I, O, 0, 1). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** URL-safe, high-entropy secret for Host tokens, reconnect tokens, and display links. */
export function randomToken(bytes = 24): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  let binary = '';
  for (const value of buffer) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Constant-time comparison for secrets. */
export function secureEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}
