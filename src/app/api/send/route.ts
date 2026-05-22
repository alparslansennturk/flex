import { NextRequest, NextResponse } from "next/server";
import { sendMail, type MailOptions } from "@/app/lib/email";
import { verifyRequestToken } from "@/app/lib/submission-validation";
import { isRateLimited } from "@/app/lib/rate-limit";

export async function POST(req: NextRequest) {
  const caller = await verifyRequestToken(req);
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(`send:${ip}`, 30, 60 * 60 * 1000))
    return NextResponse.json({ error: "Çok fazla istek. Lütfen bekleyin." }, { status: 429 });

  try {
    const body: MailOptions = await req.json();
    const { to, subject, html, attachments } = body;

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "to, subject ve html zorunludur." },
        { status: 400 }
      );
    }

    const result = await sendMail({ to, subject, html, attachments });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error("[send/route] Beklenmeyen hata:", err);
    return NextResponse.json({ error: "Sunucu hatası oluştu." }, { status: 500 });
  }
}
