import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/app/lib/email";
import { saveMailLog } from "@/app/services/emailService";

interface SosyalMailRequest {
  to: string;
  studentName: string;
  brandName: string;
  pdfBase64: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: SosyalMailRequest = await req.json();
    const { to, studentName, brandName, pdfBase64 } = body;

    if (!to || !pdfBase64) {
      return NextResponse.json({ error: "Eksik parametre." }, { status: 400 });
    }

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 32px;color:#111">
        <p style="font-size:15px;margin:0 0 16px">Sayın <strong>${studentName}</strong>,</p>
        <p style="font-size:14px;line-height:1.7;margin:0 0 16px">
          Sosyal medya yönetimi ödeviniz ekte yer almaktadır.
          Teslim tarihine dikkat ederek ödevinizi eksiksiz tamamlamanızı dileriz.
        </p>
        <p style="font-size:14px;line-height:1.7;margin:0 0 32px">Başarılar.</p>
        <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin:0">
          Tasarım Atölyesi
        </p>
      </div>`;

    const safeName = studentName.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, "").replace(/\s+/g, "_");

    const result = await sendMail({
      to,
      subject: `Sosyal Medya Ödevin — ${brandName}`,
      html,
      attachments: [
        {
          filename: `${safeName}_${brandName}_SM.pdf`,
          content: pdfBase64,
          encoding: "base64",
          contentType: "application/pdf",
        },
      ],
    });

    await saveMailLog({
      to,
      subject: `Sosyal Medya Ödevin — ${brandName}`,
      type: "sosyal-assignment",
      result,
      name: studentName,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[send-sosyal] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
