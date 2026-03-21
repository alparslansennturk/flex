import { NextRequest, NextResponse } from "next/server";
import { sendMail, type MailOptions } from "@/app/lib/email";

export async function POST(req: NextRequest) {
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
