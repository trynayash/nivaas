import type { SVGProps } from "react";

const P: Record<string, React.ReactNode> = {
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  shield: (<><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></>),
  spark: (<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></>),
  home: (<><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /><path d="M10 20v-5h4v5" /></>),
  map: (<><path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2.3" /></>),
  key: (<><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l2 2M15 8l2 2" /></>),
  chart: (<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
  chat: (<><path d="M4 5h16v11H9l-5 4z" /></>),
  leaf: (<><path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15" /><path d="M5 19 13 11" /></>),
  star: (<><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></>),
  bed: (<><path d="M3 18V7M3 14h18v4M21 18v-6a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="11" r="1.6" /></>),
  bath: (<><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2" /></>),
  area: (<><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M4 9h3M4 14h3M9 4v3M14 4v3" /></>),
  compass: (<><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>),
  building: (<><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></>),
  car: (<><path d="M5 16V12l2-5h10l2 5v4M3 16h18v3H3z" /><circle cx="7.5" cy="16" r=".5" /><circle cx="16.5" cy="16" r=".5" /></>),
  calendar: (<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>),
  check: (<><path d="m5 12 4.5 4.5L19 7" /></>),
  sofa: (<><path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3zM6 18v2M18 18v2" /></>),
  layers: (<><path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5" /></>),
  pin: (<><path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11z" /></>),
  arrow: (<><path d="M5 12h14M13 6l6 6-6 6" /></>),
  back: (<><path d="M19 12H5M11 6l-6 6 6 6" /></>),
  filter: (<><path d="M4 5h16M7 12h10M10 19h4" /></>),
  x: (<><path d="M6 6l12 12M18 6 6 18" /></>),
  rupee: (<><path d="M7 5h10M7 9h10M7 5c5 0 6 8 0 8h-1l7 7" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>),
  external: (<><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>),
};

export function Icon({ name, size = 18, ...rest }: { name: string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {P[name] ?? P.home}
    </svg>
  );
}
