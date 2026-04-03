import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/app/services/emailService";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json();

    if (!email || !name) {
      return NextResponse.json(
        { error: "email ve name zorunludur." },
        { status: 400 }
      );
    }

    const result = await sendWelcomeEmail(email, name);

    // mailLogs'a kayıt at
    await adminDb.collection("mailLogs").add({
      to: email,
      name,
      subject: "Hesabın Oluşturuldu — Tasarım Atölyesi",
      type: "welcome",
      status: result.success ? "success" : "failed",
      messageId: result.messageId ?? null,
      error: result.error ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error("[welcome/route] Beklenmeyen hata:", err);
    return NextResponse.json({ error: "Sunucu hatası oluştu." }, { status: 500 });
  }
}
