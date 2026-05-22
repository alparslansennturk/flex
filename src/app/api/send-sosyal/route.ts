import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/app/lib/email";
import { saveMailLog } from "@/app/services/emailService";
import { createFolderStructure } from "@/app/lib/googledrive-folder";
import { uploadBufferToFolder, setPublicReadPermission } from "@/app/lib/googledrive";
import { verifyRequestToken } from "@/app/lib/submission-validation";
import { isRateLimited } from "@/app/lib/rate-limit";

interface SosyalMailRequest {
  to: string;
  studentName: string;
  brandName: string;
  pdfBase64: string;
  groupName?: string;
  instructorName?: string;
  taskName?: string;
  studentId?: string;
}

export async function POST(req: NextRequest) {
  const caller = await verifyRequestToken(req);
  if (!caller) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  if (isRateLimited(`send-sosyal:${caller.uid}`, 20, 60 * 60 * 1000))
    return NextResponse.json({ error: "Çok fazla istek. Lütfen bekleyin." }, { status: 429 });

  try {
    const body: SosyalMailRequest = await req.json();
    const { to, studentName, brandName, pdfBase64, groupName, instructorName, taskName, studentId } = body;

    if (!to || !pdfBase64) {
      return NextResponse.json({ error: "Eksik parametre." }, { status: 400 });
    }

    // Dosya adı: "Aylin Dümen-Sosyal Medya Reklam Tasarımı.pdf"
    const fileName = `${studentName}-${taskName ?? "Sosyal Medya"}.pdf`;

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

    const result = await sendMail({
      to,
      subject: `Sosyal Medya Ödevin — ${brandName}`,
      html,
      attachments: [
        {
          filename: fileName,
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
      groupCode: groupName ?? undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Drive'a kaydet: Gruplar/{group}/Eğitmen/{instructor}/{taskName}/{ad-soyad-taskName}.pdf
    let driveUrl: string | undefined;
    if (pdfBase64 && groupName?.trim() && instructorName?.trim() && taskName?.trim()) {
      try {
        const { folderId } = await createFolderStructure(
          groupName.trim(),
          instructorName.trim(),
          "instructor",
          taskName.trim(),
        );
        const pdfBuffer = Buffer.from(pdfBase64, "base64");
        const { fileId, webViewLink } = await uploadBufferToFolder(pdfBuffer, fileName, "application/pdf", folderId);
        await setPublicReadPermission(fileId);
        driveUrl = webViewLink;
      } catch (driveErr) {
        console.warn("[send-sosyal] Drive upload atlandı:", driveErr);
      }
    }

    return NextResponse.json({ success: true, driveUrl, fileName, studentId });
  } catch (err) {
    console.error("[send-sosyal] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
