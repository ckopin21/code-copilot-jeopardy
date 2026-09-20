import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { AVATAR_CATALOG, getAvatarOption, type PlayerFrameStyle } from '../shared/playerCustomization';

const clampGlyphOffset = (value: number) => Math.max(-4, Math.min(4, value));

export function PlayerAvatar({
  avatarId,
  fallback,
  accent = '#ffd166',
  className = '',
  label,
  autoCenter = false
}: {
  avatarId?: string | null;
  fallback?: string;
  frameStyle?: PlayerFrameStyle;
  accent?: string;
  className?: string;
  label?: string;
  autoCenter?: boolean;
}) {
  const known = avatarId && AVATAR_CATALOG.some((avatar) => avatar.id === avatarId) ? getAvatarOption(avatarId) : null;
  const emoji = known?.fallback ?? fallback ?? '⭐';
  const accessibleLabel = label ?? known?.label ?? 'Player avatar';
  const artRef = useRef<HTMLSpanElement>(null);
  const glyphRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const art = artRef.current;
    const glyph = glyphRef.current;
    if (!art || !glyph) return;

    if (!autoCenter) {
      glyph.style.removeProperty('transform');
      return;
    }

    let frame = 0;
    const measure = () => {
      glyph.style.transform = 'none';

      const artRect = art.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(glyph);
      const glyphRect = range.getBoundingClientRect();
      range.detach();

      if (!artRect.width || !artRect.height || !glyphRect.width || !glyphRect.height) return;

      const artCenterX = artRect.left + artRect.width / 2;
      const artCenterY = artRect.top + artRect.height / 2;
      const glyphCenterX = glyphRect.left + glyphRect.width / 2;
      const glyphCenterY = glyphRect.top + glyphRect.height / 2;
      const shiftX = clampGlyphOffset(artCenterX - glyphCenterX);
      const shiftY = clampGlyphOffset(artCenterY - glyphCenterY);

      glyph.style.transform = `translate3d(${shiftX.toFixed(2)}px, ${shiftY.toFixed(2)}px, 0)`;
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
    observer?.observe(art);
    window.addEventListener('resize', scheduleMeasure);
    void document.fonts?.ready.then(scheduleMeasure);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      glyph.style.removeProperty('transform');
    };
  }, [autoCenter, emoji]);

  return <span
    ref={artRef}
    className={`player-avatar-art emoji-avatar ${className}`}
    data-avatar-id={known?.id}
    style={{ '--avatar-accent': accent } as CSSProperties}
    role="img"
    aria-label={accessibleLabel}
  >
    <span className="player-avatar-content" aria-hidden="true">
      <span ref={glyphRef} className="player-avatar-emoji">{emoji}</span>
    </span>
  </span>;
}
