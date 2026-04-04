import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const bold = fs.readFileSync(
      path.join(process.cwd(), "public/fonts/baloo2/baloo2-700.ttf")
    );
    const fontData = bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength);

    return new ImageResponse(
      (
        <div style={{ width: 400, height: 200, background: "#10294C", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "Baloo2", fontWeight: 700, fontSize: 32, color: "white" }}>
            Tebrikler Ayşe!
          </span>
        </div>
      ),
      {
        width: 400,
        height: 200,
        fonts: [{ name: "Baloo2", data: fontData, weight: 700, style: "normal" }],
      }
    );
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
}
