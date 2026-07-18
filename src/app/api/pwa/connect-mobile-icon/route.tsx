import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * Flex Connect Mobil PWA ikonu — GEÇİCİ (kullanıcı: "masaüstü ikonu geçici
 * yaparız şimdilik", 2026-07-18). Final marka ikonu gelince bu route (ya da
 * statik dosyaya çevrilmiş hali) değiştirilir, manifest.json'daki referans aynı
 * kalır. `?size=192|512` — manifest'in istediği 2 boyut.
 */
export async function GET(req: NextRequest) {
  const size = Number(req.nextUrl.searchParams.get("size") ?? "512") || 512;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "#2867bd", borderRadius: size * 0.22,
        }}
      >
        <span style={{ color: "#fff", fontSize: size * 0.42, fontWeight: 800, fontFamily: "sans-serif", letterSpacing: -2 }}>FC</span>
      </div>
    ),
    { width: size, height: size },
  );
}
