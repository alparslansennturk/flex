import { NextRequest, NextResponse } from "next/server";
import { sendOTPEmail } from "@/app/services/emailService";

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// TODO: İleride 2FA akışı kurulursa buraya Firestore yazma + PATCH doğrulama geri eklenecek.

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Geçerli bir e-posta adresi gerekli." },
        { status: 400 }
      );
    }

    const otp = generateOTP();
    const result = await sendOTPEmail(email, otp, name);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error("[otp/route] Beklenmeyen hata:", err);
    return NextResponse.json({ error: "Sunucu hatası oluştu." }, { status: 500 });
  }
}
