import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { sendMail } from "@/app/lib/email";
import { saveMailLog } from "@/app/services/emailService";
import { createFolderStructure } from "@/app/lib/googledrive-folder";
import { uploadBufferToFolder, setPublicReadPermission } from "@/app/lib/googledrive";
import { isRateLimited } from "@/app/lib/rate-limit";
import { adminDb } from "@/app/lib/firebase-admin";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";

// item: Kolaj → {name,emoji}, Kitap → {title,...} (BookItem), Sosyal → SocialDrawItem
// (brandName/sectorDisplay/brandRule/purpose/platform/contentType) — düz-alan snapshot,
// {category,item} şekline uymadığı için mail HTML'i `type==="sosyal"` iken ayrı dallanır.
interface DrawResult {
  category: string;
  item: {
    name?: string; title?: string; emoji?: string;
    brandName?: string; sectorDisplay?: string; brandRule?: string; purpose?: string; platform?: string; contentType?: string;
  };
}

interface KolajMailRequest {
  type?: "kolaj" | "kitap" | "sosyal"; // yoksa "kolaj" (geriye dönük uyumlu)
  studentName: string;
  studentLastName: string;
  studentId: string;
  assignmentId: string;
  groupCode?: string;
  taskName: string;
  draws: DrawResult[];
  deadline: string;
  pdfBase64: string;
}

const MAIL_COPY: Record<"kolaj" | "kitap" | "sosyal", { label: string; intro: string; fileLabel: string }> = {
  kolaj: {
    label: "Kolaj Bahçesi",
    intro: "Kolaj bahçesi çekilişinden elde ettiğin materyaller ekteki PDF dosyasında yer alıyor.",
    fileLabel: "kolaj",
  },
  kitap: {
    label: "Kitap Dünyası",
    intro: "Kitap kapağı ödevin ekteki PDF dosyasında yer alıyor. Teslim tarihine dikkat ederek eksiksiz tamamla.",
    fileLabel: "kitap",
  },
  sosyal: {
    label: "Sosyal Medya Yönetimi",
    intro: "Reklam tasarımı çekilişinden elde ettiğin marka/hedef bilgileri ekteki PDF dosyasında yer alıyor.",
    fileLabel: "sosyal",
  },
};

/**
 * POST /api/flexos/lottery-results/mail — canlıdaki `/api/send-kolaj/route.ts` +
 * `/api/send-kitap/route.ts` ile BİREBİR aynı mantık (mail + Drive upload reuse, yeni
 * altyapı yok), `type` alanına göre metin/dosya adı değişir. İKİ FARK:
 *  (1) Drive linki `tasks.{kolaj,kitap}DriveFiles` yerine
 *      `flexos_lottery_results/{assignmentId}.driveFiles`'a yazılır.
 *  (2) Öğrenci e-postası CLIENT'TAN ALINMAZ — server-side `Person.pii.email`'den okunur
 *      (eğitmen `person.read.pii` yetkisine sahip olmayabilir; canlıda hiç PII kapısı
 *      yoktu ama FlexOS'ta email PII alanı, trainer'a asla client tarafında gösterilmez).
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);

  if (await isRateLimited(`flexos-send-kolaj:${actor.uid}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Çok fazla istek. Lütfen bekleyin." }, { status: 429 });
  }

  let body: KolajMailRequest;
  try {
    body = (await req.json()) as KolajMailRequest;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  const { studentName, studentLastName, studentId, assignmentId, groupCode, taskName, draws, deadline, pdfBase64 } = body;
  if (!studentId || !draws?.length || !assignmentId) {
    return NextResponse.json({ error: "Eksik parametre." }, { status: 400 });
  }
  const type = body.type ?? "kolaj";
  const copy = MAIL_COPY[type];

  const assignment = await firestoreAssignmentRepo.getById(assignmentId, actor.tenantId);
  if (!assignment) return NextResponse.json({ error: "Ödev bulunamadı." }, { status: 404 });
  if (!can(actor, "assignment.edit", { groupId: assignment.groupId, ownerUid: assignment.trainerId })) {
    return NextResponse.json({ error: "Yetki yok: assignment.edit" }, { status: 403 });
  }

  const person = await firestorePersonRepo.getById(studentId, actor.tenantId);
  const to = person?.pii?.email;
  if (!to) {
    return NextResponse.json({ error: "Öğrencinin kayıtlı bir e-posta adresi yok." }, { status: 400 });
  }

  try {
    // Sosyal: FullSMDraw düz-alan snapshot'ı {category,item:{name,title}} şekline uymuyor —
    // kategori/materyal yerine Marka Kuralı/Amaç/Platform/İçerik Türü 4 satırlık tablo.
    const rows = type === "sosyal"
      ? (() => {
          const sm = draws[0]?.item ?? {};
          const smRows: { key: string; val: string }[] = [
            { key: "Marka Kuralı", val: sm.brandRule || "—" },
            { key: "Amaç / Hedef", val: sm.purpose || "—" },
            { key: "Platform", val: sm.platform || "—" },
            { key: "İçerik Türü", val: sm.contentType || "—" },
          ];
          return smRows.map((row) => `
            <tr>
              <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280">${row.key}</td>
              <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:700;color:#111">${row.val}</td>
            </tr>`).join("");
        })()
      : draws.map((dr) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280">${dr.category}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:700;color:#111">${dr.item.emoji || ""} ${dr.item.name ?? dr.item.title ?? ""}</td>
      </tr>`).join("");

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 32px">
        <h2 style="font-size:22px;font-weight:900;color:#111;margin:0 0 4px">${copy.label}</h2>
        <p style="font-size:13px;color:#9ca3af;margin:0 0 24px">${taskName} · Ödev Sonuçları</p>
        <p style="font-size:15px;font-weight:700;color:#111;margin:0 0 8px">Merhaba ${studentName},</p>
        <p style="font-size:14px;color:#374151;margin:0 0 20px;line-height:1.6">
          ${copy.intro}
        </p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
          <thead><tr>
            <th style="padding:10px 16px;background:#f9fafb;text-align:left;font-size:11px;color:#9ca3af;border-bottom:1px solid #e5e7eb;text-transform:uppercase">${type === "sosyal" ? "Alan" : "Kategori"}</th>
            <th style="padding:10px 16px;background:#f9fafb;text-align:left;font-size:11px;color:#9ca3af;border-bottom:1px solid #e5e7eb;text-transform:uppercase">${type === "sosyal" ? "Değer" : "Materyal"}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:12px;color:#d1d5db;margin-top:28px">Teslim Tarihi: ${deadline}</p>
      </div>`;

    const attachments = pdfBase64
      ? [{ filename: `${copy.fileLabel}-odev-${studentName}.pdf`, content: pdfBase64, encoding: "base64" as const, contentType: "application/pdf" }]
      : undefined;

    const result = await sendMail({ to, subject: `${copy.label} Ödevin — ${taskName}`, html, attachments });

    await saveMailLog({
      to,
      subject: `${copy.label} Ödevin — ${taskName}`,
      type: `${type}-assignment`,
      result,
      name: `${studentName} ${studentLastName}`.trim(),
      groupCode: groupCode ?? undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Mail gönderildi — Drive'a da kaydet (non-fatal, hata olsa da mail gönderildi sayılır).
    let driveUrl: string | undefined;
    let driveFileName: string | undefined;
    if (pdfBase64 && groupCode?.trim() && studentName && studentLastName && taskName) {
      try {
        const studentFullName = `${studentName} ${studentLastName}`.trim();
        const { folderId } = await createFolderStructure(groupCode.trim(), studentFullName, "student", taskName);
        const pdfBuffer = Buffer.from(pdfBase64, "base64");
        const fileName = `${studentFullName}-${taskName}.pdf`;
        const { fileId, webViewLink } = await uploadBufferToFolder(pdfBuffer, fileName, "application/pdf", folderId);
        await setPublicReadPermission(fileId);
        driveUrl = webViewLink;
        driveFileName = fileName;
      } catch (driveErr) {
        console.warn("[flexos/lottery-results/mail] Drive upload atlandı:", driveErr);
      }
    }

    if (driveUrl && studentId) {
      try {
        await adminDb.collection("flexos_lottery_results").doc(assignmentId).set(
          { driveFiles: { [studentId]: { url: driveUrl, fileName: driveFileName ?? "" } } },
          { merge: true },
        );
      } catch (writeErr) {
        console.warn("[flexos/lottery-results/mail] driveFiles yazımı atlandı:", writeErr);
      }
    }

    return NextResponse.json({ success: true, driveUrl, driveFileName });
  } catch (err) {
    console.error("[flexos/lottery-results/mail] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
