import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/app/lib/email";
import { saveMailLog } from "@/app/services/emailService";
import { createFolderStructure } from "@/app/lib/googledrive-folder";
import { uploadBufferToFolder, setPublicReadPermission } from "@/app/lib/googledrive";

interface DrawResult {
  category: string;
  item: { name: string; emoji?: string };
}

interface KolajMailRequest {
  to: string;
  studentName: string;
  studentLastName: string;
  taskName: string;
  draws: DrawResult[];
  deadline: string;
  pdfBase64: string;
  groupName?: string; // Drive'a kaydetmek için grup kodu
}

export async function POST(req: NextRequest) {
  try {
    const body: KolajMailRequest = await req.json();
    const { to, studentName, studentLastName, taskName, draws, deadline, pdfBase64, groupName } = body;

    if (!to || !draws?.length) {
      return NextResponse.json({ error: "Eksik parametre." }, { status: 400 });
    }

    const rows = draws.map(dr => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280">${dr.category}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:700;color:#111">${dr.item.emoji || ""} ${dr.item.name}</td>
      </tr>`).join("");

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 32px">
        <h2 style="font-size:22px;font-weight:900;color:#111;margin:0 0 4px">Kolaj Bahçesi</h2>
        <p style="font-size:13px;color:#9ca3af;margin:0 0 24px">${taskName} · Ödev Sonuçları</p>
        <p style="font-size:15px;font-weight:700;color:#111;margin:0 0 8px">Merhaba ${studentName},</p>
        <p style="font-size:14px;color:#374151;margin:0 0 20px;line-height:1.6">
          Kolaj bahçesi çekilişinden elde ettiğin materyaller ekteki PDF dosyasında yer alıyor.
        </p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
          <thead><tr>
            <th style="padding:10px 16px;background:#f9fafb;text-align:left;font-size:11px;color:#9ca3af;border-bottom:1px solid #e5e7eb;text-transform:uppercase">Kategori</th>
            <th style="padding:10px 16px;background:#f9fafb;text-align:left;font-size:11px;color:#9ca3af;border-bottom:1px solid #e5e7eb;text-transform:uppercase">Materyal</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:12px;color:#d1d5db;margin-top:28px">Teslim Tarihi: ${deadline}</p>
      </div>`;

    const attachments = pdfBase64
      ? [{
          filename: `kolaj-odev-${studentName}.pdf`,
          content: pdfBase64,
          encoding: "base64" as const,
          contentType: "application/pdf",
        }]
      : undefined;

    const result = await sendMail({
      to,
      subject: `Kolaj Bahçesi Ödevin — ${taskName}`,
      html,
      attachments,
    });

    await saveMailLog({
      to,
      subject: `Kolaj Bahçesi Ödevin — ${taskName}`,
      type: "kolaj-assignment",
      result,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Mail gönderildi — Drive'a da kaydet (non-fatal, hata olsa da mail gönderildi sayılır)
    if (pdfBase64 && groupName?.trim() && studentName && studentLastName && taskName) {
      try {
        const studentFullName = `${studentName} ${studentLastName}`.trim();
        const { folderId } = await createFolderStructure(
          groupName.trim(), studentFullName, "student", taskName,
        );
        const pdfBuffer = Buffer.from(pdfBase64, "base64");
        const fileName  = `kolaj-${studentFullName}.pdf`;
        const { fileId } = await uploadBufferToFolder(pdfBuffer, fileName, "application/pdf", folderId);
        await setPublicReadPermission(fileId);
      } catch (driveErr) {
        console.warn("[send-kolaj] Drive upload atlandı:", driveErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[send-kolaj] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
