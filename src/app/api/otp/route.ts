import { NextRequest, NextResponse } from "next/server";
import { sendOTPEmail } from "@/app/services/emailService";
import { isRateLimited } from "@/app/lib/rate-limit";

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// TODO: İleride 2FA akışı kurulursa buraya Firestore yazma + PATCH doğrulama geri eklenecek.

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(`otp:${ip}`, 5, 10 * 60 * 1000))
    return NextResponse.json({ error: "Çok fazla OTP isteği. 10 dakika bekleyin." }, { status: 429 });

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
