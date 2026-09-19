import type { CSSProperties, ReactNode } from 'react';
import { getAvatarOption, type PlayerFrameStyle } from '../shared/playerCustomization';

function face(eyeY = 31): ReactNode {
  return <><circle cx="25" cy={eyeY} r="2.4" fill="#071d2f"/><circle cx="39" cy={eyeY} r="2.4" fill="#071d2f"/><path d="M26 40 Q32 44 38 40" fill="none" stroke="#071d2f" strokeWidth="2.5" strokeLinecap="round"/></>;
}

function avatarArt(avatarId: string): ReactNode {
  const avatar = getAvatarOption(avatarId);
  const { primary, secondary, category, variant } = avatar;
  const body = <path d="M14 29 Q14 15 32 13 Q50 15 50 29 V44 Q48 54 32 56 Q16 54 14 44 Z" fill={primary}/>;

  if (category === 'animals') return <g>
    {variant === 0 && <><path d="M17 20 12 8 25 15Z" fill={primary}/><path d="M47 20 52 8 39 15Z" fill={primary}/></>}
    {variant === 1 && <><circle cx="18" cy="16" r="8" fill={primary}/><circle cx="46" cy="16" r="8" fill={primary}/></>}
    {variant === 2 && <><circle cx="22" cy="13" r="6" fill={primary}/><circle cx="42" cy="13" r="6" fill={primary}/></>}
    {variant === 3 && <path d="M48 24 58 31 48 36Z" fill={primary}/>}
    {variant === 4 && <><circle cx="18" cy="17" r="7" fill="#162536"/><circle cx="46" cy="17" r="7" fill="#162536"/></>}
    {body}<ellipse cx="32" cy="38" rx="10" ry="7" fill={secondary}/>{face(30)}
  </g>;

  if (category === 'robots') return <g>
    <rect x="14" y="17" width="36" height="36" rx={variant % 2 ? 8 : 5} fill={primary}/>
    <path d="M32 17V10" stroke={secondary} strokeWidth="3" strokeLinecap="round"/><circle cx="32" cy="8" r="3.5" fill={secondary}/>
    <rect x="20" y="27" width="24" height="13" rx="4" fill={secondary}/><circle cx="26" cy="33" r="2.3" fill="#071d2f"/><circle cx="38" cy="33" r="2.3" fill="#071d2f"/>
    <path d={variant === 1 ? "M25 46H39" : variant === 2 ? "M24 46h4m4 0h4m4 0h2" : "M26 46Q32 50 38 46"} fill="none" stroke={secondary} strokeWidth="2.5" strokeLinecap="round"/>
  </g>;

  if (category === 'fantasy') return <g>
    {variant === 0 && <path d="M13 31Q15 10 32 7Q49 10 51 31L44 25Q32 18 20 25Z" fill={primary}/>}
    {variant === 1 && <path d="M18 18 32 8 46 18 50 38 44 54H20L14 38Z" fill={primary}/>}
    {variant === 2 && <><path d="M18 19 11 9 25 15Z" fill={primary}/><path d="M46 19 53 9 39 15Z" fill={primary}/></>}
    {variant === 3 && <circle cx="32" cy="32" r="23" fill={primary}/>}
    {variant === 4 && <path d="M15 23 20 10 29 18 35 8 42 18 50 11 49 30Z" fill={primary}/>}
    {variant !== 3 && <path d="M15 29Q15 17 32 16Q49 17 49 29V45Q46 54 32 55Q18 54 15 45Z" fill={secondary}/>}
    {variant === 3 && <circle cx="32" cy="32" r="16" fill={secondary}/>}
    {face(31)}
  </g>;

  if (category === 'space') return <g>
    {variant === 0 && <><circle cx="32" cy="31" r="23" fill={primary}/><circle cx="32" cy="31" r="17" fill="#17466a"/><path d="M20 48H44L48 58H16Z" fill={secondary}/>{face(30)}</>}
    {variant === 1 && <><path d="M11 32Q14 12 32 10Q50 12 53 32Q50 54 32 56Q14 54 11 32Z" fill={primary}/><ellipse cx="24" cy="30" rx="4" ry="7" fill="#071d2f"/><ellipse cx="40" cy="30" rx="4" ry="7" fill="#071d2f"/></>}
    {variant === 2 && <><path d="M12 43 38 10 48 18 25 51Z" fill={primary}/><path d="M38 10 57 6 48 18Z" fill={secondary}/><circle cx="24" cy="38" r="5" fill={secondary}/></>}
    {variant === 3 && <><rect x="23" y="19" width="18" height="27" rx="5" fill={primary}/><path d="M23 24 12 18M41 24 52 18M23 39 11 47M41 39 53 47" stroke={secondary} strokeWidth="4" strokeLinecap="round"/><circle cx="32" cy="32" r="5" fill={secondary}/></>}
    {variant === 4 && <><circle cx="32" cy="31" r="18" fill={primary}/><path d="M7 38Q32 23 57 34Q31 49 7 38Z" fill="none" stroke={secondary} strokeWidth="5"/><circle cx="38" cy="24" r="4" fill={secondary}/></>}
  </g>;

  if (category === 'food') return <g>
    {variant === 0 && <><path d="M10 39Q32 12 54 39L49 48H15Z" fill={primary}/><path d="M16 35Q32 19 48 35" stroke={secondary} strokeWidth="6" strokeLinecap="round"/>{face(38)}</>}
    {variant === 1 && <><circle cx="32" cy="32" r="22" fill={primary}/><circle cx="32" cy="32" r="8" fill="#071d2f"/><path d="M18 24l5 2m16-6 5 3M20 42l5-3m14 6 4-4" stroke={secondary} strokeWidth="3" strokeLinecap="round"/></>}
    {variant === 2 && <><rect x="14" y="22" width="36" height="26" rx="10" fill={secondary}/><rect x="18" y="15" width="28" height="15" rx="7" fill={primary}/>{face(35)}</>}
    {variant === 3 && <><path d="M17 12 52 48 12 51Z" fill={primary}/><circle cx="28" cy="33" r="3" fill={secondary}/><circle cx="37" cy="41" r="3" fill={secondary}/></>}
    {variant === 4 && <><path d="M14 26Q14 12 32 12Q50 12 50 28Q50 49 32 55Q14 49 14 26Z" fill={primary}/><path d="M24 12Q28 5 33 11Q39 4 42 13" fill="none" stroke={secondary} strokeWidth="4"/>{face(30)}</>}
  </g>;

  if (category === 'monsters') return <g>
    {variant === 0 && <><path d="M14 55V29Q15 12 32 12Q49 12 50 29V55L44 50 38 55 32 50 26 55 20 50Z" fill={primary}/>{face(31)}</>}
    {variant === 1 && <><path d="M13 35Q14 14 32 12Q50 14 51 35Q47 54 32 56Q17 54 13 35Z" fill={primary}/><circle cx="32" cy="30" r="9" fill={secondary}/><circle cx="32" cy="30" r="4" fill="#071d2f"/></>}
    {variant === 2 && <><path d="M10 44Q11 21 20 22Q23 12 32 18Q42 10 46 23Q56 22 54 44Q52 55 32 56Q12 55 10 44Z" fill={primary}/>{face(34)}</>}
    {variant === 3 && <><path d="M17 18 11 6 27 15M47 18 53 6 37 15" fill={primary}/>{body}{face(31)}</>}
    {variant === 4 && <><path d="M12 32Q13 14 32 10Q51 14 52 32Q50 53 32 56Q14 53 12 32Z" fill={primary}/><path d="M20 18 17 8M44 18 47 8" stroke={secondary} strokeWidth="5" strokeLinecap="round"/>{face(31)}</>}
  </g>;

  if (category === 'objects') return <g>
    {variant === 0 && <><rect x="11" y="19" width="42" height="32" rx="7" fill={primary}/><circle cx="32" cy="35" r="11" fill={secondary}/><circle cx="32" cy="35" r="5" fill="#071d2f"/><rect x="17" y="14" width="12" height="8" rx="2" fill={secondary}/></>}
    {variant === 1 && <><rect x="11" y="18" width="42" height="30" rx="5" fill={primary}/><circle cx="23" cy="34" r="7" fill={secondary}/><circle cx="41" cy="34" r="7" fill={secondary}/><path d="M19 49h26" stroke={secondary} strokeWidth="5"/></>}
    {variant === 2 && <><path d="M22 18Q22 8 32 8Q42 8 42 18L48 34H16Z" fill={primary}/><rect x="28" y="34" width="8" height="15" fill={secondary}/><rect x="22" y="49" width="20" height="6" rx="3" fill={primary}/></>}
    {variant === 3 && <><path d="M18 12H46V23Q46 38 32 42Q18 38 18 23Z" fill={primary}/><path d="M18 18H10Q9 31 21 32M46 18H54Q55 31 43 32" fill="none" stroke={secondary} strokeWidth="4"/><rect x="28" y="42" width="8" height="8" fill={secondary}/><rect x="22" y="50" width="20" height="5" rx="2" fill={primary}/></>}
    {variant === 4 && <><rect x="10" y="20" width="44" height="31" rx="6" fill={primary}/><circle cx="21" cy="36" r="8" fill={secondary}/><circle cx="43" cy="36" r="8" fill={secondary}/><path d="M18 14h28" stroke={secondary} strokeWidth="5" strokeLinecap="round"/></>}
  </g>;

  if (category === 'retro') return <g shapeRendering="crispEdges">
    {variant === 0 && <><path d="M16 14h32v8h8v24h-8v8H16v-8H8V22h8Z" fill={primary}/><rect x="20" y="27" width="6" height="6" fill={secondary}/><rect x="38" y="27" width="6" height="6" fill={secondary}/></>}
    {variant === 1 && <><rect x="26" y="10" width="12" height="28" fill={secondary}/><rect x="13" y="35" width="38" height="18" rx="5" fill={primary}/><circle cx="32" cy="13" r="6" fill={primary}/></>}
    {variant === 2 && <><rect x="12" y="10" width="40" height="44" rx="4" fill={primary}/><rect x="18" y="16" width="28" height="18" fill="#153d5a"/><rect x="20" y="40" width="10" height="4" fill={secondary}/><circle cx="40" cy="42" r="3" fill={secondary}/></>}
    {variant === 3 && <><rect x="14" y="18" width="36" height="8" fill={primary}/><rect x="8" y="26" width="48" height="16" fill={primary}/><rect x="14" y="42" width="12" height="8" fill={primary}/><rect x="38" y="42" width="12" height="8" fill={primary}/><rect x="20" y="30" width="6" height="6" fill={secondary}/><rect x="38" y="30" width="6" height="6" fill={secondary}/></>}
    {variant === 4 && <><rect x="14" y="9" width="36" height="46" rx="3" fill={primary}/><rect x="20" y="14" width="24" height="14" fill={secondary}/><rect x="23" y="39" width="18" height="10" fill="#071d2f"/></>}
  </g>;

  if (category === 'weird') return <g>
    {variant === 0 && <><ellipse cx="32" cy="32" rx="24" ry="17" fill={primary}/><circle cx="32" cy="32" r="10" fill={secondary}/><circle cx="32" cy="32" r="5" fill="#071d2f"/></>}
    {variant === 1 && <><path d="M20 7Q39 12 44 28L39 56Q27 61 20 49L17 24Z" fill={primary}/><path d="M23 16h13M22 24h14" stroke={secondary} strokeWidth="3"/></>}
    {variant === 2 && <><path d="M14 39Q8 29 20 24Q19 12 32 15Q42 8 47 21Q59 23 53 36Q56 48 42 49H20Q10 48 14 39Z" fill={primary}/>{face(34)}</>}
    {variant === 3 && <><path d="M17 13Q47 14 48 30Q46 50 32 55Q18 50 16 30Z" fill={primary}/><path d="M20 24Q32 17 44 24" stroke={secondary} strokeWidth="5"/>{face(33)}</>}
    {variant === 4 && <><path d="M32 7 54 53H10Z" fill={primary}/><circle cx="32" cy="36" r="9" fill={secondary}/>{face(35)}</>}
  </g>;

  return <g>
    {variant === 0 && <><path d="M32 7 55 32 32 57 9 32Z" fill={primary}/><path d="M32 16 46 32 32 48 18 32Z" fill={secondary}/></>}
    {variant === 1 && <><circle cx="32" cy="32" r="24" fill={primary}/><circle cx="32" cy="32" r="14" fill={secondary}/><circle cx="38" cy="25" r="5" fill="#fff" opacity=".55"/></>}
    {variant === 2 && <><path d="M32 5 37 23 55 18 42 32 55 45 37 41 32 59 27 41 9 46 22 32 9 18 27 23Z" fill={primary}/><circle cx="32" cy="32" r="7" fill={secondary}/></>}
    {variant === 3 && <><path d="M8 38Q17 20 28 38Q39 56 56 31" fill="none" stroke={primary} strokeWidth="10" strokeLinecap="round"/><path d="M10 37Q18 27 26 39" fill="none" stroke={secondary} strokeWidth="3" strokeLinecap="round"/></>}
    {variant === 4 && <><circle cx="32" cy="32" r="24" fill="#0c1728"/><circle cx="32" cy="32" r="15" fill={primary}/><circle cx="32" cy="32" r="7" fill="#071018"/></>}
  </g>;
}

export function PlayerAvatar({ avatarId, fallback, frameStyle = 'clean', accent = '#ffd166', className = '', title }: { avatarId?: string | null; fallback?: string; frameStyle?: PlayerFrameStyle; accent?: string; className?: string; title?: string }) {
  const known = avatarId ? getAvatarOption(avatarId) : null;
  if (!avatarId || !known || known.id !== avatarId) {
    return <span className={`player-avatar-art legacy-avatar ${className}`} data-frame={frameStyle} style={{ '--avatar-accent': accent } as CSSProperties} title={title}>{fallback ?? '⭐'}</span>;
  }
  return <span className={`player-avatar-art ${className}`} data-avatar-id={known.id} data-frame={frameStyle} style={{ '--avatar-accent': accent } as CSSProperties} title={title ?? known.label}>
    <svg viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-label={title}>
      {avatarArt(known.id)}
    </svg>
  </span>;
}
