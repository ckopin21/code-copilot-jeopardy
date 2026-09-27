/** File name for an emoji's art: its code points in hex, joined by "-", ignoring variation selectors ("1f988"). */
export function emojiKey(emoji: string): string {
  return [...emoji].map((char) => char.codePointAt(0)!).filter((code) => code !== 0xfe0f && code !== 0xfe0e).map((code) => code.toString(16)).join('-');
}
