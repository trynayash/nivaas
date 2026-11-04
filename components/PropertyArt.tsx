// Deterministic flat illustration used when a listing has no photos.
import type { PropertyType } from "@/lib/types";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    h ^= h >>> 15;
    return ((h >>> 0) % 10000) / 10000;
  };
}

export function PropertyArt({
  id,
  type,
  hue,
  images,
  className,
  label,
}: {
  id: string;
  type: PropertyType;
  hue: number;
  images?: string[];
  className?: string;
  label?: string;
}) {
  if (images && images.length) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={images[0]} alt={label ?? ""} className={className} style={{ objectFit: "cover", width: "100%", height: "100%" }} />;
  }
  const r = hash(id);
  const sky1 = `hsl(${hue} 42% 86%)`;
  const sky2 = `hsl(${(hue + 25) % 360} 55% 95%)`;
  const far = `hsl(${hue} 18% 74%)`;
  const ground = `hsl(${88 + (hue % 28)} 24% 60%)`;
  const wall = `hsl(36 30% 94%)`;
  const wall2 = `hsl(${hue} 16% 84%)`;
  const accent = `hsl(${hue} 38% 34%)`;
  const glass = `hsl(${(hue + 190) % 360} 30% 38%)`;
  const lit = `hsl(42 85% 72%)`;
  const sunX = 60 + r() * 280;
  const gid = `g-${id}`;

  const windows = (x: number, y: number, w: number, h: number, cols: number, rows: number) => {
    const out: React.ReactNode[] = [];
    const gw = w / cols;
    const gh = h / rows;
    for (let c = 0; c < cols; c++)
      for (let rr = 0; rr < rows; rr++)
        out.push(
          <rect
            key={`${x}-${c}-${rr}`}
            x={x + c * gw + gw * 0.18}
            y={y + rr * gh + gh * 0.2}
            width={gw * 0.64}
            height={gh * 0.55}
            rx={1}
            fill={r() < 0.22 ? lit : glass}
            opacity={0.9}
          />
        );
    return out;
  };

  const tree = (x: number, s = 1) => (
    <g key={`t${x}`}>
      <rect x={x - 2 * s} y={196 - 18 * s} width={4 * s} height={20 * s} fill="hsl(25 30% 35%)" />
      <circle cx={x} cy={196 - 26 * s} r={15 * s} fill={`hsl(${120 + r() * 30} 28% ${38 + r() * 10}%)`} />
    </g>
  );

  let building: React.ReactNode;
  if (type === "Apartment" || type === "Penthouse") {
    const towers = r() < 0.5 ? 1 : 2;
    building = (
      <g>
        {towers === 2 && (
          <g>
            <rect x={235} y={70} width={78} height={130} fill={wall2} />
            {windows(239, 78, 70, 116, 3, 7)}
          </g>
        )}
        <rect x={130} y={42} width={110} height={158} fill={wall} />
        <rect x={130} y={42} width={10} height={158} fill={accent} opacity={0.85} />
        {windows(144, 52, 92, 140, 4, 8)}
        {type === "Penthouse" && <rect x={150} y={22} width={78} height={20} fill={glass} opacity={0.85} />}
        <rect x={122} y={38} width={126} height={6} fill={accent} />
      </g>
    );
  } else if (type === "Plot") {
    building = (
      <g>
        <polygon points="70,205 330,205 300,175 100,175" fill={`hsl(${(hue + 60) % 360} 30% 70%)`} />
        {Array.from({ length: 9 }).map((_, i) => (
          <rect key={i} x={100 + i * 25} y={164} width={3} height={14} fill="hsl(25 25% 40%)" />
        ))}
        <rect x={100} y={168} width={203} height={2} fill="hsl(25 25% 40%)" />
        <rect x={196} y={128} width={4} height={50} fill="hsl(25 25% 35%)" />
        <rect x={176} y={128} width={44} height={22} rx={2} fill={wall} stroke={accent} strokeWidth={2} />
        <text x={198} y={143} fontSize={11} fontFamily="sans-serif" fontWeight={700} textAnchor="middle" fill={accent}>
          PLOT
        </text>
      </g>
    );
  } else {
    // Villa / Independent House / Row House
    const units = type === "Row House" ? 3 : 1;
    const w = type === "Row House" ? 70 : 150;
    const x0 = type === "Row House" ? 95 : 125;
    building = (
      <g>
        {Array.from({ length: units }).map((_, i) => {
          const x = x0 + i * (w + 4);
          const modern = type === "Villa" && r() < 0.6;
          return (
            <g key={i}>
              <rect x={x} y={120} width={w} height={80} fill={wall} />
              {modern ? (
                <>
                  <rect x={x + w * 0.35} y={88} width={w * 0.65} height={34} fill={wall2} />
                  <rect x={x - 6} y={116} width={w + 12} height={6} fill={accent} />
                  <rect x={x + w * 0.32} y={84} width={w * 0.71} height={5} fill={accent} />
                  <rect x={x + w * 0.45} y={94} width={w * 0.45} height={20} fill={glass} />
                </>
              ) : (
                <polygon points={`${x - 8},122 ${x + w / 2},${82} ${x + w + 8},122`} fill={accent} />
              )}
              <rect x={x + w * 0.12} y={140} width={w * 0.28} height={26} fill={glass} />
              <rect x={x + w * 0.6} y={150} width={w * 0.22} height={50} fill={`hsl(${hue} 30% 28%)`} />
            </g>
          );
        })}
        {type === "Villa" && <rect x={110} y={198} width={180} height={8} rx={4} fill={`hsl(195 60% 62%)`} opacity={0.9} />}
      </g>
    );
  }

  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={label ?? `${type} illustration`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky1} />
          <stop offset="1" stopColor={sky2} />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill={`url(#${gid})`} />
      <circle cx={sunX} cy={58} r={22} fill="hsl(32 90% 78%)" opacity={0.9} />
      <path d={`M0 190 Q 80 ${140 + r() * 30} 160 180 T 320 170 T 400 160 V260 H0Z`} fill={far} opacity={0.7} />
      <rect y={196} width={400} height={64} fill={ground} />
      {building}
      {tree(70 + r() * 30, 1)}
      {tree(330 + r() * 30, 0.8)}
    </svg>
  );
}
