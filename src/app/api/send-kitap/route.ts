import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/app/lib/email";
import { saveMailLog } from "@/app/services/emailService";

interface KitapMailRequest {
  to: string;
  studentName: string;
  studentLastName: string;
  pdfBase64: string;
  bookTitle: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: KitapMailRequest = await req.json();
    const { to, studentName, studentLastName, pdfBase64, bookTitle } = body;

    if (!to || !pdfBase64) {
      return NextResponse.json({ error: "Eksik parametre." }, { status: 400 });
    }

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 32px;color:#111">
        <p style="font-size:15px;margin:0 0 16px">Sayın <strong>${studentName} ${studentLastName}</strong>,</p>
        <p style="font-size:14px;line-height:1.7;margin:0 0 16px">
          Kitap kapağı ödeviniz ekte yer almaktadır. Teslim tarihine dikkat ederek ödevinizi eksiksiz tamamlamanızı dileriz.
        </p>
        <p style="font-size:14px;line-height:1.7;margin:0 0 32px">Başarılar.</p>
        <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin:0">
          Tasarım Atölyesi
        </p>
      </div>`;

    const result = await sendMail({
      to,
      subject: `Kitap Kapağı Ödevin — ${bookTitle}`,
      html,
      attachments: [
        {
          filename: `Kitap_Kapagi_Odevi_${studentName}_${studentLastName}.pdf`,
          content: pdfBase64,
          encoding: "base64",
          contentType: "application/pdf",
        },
      ],
    });

    await saveMailLog({
      to,
      subject: `Kitap Kapağı Ödevin — ${bookTitle}`,
      type: "kitap-assignment",
      result,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[send-kitap] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
