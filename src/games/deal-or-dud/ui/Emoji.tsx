import { ART_KEYS } from '../artManifest';
import { emojiKey } from './emojiKey';

/**
 * An emoji drawn as its Fluent 3D image (public/deal-or-dud/art/, from scripts/deal-or-dud/copy-art.ts), sized to the
 * surrounding font like the text it replaces. Emoji without an image stay text.
 */
export function Emoji({ char, className = '' }: { char: string; className?: string }) {
  const key = emojiKey(char);
  if (!ART_KEYS.has(key)) return <span className={className} aria-hidden="true">{char}</span>;
  return <img className={`dod-emoji ${className}`} src={`/deal-or-dud/art/${key}.png`} alt="" aria-hidden="true" draggable={false}/>;
}
