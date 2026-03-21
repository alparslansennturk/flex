import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/app/services/emailService";

export async function POST(req: NextRequest) {
  try {
    const { email, name, tempPass } = await req.json();

    if (!email || !name || !tempPass) {
      return NextResponse.json(
        { error: "email, name ve tempPass zorunludur." },
        { status: 400 }
      );
    }

    const result = await sendWelcomeEmail(email, name, tempPass);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error("[welcome/route] Beklenmeyen hata:", err);
    return NextResponse.json({ error: "Sunucu hatası oluştu." }, { status: 500 });
  }
}
