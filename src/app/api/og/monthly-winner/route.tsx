import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

function loadFont(weight: 600 | 700 | 800): Buffer {
  return fs.readFileSync(
    path.join(process.cwd(), `public/fonts/baloo2/baloo2-${weight}.ttf`)
  );
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const { searchParams, origin } = req.nextUrl;
    const firstName = searchParams.get("firstName") ?? "Öğrenci";
    const score     = searchParams.get("score")     ?? "0";
    const month     = searchParams.get("month")     ?? "Bu Ay";

    const bgUrl = `${origin}/assets/illustrations/monthly-winner/winner-01.jpg`;

    const semiBold  = loadFont(600);
    const bold      = loadFont(700);
    const extraBold = loadFont(800);

    const DARK  = "#09172A"; // base-primary-950
    const WHITE = "#FFFFFF";

    return new ImageResponse(
      (
        <div style={{ position: "relative", width: 1200, height: 1200, display: "flex" }}>
          {/* Arkaplan görseli */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bgUrl}
            width={1200}
            height={1200}
            style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 1200 }}
            alt=""
          />

          {/* Cam kart üzerine metin — sağda ortalı */}
          <div
            style={{
              position: "absolute",
              left: 510,
              top: 280,
              width: 585,
              height: 595,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "flex-start",
              padding: "0 44px",
            }}
          >
            {/* Başlık — Bold 42px */}
            <span style={{ fontFamily: "Baloo2", fontWeight: 700, fontSize: 42, color: DARK, lineHeight: 1.2, marginBottom: 10 }}>
              Tebrikler {firstName},
            </span>

            {/* Puan satırı — karışık ağırlık */}
            <div style={{ display: "flex", flexWrap: "wrap", fontSize: 32, lineHeight: 1.35, color: DARK }}>
              <span style={{ fontFamily: "Baloo2", fontWeight: 600 }}>{month} ayında&nbsp;</span>
              <span style={{ fontFamily: "Baloo2", fontWeight: 800 }}>{score} puan</span>
              <span style={{ fontFamily: "Baloo2", fontWeight: 600 }}>&nbsp;ile</span>
            </div>

            <span style={{ fontFamily: "Baloo2", fontWeight: 600, fontSize: 32, color: DARK, lineHeight: 1.35, marginBottom: 6 }}>
              ay birincisi oldun.
            </span>

            {/* Harika bir performans — ExtraBold */}
            <span style={{ fontFamily: "Baloo2", fontWeight: 800, fontSize: 32, color: DARK, lineHeight: 1.35, marginBottom: 6 }}>
              Harika bir performans...
            </span>

            <span style={{ fontFamily: "Baloo2", fontWeight: 600, fontSize: 32, color: DARK, lineHeight: 1.35 }}>
              Bu başarı seni beklenenden
            </span>
            <span style={{ fontFamily: "Baloo2", fontWeight: 600, fontSize: 32, color: DARK, lineHeight: 1.35 }}>
              daha ileri götürecek.
            </span>
            <span style={{ fontFamily: "Baloo2", fontWeight: 600, fontSize: 32, color: DARK, lineHeight: 1.35, marginBottom: 24 }}>
              Aynen devam :)
            </span>

            {/* Logo */}
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ fontFamily: "Baloo2", fontWeight: 700, fontSize: 30, color: DARK }}>tasarım</span>
              <span style={{ fontFamily: "Baloo2", fontWeight: 700, fontSize: 30, color: WHITE }}>atölyesi</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 1200,
        fonts: [
          { name: "Baloo2", data: semiBold,  weight: 600, style: "normal" },
          { name: "Baloo2", data: bold,      weight: 700, style: "normal" },
          { name: "Baloo2", data: extraBold, weight: 800, style: "normal" },
        ],
      }
    );
  } catch (err) {
    console.error("[og/monthly-winner]", err);
    return new Response(`OG image hatası: ${String(err)}`, { status: 500 });
  }
}
