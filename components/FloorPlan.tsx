type Room = { label: string; weight: number };

// Indicative floor plan generated from the configuration (not an architectural drawing).
// Two layouts are rendered and CSS shows the one that fits the figure's width: a wide plan
// (bedrooms along the top) and a tall one (rooms stacked) so labels stay legible on phones.
export function FloorPlan({ bhk, bathrooms, balconies, carpetArea }: { bhk: number; bathrooms: number; balconies: number; carpetArea: number }) {
  if (bhk === 0) return null;
  const pad = 12;
  const aria = `Indicative ${bhk} BHK floor plan`;

  const bedrooms: Room[] = [];
  for (let i = 0; i < bhk; i++) {
    bedrooms.push({ label: i === 0 ? "Master bed" : `Bedroom ${i + 1}`, weight: i === 0 ? 1.3 : 1 });
    if (i < bathrooms - 1) bedrooms.push({ label: "Bath", weight: 0.45 });
  }
  const living: Room[] = [
    { label: "Living & dining", weight: 2.2 },
    { label: "Kitchen", weight: 0.9 },
    { label: "Bath", weight: 0.45 },
    ...(balconies > 0 ? [{ label: "Balcony", weight: 0.55 }] : []),
  ];

  // rows: each is a list of rooms sharing the full width, with its own height (in drawing units)
  function drawing(W: number, rows: { rooms: Room[]; h: number }[], extraClass: string) {
    const H = rows.reduce((s, r) => s + r.h, 0) + pad * 2;
    // Feet per drawing unit, so the dimensions shown add up to roughly the carpet area.
    const ftPerPx = Math.sqrt(carpetArea / ((W - pad * 2) * (H - pad * 2)));
    let y = pad;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={`floorplan ${extraClass}`} role="img" aria-label={aria}>
        <rect x={pad} y={pad} width={W - pad * 2} height={H - pad * 2} className="fp-outline" />
        {rows.map((row, ri) => {
          const total = row.rooms.reduce((s, r) => s + r.weight, 0);
          let x = pad;
          const rowY = y;
          y += row.h;
          return row.rooms.map((it, i) => {
            const w = ((W - pad * 2) * it.weight) / total;
            const cx = x + w / 2;
            const el = (
              <g key={`${ri}-${i}`}>
                <rect x={x} y={rowY} width={w} height={row.h} className={`fp-room ${it.label === "Balcony" ? "fp-balcony" : ""}`} />
                <text x={cx} y={rowY + row.h / 2 - 2} textAnchor="middle" className="fp-label">
                  {w > 52 ? it.label : it.label.slice(0, 4)}
                </text>
                {w > 66 && (
                  <text x={cx} y={rowY + row.h / 2 + 14} textAnchor="middle" className="fp-dim">
                    {`${Math.round(w * ftPerPx)}′ × ${Math.round(row.h * ftPerPx)}′`}
                  </text>
                )}
              </g>
            );
            x += w;
            return el;
          });
        })}
      </svg>
    );
  }

  // Wide: all bedrooms and bathrooms in one row on top, living areas below.
  const wide = drawing(
    440,
    [
      { rooms: bedrooms, h: 112 },
      { rooms: living, h: 120 },
    ],
    "fp-wide"
  );

  // Tall: each bedroom (with its bath) on its own row, then living, then kitchen and services.
  const tallRows: { rooms: Room[]; h: number }[] = [];
  for (let i = 0; i < bedrooms.length; ) {
    const room = bedrooms[i];
    const next = bedrooms[i + 1];
    if (next && next.label === "Bath") {
      tallRows.push({ rooms: [room, next], h: 84 });
      i += 2;
    } else {
      tallRows.push({ rooms: [room], h: 84 });
      i += 1;
    }
  }
  tallRows.push({ rooms: [living[0]], h: 96 });
  tallRows.push({ rooms: living.slice(1), h: 72 });
  const tall = drawing(300, tallRows, "fp-tall");

  return (
    <>
      {wide}
      {tall}
    </>
  );
}
