import { hashString, mulberry32, initials } from "./utils";

export const PALETTES: { name: string; a: string; b: string; c: string; dark: string }[] = [
  { name: "Ultraviolet", a: "#7c3aed", b: "#ec4899", c: "#fbbf24", dark: "#140b26" },
  { name: "Ember",       a: "#f59e0b", b: "#f43f5e", c: "#fde68a", dark: "#1c0d10" },
  { name: "Lagoon",      a: "#22d3ee", b: "#6366f1", c: "#a5f3fc", dark: "#081226" },
  { name: "Acid",        a: "#a3e635", b: "#10b981", c: "#ecfccb", dark: "#0a1610" },
  { name: "Rosé",        a: "#fb7185", b: "#a855f7", c: "#fecdd3", dark: "#1a0b1e" },
  { name: "Midnight",    a: "#38bdf8", b: "#8b5cf6", c: "#f0abfc", dark: "#0b0f22" }
];

export function coverUrl(seed: string, palette: number): string {
  const p = PALETTES[((palette % PALETTES.length) + PALETTES.length) % PALETTES.length];
  const rng = mulberry32(hashString(seed));
  const variant = Math.floor(rng() * 3);
  const bars: string[] = [];
  for (let i = 0; i < 30; i++) {
    const h = 30 + Math.floor(rng() * 190);
    const x = 90 + i * 21;
    bars.push(`<rect x="${x}" y="${620 - h}" width="11" height="${h}" rx="5.5" fill="url(#bar)" opacity="${(0.55 + rng() * 0.45).toFixed(2)}"/>`);
  }
  const dots: string[] = [];
  for (let i = 0; i < 26; i++) {
    dots.push(`<circle cx="${Math.floor(rng() * 800)}" cy="${Math.floor(rng() * 420)}" r="${(1 + rng() * 2.4).toFixed(1)}" fill="${p.c}" opacity="${(0.2 + rng() * 0.5).toFixed(2)}"/>`);
  }
  const cx1 = 140 + Math.floor(rng() * 520), cy1 = 100 + Math.floor(rng() * 260);
  const cx2 = 100 + Math.floor(rng() * 600), cy2 = 180 + Math.floor(rng() * 300);
  const rings = variant === 1
    ? `<g fill="none" stroke="${p.c}" opacity="0.35">${[70, 110, 150, 190].map((r) => `<circle cx="${cx1}" cy="${cy1}" r="${r}" stroke-width="1.6" stroke-dasharray="${8 + r / 4} ${14 + r / 3}"/>`).join("")}</g>`
    : variant === 2
      ? `<g fill="none" stroke="${p.b}" opacity="0.5"><path d="M -40 ${300 + Math.floor(rng() * 120)} Q 400 ${80 + Math.floor(rng() * 200)} 840 ${340 + Math.floor(rng() * 120)}" stroke-width="2.4"/><path d="M -40 ${380 + Math.floor(rng() * 120)} Q 400 ${160 + Math.floor(rng() * 200)} 840 ${420 + Math.floor(rng() * 120)}" stroke-width="1.4" opacity="0.6"/></g>`
      : `<circle cx="${cx1}" cy="${cy1}" r="150" fill="none" stroke="${p.c}" stroke-width="2" opacity="0.4"/><circle cx="${cx1}" cy="${cy1}" r="96" fill="none" stroke="${p.c}" stroke-width="1.2" opacity="0.55" stroke-dasharray="6 10"/>`;
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.dark}"/><stop offset="0.55" stop-color="${p.a}" stop-opacity="0.55"/><stop offset="1" stop-color="${p.b}" stop-opacity="0.75"/></linearGradient>
<linearGradient id="bar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${p.b}"/><stop offset="1" stop-color="${p.c}"/></linearGradient>
<radialGradient id="g1" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${p.b}" stop-opacity="0.9"/><stop offset="1" stop-color="${p.b}" stop-opacity="0"/></radialGradient>
<radialGradient id="g2" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${p.c}" stop-opacity="0.7"/><stop offset="1" stop-color="${p.c}" stop-opacity="0"/></radialGradient>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.05 0"/></filter>
<filter id="soft"><feGaussianBlur stdDeviation="30"/></filter>
</defs>
<rect width="800" height="800" fill="url(#bg)"/>
<circle cx="${cx1}" cy="${cy1}" r="230" fill="url(#g1)" filter="url(#soft)"/>
<circle cx="${cx2}" cy="${cy2}" r="180" fill="url(#g2)" filter="url(#soft)"/>
<polygon points="0,800 260,0 420,0 160,800" fill="#ffffff" opacity="0.05"/>
${rings}
${dots.join("")}
${bars.join("")}
<rect width="800" height="800" filter="url(#grain)"/>
<rect x="14" y="14" width="772" height="772" rx="26" fill="none" stroke="${p.c}" stroke-opacity="0.22" stroke-width="2"/>
</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

export function avatarUrl(name: string, palette: number): string {
  const p = PALETTES[((palette % PALETTES.length) + PALETTES.length) % PALETTES.length];
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></linearGradient></defs>
<rect width="160" height="160" fill="url(#a)"/>
<circle cx="128" cy="30" r="46" fill="${p.c}" opacity="0.28"/>
<circle cx="24" cy="140" r="52" fill="${p.dark}" opacity="0.35"/>
<text x="80" y="98" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="62" font-weight="800" fill="#ffffff" opacity="0.95">${initials(name)}</text>
</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}