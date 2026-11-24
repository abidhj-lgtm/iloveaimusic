import { ImageResponse } from "next/og";
import { PALETTES } from "@/lib/covers";

export const runtime = "edge";
export const revalidate = 86400;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") || "I Love AI Music").slice(0, 90);
  const subtitle = (searchParams.get("subtitle") || "Where AI music finds its listeners.").slice(0, 60);
  const kind = searchParams.get("kind") || "track";
  const pIndex = Number(searchParams.get("palette") ?? 0);
  const p = PALETTES[((pIndex % PALETTES.length) + PALETTES.length) % PALETTES.length] ?? PALETTES[0];
  const bars = Array.from({ length: 44 }, (_, i) => 24 + ((i * 53) % 150));

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: 64, position: "relative",
        background: `linear-gradient(135deg, ${p.dark} 0%, ${p.a} 62%, ${p.b} 100%)`,
        color: "#fff", fontFamily: "sans-serif"
      }}>
        <div style={{ position: "absolute", top: -160, right: -120, width: 520, height: 520, borderRadius: 9999, background: p.c, opacity: 0.28, display: "flex" }} />
        <div style={{ position: "absolute", bottom: -200, left: -140, width: 460, height: 460, borderRadius: 9999, background: p.b, opacity: 0.4, display: "flex" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 46 }}>
            {[16, 30, 46, 26, 12].map((h, i) => (
              <div key={i} style={{ width: 9, height: h, borderRadius: 6, background: "#fff", opacity: 0.95, display: "flex" }} />
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 27, fontWeight: 800, letterSpacing: -0.5 }}>I Love AI Music</div>
          <div style={{ display: "flex", marginLeft: "auto", fontSize: 19, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", padding: "9px 20px", borderRadius: 9999, background: "rgba(0,0,0,0.34)", border: "2px solid rgba(255,255,255,0.45)" }}>{kind}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1000 }}>
          <div style={{ display: "flex", fontSize: title.length > 46 ? 60 : 78, fontWeight: 800, lineHeight: 1.06, letterSpacing: -2, textShadow: "0 6px 30px rgba(0,0,0,0.45)" }}>{title}</div>
          <div style={{ display: "flex", fontSize: 30, opacity: 0.92, fontWeight: 600 }}>{subtitle}</div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 170 }}>
            {bars.map((h, i) => (
              <div key={i} style={{ width: 9, height: h, borderRadius: 5, background: i % 3 === 0 ? p.c : "#ffffff", opacity: i % 3 === 0 ? 0.95 : 0.6, display: "flex" }} />
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 700, opacity: 0.85 }}>iloveaimusic.com</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}