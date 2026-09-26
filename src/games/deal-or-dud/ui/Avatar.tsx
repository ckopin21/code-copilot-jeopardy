import { AVATAR_PRESETS } from '../content/cues';
import type { PlayerLook } from '../types';

export function presetOf(id: string) {
  return AVATAR_PRESETS.find((preset) => preset.id === id) ?? AVATAR_PRESETS[0];
}

/** A player's face: their selfie, or a preset character with a prop. */
export function Avatar({ look, size = 96, className = '' }: { look: PlayerLook; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: size * 0.56 };
  if (look.kind === 'photo') {
    return <span className={`dod-avatar photo ${className}`} style={style}><img src={look.photo} alt="" draggable={false}/></span>;
  }
  const preset = presetOf(look.presetId);
  return <span className={`dod-avatar preset ${className}`} style={{ ...style, background: `radial-gradient(circle at 35% 30%, ${preset.bg}ee, ${preset.bg} 60%, #0008 140%)` }} aria-label={preset.label}>
    <span className="dod-avatar-emoji" aria-hidden="true">{preset.emoji}</span>
    {preset.prop && <span className="dod-avatar-prop" aria-hidden="true" style={{ fontSize: size * 0.3 }}>{preset.prop}</span>}
  </span>;
}
