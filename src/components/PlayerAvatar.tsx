import type { CSSProperties } from 'react';
import { AVATAR_CATALOG, getAvatarOption, type PlayerFrameStyle } from '../shared/playerCustomization';

export function PlayerAvatar({
  avatarId,
  fallback,
  frameStyle = 'clean',
  accent = '#ffd166',
  className = '',
  label
}: {
  avatarId?: string | null;
  fallback?: string;
  frameStyle?: PlayerFrameStyle;
  accent?: string;
  className?: string;
  label?: string;
}) {
  const known = avatarId && AVATAR_CATALOG.some((avatar) => avatar.id === avatarId) ? getAvatarOption(avatarId) : null;
  const emoji = known?.fallback ?? fallback ?? '⭐';
  const accessibleLabel = label ?? known?.label ?? 'Player avatar';

  return <span
    className={`player-avatar-art emoji-avatar ${className}`}
    data-avatar-id={known?.id}
    data-frame={frameStyle}
    style={{ '--avatar-accent': accent } as CSSProperties}
    role="img"
    aria-label={accessibleLabel}
  >
    <span className="player-avatar-frame" aria-hidden="true" />
    <span className="player-avatar-content" aria-hidden="true">
      <span className="player-avatar-emoji">{emoji}</span>
    </span>
  </span>;
}
