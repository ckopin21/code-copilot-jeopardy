// Original investment-show set, drawn in a 1920x1080 space: raised shark platform with three chairs on the left,
// warm wood floor, blue and amber lighting, a scenic back wall, and an open presentation area on the right.
import { memo } from 'react';

export const CHAIR_SPOTS = [
  { x: 300, y: 790, scale: 1.08 },
  { x: 600, y: 720, scale: 0.98 },
  { x: 885, y: 660, scale: 0.9 }
] as const;
export const PRESENTER_SPOT = { x: 1500, y: 800, scale: 1.12 } as const;

function Slats({ x, width, y, height, count }: { x: number; width: number; y: number; height: number; count: number }) {
  const gap = width / count;
  return <g>
    {Array.from({ length: count }, (_, index) => (
      <rect key={index} x={x + index * gap + gap * 0.12} y={y} width={gap * 0.76} height={height} rx={3} fill="url(#dod-slat)"/>
    ))}
  </g>;
}

function Chair({ x, y, scale }: { x: number; y: number; scale: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cx={0} cy={118} rx={120} ry={22} fill="#000" opacity={0.35}/>
    {/* base */}
    <rect x={-8} y={70} width={16} height={46} fill="#2a2a2a"/>
    <path d="M-70 118 L70 118" stroke="#333" strokeWidth={8} strokeLinecap="round"/>
    {/* shell */}
    <path d="M-105 -40 Q-112 60 -60 88 L60 88 Q112 60 105 -40 Q80 -70 0 -72 Q-80 -70 -105 -40 Z" fill="url(#dod-chair-shell)" stroke="#5a2410" strokeWidth={3}/>
    <path d="M-86 -28 Q-90 50 -48 70 L48 70 Q90 50 86 -28 Q64 -52 0 -54 Q-64 -52 -86 -28 Z" fill="url(#dod-chair-cushion)"/>
    <rect x={-112} y={20} width={34} height={60} rx={14} fill="url(#dod-chair-cushion)" stroke="#d9d2c6" strokeWidth={2}/>
    <rect x={78} y={20} width={34} height={60} rx={14} fill="url(#dod-chair-cushion)" stroke="#d9d2c6" strokeWidth={2}/>
  </g>;
}

function Table({ x, y, scale }: { x: number; y: number; scale: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path d="M-80 0 L80 0 L96 18 L-96 18 Z" fill="url(#dod-marble)" stroke="#9aa3ad" strokeWidth={1.5}/>
    <rect x={-92} y={18} width={4} height={62} fill="#8d949c"/>
    <rect x={88} y={18} width={4} height={62} fill="#8d949c"/>
    <rect x={-30} y={4} width={40} height={6} rx={2} fill="#1d1d1d" opacity={0.8}/>
    <circle cx={50} cy={6} r={7} fill="#cfe7ff" opacity={0.7}/>
  </g>;
}

export const StudioSet = memo(function StudioSet({ focus }: { focus?: 'sharks' | 'presenter' | 'board' | null }) {
  return <svg className="dod-set" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="dod-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#060b1c"/><stop offset="0.55" stopColor="#101a3a"/><stop offset="1" stopColor="#1b1522"/>
      </linearGradient>
      <linearGradient id="dod-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0a1b4d"/><stop offset="1" stopColor="#1f4aa8"/>
      </linearGradient>
      <linearGradient id="dod-slat" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#5a2a10"/><stop offset="0.5" stopColor="#c46a26"/><stop offset="1" stopColor="#5a2a10"/>
      </linearGradient>
      <linearGradient id="dod-floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2a130a"/><stop offset="0.35" stopColor="#5b2c14"/><stop offset="1" stopColor="#7c4020"/>
      </linearGradient>
      <linearGradient id="dod-riser" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6b3a1c"/><stop offset="1" stopColor="#3b1d0d"/>
      </linearGradient>
      <linearGradient id="dod-chair-shell" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#b8522a"/><stop offset="1" stopColor="#6d2a12"/>
      </linearGradient>
      <linearGradient id="dod-chair-cushion" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fbf8f2"/><stop offset="1" stopColor="#d7cfc2"/>
      </linearGradient>
      <linearGradient id="dod-marble" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#e8ecef"/><stop offset="0.5" stopColor="#c3cad1"/><stop offset="1" stopColor="#eef1f3"/>
      </linearGradient>
      <linearGradient id="dod-backdrop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d9c4a6"/><stop offset="1" stopColor="#b69a78"/>
      </linearGradient>
      <radialGradient id="dod-blue-light" cx="0.5" cy="0" r="0.8">
        <stop offset="0" stopColor="#4aa3ff" stopOpacity="0.55"/><stop offset="1" stopColor="#4aa3ff" stopOpacity="0"/>
      </radialGradient>
      <radialGradient id="dod-amber-light" cx="0.5" cy="0" r="0.8">
        <stop offset="0" stopColor="#ffb347" stopOpacity="0.5"/><stop offset="1" stopColor="#ffb347" stopOpacity="0"/>
      </radialGradient>
      <radialGradient id="dod-spot" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#fff3d6" stopOpacity="0.45"/><stop offset="1" stopColor="#fff3d6" stopOpacity="0"/>
      </radialGradient>
      <pattern id="dod-brick" width="60" height="30" patternUnits="userSpaceOnUse">
        <rect width="60" height="30" fill="url(#dod-backdrop)"/>
        <path d="M0 15 H60 M30 0 V15 M0 15 V30 M60 15 V30" stroke="#8e7556" strokeWidth="1.5" opacity="0.55"/>
      </pattern>
      <pattern id="dod-planks" width="160" height="40" patternUnits="userSpaceOnUse" patternTransform="skewX(-35)">
        <rect width="160" height="40" fill="none"/>
        <path d="M0 40 H160 M80 0 V40" stroke="#2a1208" strokeWidth="2" opacity="0.35"/>
      </pattern>
    </defs>

    {/* back wall */}
    <rect width="1920" height="1080" fill="url(#dod-wall)"/>
    <rect x="0" y="60" width="1920" height="360" fill="url(#dod-sky)" opacity="0.65"/>
    {/* city skyline behind glass */}
    <g opacity="0.8">
      {Array.from({ length: 34 }, (_, index) => {
        const width = 40 + ((index * 37) % 50);
        const height = 90 + ((index * 53) % 190);
        const x = index * 58 - 20;
        return <g key={index}>
          <rect x={x} y={420 - height} width={width} height={height} fill="#0a1433"/>
          {Array.from({ length: Math.floor(height / 26) }, (_, row) => (
            <rect key={row} x={x + 8 + (row % 2) * 10} y={420 - height + 10 + row * 26} width={width - 24} height={4} fill={(index + row) % 3 ? '#ffd27a' : '#8fc6ff'} opacity={0.55}/>
          ))}
        </g>;
      })}
    </g>
    {/* ceiling lights */}
    {Array.from({ length: 12 }, (_, index) => <circle key={index} cx={620 + index * 90} cy={52} r={6} fill="#fff6d8" opacity={0.9}/>)}
    {/* wood slat walls */}
    <Slats x={0} width={560} y={250} height={330} count={12}/>
    <Slats x={1180} width={740} y={200} height={420} count={16}/>
    <rect x="0" y="575" width="1920" height="10" fill="#ff9a3c" opacity="0.55"/>
    {/* stone pillars */}
    <rect x="560" y="0" width="70" height="600" fill="#6d5b4b"/>
    <rect x="1110" y="0" width="70" height="620" fill="#6d5b4b"/>
    <rect x="560" y="0" width="70" height="600" fill="url(#dod-amber-light)"/>
    <rect x="1110" y="0" width="70" height="620" fill="url(#dod-amber-light)"/>

    {/* floor */}
    <path d="M0 580 H1920 V1080 H0 Z" fill="url(#dod-floor)"/>
    <path d="M0 580 H1920 V1080 H0 Z" fill="url(#dod-planks)"/>
    {/* colored light pools */}
    <ellipse cx="420" cy="300" rx="560" ry="420" fill="url(#dod-blue-light)"/>
    <ellipse cx="1500" cy="260" rx="520" ry="460" fill="url(#dod-amber-light)"/>

    {/* raised shark platform with a curved LED edge */}
    <path d="M0 610 Q560 560 1120 610 Q1060 760 900 1080 L0 1080 Z" fill="url(#dod-riser)"/>
    <path d="M0 610 Q560 560 1120 610 Q1060 760 900 1080" fill="none" stroke="#ffb45c" strokeWidth="6" opacity="0.85"/>
    <path d="M0 610 Q560 560 1120 610" fill="none" stroke="#ffe0a8" strokeWidth="2" opacity="0.9"/>

    {/* presentation area: rug and neutral backdrop */}
    <path d="M1190 780 L1830 780 L1920 1000 L1110 1000 Z" fill="#7f7466" opacity="0.8"/>
    <path d="M1210 790 L1810 790 L1890 985 L1135 985 Z" fill="none" stroke="#b9ab98" strokeWidth="4" opacity="0.6"/>
    <rect x="1290" y="330" width="420" height="440" fill="url(#dod-brick)" stroke="#5a4632" strokeWidth="4"/>
    <ellipse cx={PRESENTER_SPOT.x} cy={900} rx={260} ry={60} fill="url(#dod-spot)" className={focus === 'presenter' ? 'dod-set-glow' : undefined}/>

    {/* shark furniture */}
    {CHAIR_SPOTS.map((spot, index) => <g key={index}>
      <ellipse cx={spot.x} cy={spot.y + 120} rx={180} ry={40} fill="url(#dod-spot)" className={focus === 'sharks' ? 'dod-set-glow' : undefined}/>
      <Chair {...spot}/>
    </g>)}
    {CHAIR_SPOTS.map((spot, index) => <Table key={`t${index}`} x={spot.x + 170 * spot.scale} y={spot.y + 110 * spot.scale} scale={spot.scale * 0.9}/>)}

    {/* soft vignette */}
    <rect width="1920" height="1080" fill="url(#dod-wall)" opacity="0.12"/>
  </svg>;
});
