// Line-drawn elevation (or survey plan for plots) shown when a listing has no photos.
// Deliberately quiet: ink on paper, no sky, sun or colour, so it reads as a placeholder, not a photo.
import type { ReactNode } from "react";
import type { PropertyType } from "@/lib/types";

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    h ^= h >>> 15;
    return ((h >>> 0) % 10000) / 10000;
  };
}

const PAPER = ["#ebe7de", "#e7e5dd", "#ece6da"];
const INK = "#2b2d29";
const FACADE = "#f7f5ef";
const GLASS = "#cdc8bc";
const GROUND = 244;

export function PropertyArt({
  id,
  type,
  hue,
  images,
  className,
  label,
  plotArea,
}: {
  id: string;
  type: PropertyType;
  hue: number;
  images?: string[];
  className?: string;
  label?: string;
  plotArea?: number;
}) {
  if (images && images.length) {
    return <img src={images[0]} alt={label ?? ""} className={className} style={{ objectFit: "cover", width: "100%", height: "100%" }} />;
  }
  const r = rng(id);
  const paper = PAPER[hue % PAPER.length];
  const line = { stroke: INK, strokeWidth: 1.3, fill: "none", strokeLinecap: "square" as const };
  const face = { ...line, fill: FACADE };

  /**
   * Grid of windows inside a block, one row per floor. Drawn with an SVG <pattern> (one element)
   * instead of a rect per window, which keeps card-heavy pages small. A few panes are tinted.
   */
  const windows = (x: number, y: number, w: number, floors: number, floorH: number, cols: number) => {
    const gw = w / cols;
    const pid = `win-${id}-${x}`;
    const tinted: ReactNode[] = [];
    for (let k = 0; k < Math.round(floors * cols * 0.3); k++) {
      const f = Math.floor(r() * floors);
      const c = Math.floor(r() * cols);
      tinted.push(
        <rect key={k} x={x + c * gw + gw * 0.2} y={y + f * floorH + floorH * 0.28} width={gw * 0.6} height={floorH * 0.46} fill={GLASS} stroke={INK} strokeWidth={0.9} />
      );
    }
    return (
      <g key={pid}>
        <defs>
          <pattern id={pid} x={x} y={y} width={gw} height={floorH} patternUnits="userSpaceOnUse">
            <line x1={0} y1={0} x2={gw} y2={0} stroke={INK} strokeWidth={0.6} opacity={0.5} />
            <rect x={gw * 0.2} y={floorH * 0.28} width={gw * 0.6} height={floorH * 0.46} fill="none" stroke={INK} strokeWidth={0.9} />
          </pattern>
        </defs>
        <rect x={x} y={y} width={w} height={floors * floorH} fill={`url(#${pid})`} />
        {tinted}
      </g>
    );
  };

  const tree = (x: number, s = 1) => (
    <g key={`t${x}`} {...line} strokeWidth={1}>
      <line x1={x} y1={GROUND} x2={x} y2={GROUND - 30 * s} />
      <circle cx={x} cy={GROUND - 44 * s} r={17 * s} />
    </g>
  );

  let drawing: ReactNode;
  if (type === "Plot") {
    const area = plotArea ?? 2400;
    const wFt = Math.round(Math.sqrt(area * 1.5));
    const hFt = Math.round(area / wFt);
    const W = 210;
    const H = Math.round((W * hFt) / wFt);
    const x0 = 200 - W / 2;
    const y0 = 150 - H / 2;
    drawing = (
      <g>
        <polygon points={`${x0},${y0} ${x0 + W},${y0 + 6} ${x0 + W - 4},${y0 + H} ${x0 + 3},${y0 + H - 4}`} {...line} strokeDasharray="6 4" fill={FACADE} />
        {/* dimension lines */}
        <g {...line} strokeWidth={0.8}>
          <line x1={x0} y1={y0 - 16} x2={x0 + W} y2={y0 - 16} />
          <line x1={x0} y1={y0 - 21} x2={x0} y2={y0 - 11} />
          <line x1={x0 + W} y1={y0 - 21} x2={x0 + W} y2={y0 - 11} />
          <line x1={x0 - 16} y1={y0} x2={x0 - 16} y2={y0 + H} />
          <line x1={x0 - 21} y1={y0} x2={x0 - 11} y2={y0} />
          <line x1={x0 - 21} y1={y0 + H} x2={x0 - 11} y2={y0 + H} />
        </g>
        <text x={200} y={y0 - 22} textAnchor="middle" className="art-label">{wFt}′</text>
        <text x={x0 - 24} y={y0 + H / 2} textAnchor="end" dominantBaseline="middle" className="art-label">{hFt}′</text>
        <text x={200} y={y0 + H / 2} textAnchor="middle" dominantBaseline="middle" className="art-label">{area.toLocaleString("en-IN")} sq.ft</text>
        {/* road */}
        <line x1={40} y1={y0 + H + 26} x2={360} y2={y0 + H + 26} {...line} strokeWidth={0.8} />
        <text x={200} y={y0 + H + 42} textAnchor="middle" className="art-label">ROAD</text>
        {/* north arrow */}
        <g transform="translate(348 46)" {...line} strokeWidth={1}>
          <line x1={0} y1={14} x2={0} y2={-12} />
          <polyline points="-5,-5 0,-13 5,-5" />
        </g>
        <text x={348} y={74} textAnchor="middle" className="art-label">N</text>
      </g>
    );
  } else if (type === "Apartment" || type === "Penthouse") {
    const floors = 9 + Math.floor(r() * 3);
    const fh = 17;
    const top = GROUND - floors * fh;
    const second = r() < 0.55;
    drawing = (
      <g>
        {second && (
          <g>
            <rect x={252} y={GROUND - 6 * fh} width={70} height={6 * fh} {...face} />
            {windows(252, GROUND - 6 * fh, 70, 6, fh, 3)}
          </g>
        )}
        <rect x={120} y={top} width={132} height={floors * fh} {...face} />
        {type === "Penthouse" ? (
          <g>
            <rect x={120} y={top} width={132} height={fh} {...face} />
            <rect x={136} y={top - fh - 4} width={100} height={fh + 4} {...line} fill={GLASS} />
            {[0, 1, 2, 3, 4].map((i) => (
              <line key={i} x1={136 + i * 25} y1={top - fh - 4} x2={136 + i * 25} y2={top} stroke={INK} strokeWidth={0.8} />
            ))}
            <line x1={128} y1={top - fh - 5} x2={244} y2={top - fh - 5} stroke={INK} strokeWidth={2.2} />
          </g>
        ) : (
          <line x1={116} y1={top} x2={256} y2={top} stroke={INK} strokeWidth={2.2} />
        )}
        {windows(120, top, 132, floors, fh, 5)}
        {/* balcony rails on alternate floors */}
        {Array.from({ length: Math.floor(floors / 2) }).map((_, i) => (
          <line key={`b${i}`} x1={112} y1={top + (i * 2 + 1) * fh + fh * 0.8} x2={150} y2={top + (i * 2 + 1) * fh + fh * 0.8} stroke={INK} strokeWidth={1} />
        ))}
        <rect x={170} y={GROUND - 22} width={32} height={22} {...line} fill={GLASS} />
        <line x1={160} y1={GROUND - 24} x2={212} y2={GROUND - 24} stroke={INK} strokeWidth={2} />
        {tree(70, 0.9)}
      </g>
    );
  } else if (type === "Villa") {
    drawing = (
      <g>
        <rect x={84} y={186} width={196} height={58} {...face} />
        <rect x={150} y={136} width={176} height={50} {...face} />
        <line x1={78} y1={186} x2={286} y2={186} stroke={INK} strokeWidth={2.4} />
        <line x1={144} y1={136} x2={332} y2={136} stroke={INK} strokeWidth={2.4} />
        <rect x={96} y={198} width={96} height={46} {...line} fill={GLASS} />
        {[1, 2, 3].map((i) => (
          <line key={i} x1={96 + i * 24} y1={198} x2={96 + i * 24} y2={GROUND} stroke={INK} strokeWidth={0.8} />
        ))}
        <rect x={212} y={200} width={22} height={44} {...line} />
        <rect x={172} y={148} width={130} height={22} {...line} fill={GLASS} />
        <line x1={296} y1={244} x2={360} y2={244} stroke={INK} strokeWidth={1} />
        <rect x={292} y={232} width={64} height={8} {...line} strokeWidth={0.8} />
        {tree(52, 1.05)}
      </g>
    );
  } else if (type === "Row House") {
    drawing = (
      <g>
        {[0, 1, 2].map((i) => {
          const x = 84 + i * 78;
          return (
            <g key={i}>
              <rect x={x} y={168} width={78} height={76} {...face} />
              <polygon points={`${x - 4},170 ${x + 39},130 ${x + 82},170`} {...face} />
              <rect x={x + 12} y={206} width={18} height={38} {...line} />
              <rect x={x + 42} y={186} width={24} height={22} {...line} fill={i === 1 ? GLASS : "none"} />
              <line x1={x + 54} y1={186} x2={x + 54} y2={208} stroke={INK} strokeWidth={0.8} />
            </g>
          );
        })}
        {tree(56, 0.9)}
      </g>
    );
  } else {
    // Independent House
    drawing = (
      <g>
        <rect x={124} y={164} width={156} height={80} {...face} />
        <polygon points="112,166 202,108 292,166" {...face} />
        <rect x={188} y={200} width={26} height={44} {...line} />
        <rect x={140} y={184} width={32} height={28} {...line} fill={GLASS} />
        <line x1={156} y1={184} x2={156} y2={212} stroke={INK} strokeWidth={0.8} />
        <rect x={232} y={184} width={32} height={28} {...line} />
        <line x1={248} y1={184} x2={248} y2={212} stroke={INK} strokeWidth={0.8} />
        <rect x={190} y={136} width={24} height={18} {...line} />
        {/* compound wall with gate opening */}
        <polyline points={`40,${GROUND} 40,${GROUND - 16} 176,${GROUND - 16}`} {...line} strokeWidth={1} />
        <polyline points={`226,${GROUND - 16} 362,${GROUND - 16} 362,${GROUND}`} {...line} strokeWidth={1} />
        {tree(330, 0.85)}
      </g>
    );
  }

  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={label ?? `${type} — drawing, no photos yet`}>
      <rect width="400" height="300" fill={paper} />
      {type !== "Plot" && (
        <g>
          <line x1={0} y1={GROUND} x2={400} y2={GROUND} stroke={INK} strokeWidth={1.3} />
          {Array.from({ length: 26 }).map((_, i) => (
            <line key={i} x1={i * 16} y1={GROUND + 4} x2={i * 16 + 8} y2={GROUND + 12} stroke={INK} strokeWidth={0.6} opacity={0.45} />
          ))}
        </g>
      )}
      {drawing}
    </svg>
  );
}
