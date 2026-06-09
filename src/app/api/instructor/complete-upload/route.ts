import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  setPublicReadPermission,
  findFileByActualName,
} from "@/app/lib/googledrive";
import { verifyRequestToken } from "@/app/lib/submission-validation";
import { sendMail } from "@/app/lib/email";
import { saveMailLog } from "@/app/services/emailService";

export async function POST(req: NextRequest) {
  try {
    const caller = await verifyRequestToken(req);
    if (!caller) {
      return NextResponse.json({ error: "Kimlik doğrulaması gerekli." }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON body bekleniyor." }, { status: 400 });
    }

    const { uploadId, driveFileId: clientDriveFileId } = body as {
      uploadId:      string;
      driveFileId?:  string;
    };

    if (!uploadId) {
      return NextResponse.json({ error: "uploadId zorunludur." }, { status: 400 });
    }

    // Session al
    const sessionDoc = await adminDb.collection("upload_sessions").doc(uploadId).get();
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Upload session bulunamadı." }, { status: 404 });
    }

    const session = sessionDoc.data()!;

    if (session.status === "completed") {
      return NextResponse.json({ error: "Bu upload zaten tamamlandı." }, { status: 409 });
    }
    if (session.userId !== caller.uid) {
      return NextResponse.json({ error: "Bu session'a erişim yetkiniz yok." }, { status: 403 });
    }

    const expiresAt = session.expiresAt instanceof Timestamp
      ? session.expiresAt.toDate()
      : new Date(session.expiresAt as string);
    if (new Date() > expiresAt) {
      await adminDb.collection("upload_sessions").doc(uploadId).update({ status: "failed" });
      return NextResponse.json({ error: "Upload session süresi dolmuş." }, { status: 410 });
    }

    // driveFileId çöz — son chunk'tan gelmediyse Drive'da ara
    let driveFileId: string;
    if (clientDriveFileId?.trim()) {
      driveFileId = clientDriveFileId.trim();
    } else {
      const fallback = await findFileByActualName(
        session.fileName as string,
        session.folderId as string | undefined,
      );
      driveFileId = fallback.id;
    }

    // Drive dosyasını herkese açık yap
    await setPublicReadPermission(driveFileId);

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;
    const webViewLink = `https://drive.google.com/file/d/${driveFileId}/view`;

    // Email — attachment yerine Drive indirme linki (Vercel limit yok, spam sorunu yok)
    const studentFullName = `${session.studentName ?? ""} ${session.studentLastName ?? ""}`.trim();
    const bookTitle       = (session.bookTitle as string) || "";

    if (session.studentEmail) {
      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 32px;color:#111">
          <p style="font-size:15px;margin:0 0 16px">Sayın <strong>${studentFullName}</strong>,</p>
          <p style="font-size:14px;line-height:1.7;margin:0 0 24px">
            Kitap kapağı ödeviniz hazırlanmıştır. Aşağıdaki butona tıklayarak ödev belgenizi indirebilirsiniz.
          </p>
          <div style="text-align:center;margin:0 0 28px">
            <a href="${downloadUrl}"
               style="display:inline-block;padding:13px 32px;background:#2563eb;color:white;
                      text-decoration:none;border-radius:8px;font-size:14px;font-weight:700">
              Ödevi İndir
            </a>
          </div>
          <p style="font-size:14px;line-height:1.7;margin:0 0 32px">
            Teslim tarihine dikkat ederek ödevinizi eksiksiz tamamlamanızı dileriz. Başarılar.
          </p>
          <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin:0">Flex</p>
        </div>`;

      try {
        const result = await sendMail({
          to:      session.studentEmail as string,
          subject: `Kitap Kapağı Ödevin — ${bookTitle}`,
          html,
        });
        await saveMailLog({
          to:        session.studentEmail as string,
          subject:   `Kitap Kapağı Ödevin — ${bookTitle}`,
          type:      "kitap-assignment",
          result,
          name:      studentFullName,
          groupCode: (session.groupName as string) || undefined,
        });
      } catch (mailErr) {
        // Mail hatası upload'ı iptal etmemeli
        console.warn("[instructor/complete-upload] Mail hatası (non-fatal):", mailErr);
      }
    }

    // tasks koleksiyonuna Drive URL yaz (eğitmen arşivde görebilsin)
    if (session.taskId && session.studentId) {
      try {
        await adminDb.collection("tasks").doc(session.taskId as string).update({
          [`kitapDriveFiles.${session.studentId}`]: {
            url:      webViewLink,
            fileName: session.fileName as string,
          },
        });
      } catch (fsErr) {
        console.warn("[instructor/complete-upload] tasks güncelleme başarısız (non-fatal):", fsErr);
      }
    }

    // Session'ı tamamlandı olarak işaretle
    await adminDb.collection("upload_sessions").doc(uploadId).update({
      status:      "completed",
      driveFileId,
      completedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success:     true,
      driveUrl:    webViewLink,
      downloadUrl,
      fileName:    session.fileName as string,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[instructor/complete-upload] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası.", detail }, { status: 500 });
  }
}
