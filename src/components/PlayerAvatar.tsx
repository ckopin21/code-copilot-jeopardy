import type { CSSProperties } from 'react';
import { AVATAR_CATALOG, getAvatarOption, type PlayerFrameStyle } from '../shared/playerCustomization';

export function PlayerAvatar({
  avatarId,
  fallback,
  frameStyle = 'clean',
  accent = '#ffd166',
  className = '',
  title
}: {
  avatarId?: string | null;
  fallback?: string;
  frameStyle?: PlayerFrameStyle;
  accent?: string;
  className?: string;
  title?: string;
}) {
  const known = avatarId && AVATAR_CATALOG.some((avatar) => avatar.id === avatarId) ? getAvatarOption(avatarId) : null;
  const emoji = known?.fallback ?? fallback ?? '⭐';
  const label = title ?? known?.label ?? 'Player avatar';

  return <span
    className={`player-avatar-art emoji-avatar ${className}`}
    data-avatar-id={known?.id}
    data-frame={frameStyle}
    style={{ '--avatar-accent': accent } as CSSProperties}
    title={label}
    role="img"
    aria-label={label}
  >
    <span className="player-avatar-emoji" aria-hidden="true">{emoji}</span>
  </span>;
}
