// Indicative floor plan generated from the configuration (not an architectural drawing).
export function FloorPlan({ bhk, bathrooms, balconies, carpetArea }: { bhk: number; bathrooms: number; balconies: number; carpetArea: number }) {
  if (bhk === 0) return null;
  const W = 400;
  const H = 260;
  const pad = 12;
  // Scale: carpet area (sq.ft) → feet per pixel so labels show plausible sizes.
  const ftPerPx = Math.sqrt(carpetArea / ((W - pad * 2) * (H - pad * 2)));
  const dims = (w: number, h: number) => `${Math.round(w * ftPerPx)}′ × ${Math.round(h * ftPerPx)}′`;

  const top: { label: string; weight: number }[] = [];
  for (let i = 0; i < bhk; i++) {
    top.push({ label: i === 0 ? "Master bed" : `Bedroom ${i + 1}`, weight: i === 0 ? 1.3 : 1 });
    if (i < bathrooms - 1) top.push({ label: "Bath", weight: 0.45 });
  }
  const bottom = [
    { label: "Living & dining", weight: 2.2 },
    { label: "Kitchen", weight: 0.9 },
    { label: "Bath", weight: 0.45 },
    ...(balconies > 0 ? [{ label: "Balcony", weight: 0.55 }] : []),
  ];
  const row = (items: { label: string; weight: number }[], y: number, h: number) => {
    const total = items.reduce((s, r) => s + r.weight, 0);
    let x = pad;
    return items.map((it, i) => {
      const w = ((W - pad * 2) * it.weight) / total;
      const el = (
        <g key={`${y}-${i}`}>
          <rect x={x} y={y} width={w} height={h} className={`fp-room ${it.label === "Balcony" ? "fp-balcony" : ""}`} />
          <text x={x + w / 2} y={y + h / 2 - 3} textAnchor="middle" className="fp-label">
            {w > 46 ? it.label : it.label.slice(0, 4)}
          </text>
          {w > 60 && (
            <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" className="fp-dim">
              {dims(w, h)}
            </text>
          )}
        </g>
      );
      x += w;
      return el;
    });
  };
  const topH = (H - pad * 2) * 0.48;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="floorplan" role="img" aria-label={`Indicative ${bhk} BHK floor plan`}>
      <rect x={pad} y={pad} width={W - pad * 2} height={H - pad * 2} className="fp-outline" />
      {row(top, pad, topH)}
      {row(bottom, pad + topH, H - pad * 2 - topH)}
    </svg>
  );
}
