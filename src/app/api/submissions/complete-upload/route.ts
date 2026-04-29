import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  findFileByActualName,
  setPublicReadPermission,
  isDriveError,
} from "@/app/lib/googledrive";
import { verifyRequestToken, validateUploadCount, getMaxUploads } from "@/app/lib/submission-validation";
import { createSubmission } from "@/app/lib/submissions";
import { createSubmissionFile } from "@/app/lib/submission-files";
import type { CompleteUploadResponse } from "@/app/types/upload";

export async function POST(req: NextRequest) {
  try {
    // 1. Auth — zorunlu
    const caller = await verifyRequestToken(req);
    if (!caller) {
      return NextResponse.json({ error: "Kimlik doğrulaması gerekli." }, { status: 401 });
    }

    // 2. Body parse
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON body bekleniyor." }, { status: 400 });
    }

    const { uploadId, driveFileId: clientDriveFileId, note } = body as {
      uploadId:      string;
      driveFileId?:  string;
      note?:         string;
    };

    if (!uploadId) {
      return NextResponse.json({ error: "uploadId zorunludur." }, { status: 400 });
    }

    // 3. upload_sessions'dan session al
    const sessionDoc = await adminDb.collection("upload_sessions").doc(uploadId).get();
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Upload session bulunamadı." }, { status: 404 });
    }

    const session = sessionDoc.data()!;

    // 4. Session doğrulama
    if (session.status === "completed") {
      return NextResponse.json({ error: "Bu upload zaten tamamlandı." }, { status: 409 });
    }
    if (session.status === "failed") {
      return NextResponse.json({ error: "Upload başarısız olmuş, yeniden başlatın." }, { status: 410 });
    }
    if (session.userId !== caller.uid) {
      return NextResponse.json({ error: "Bu session'a erişim yetkiniz yok." }, { status: 403 });
    }

    // Session süresi kontrolü
    const expiresAt = session.expiresAt instanceof Timestamp
      ? session.expiresAt.toDate()
      : new Date(session.expiresAt);
    if (new Date() > expiresAt) {
      await adminDb.collection("upload_sessions").doc(uploadId).update({ status: "failed" });
      return NextResponse.json({ error: "Upload session süresi dolmuş." }, { status: 410 });
    }

    // 5. Son upload sayısı kontrolü (race condition koruması)
    const existingSnap = await adminDb.collection("submissions")
      .where("studentId", "==", session.studentId)
      .where("taskId", "==", session.taskId)
      .get();

    const currentUploads = existingSnap.size;
    let latestStatus: string | null = null;
    if (!existingSnap.empty) {
      const sorted = existingSnap.docs
        .map(d => ({ status: d.data().status as string, ts: d.data().submittedAt?.toMillis?.() ?? 0 }))
        .sort((a, b) => b.ts - a.ts);
      latestStatus = sorted[0].status;
    }
    const maxUploads = getMaxUploads(latestStatus);

    if (!validateUploadCount(currentUploads, maxUploads)) {
      await adminDb.collection("upload_sessions").doc(uploadId).update({ status: "failed" });
      return NextResponse.json(
        { error: `Upload limiti doldu. Maksimum ${maxUploads} yükleme hakkı.` },
        { status: 429 },
      );
    }

    // 6. driveFileId çöz
    let driveFileId: string;
    let driveFileIdSource: "response" | "fallback_single" | "fallback_latest";
    let fallbackUsed = false;
    let fallbackRetries = 0;

    if (clientDriveFileId && typeof clientDriveFileId === "string" && clientDriveFileId.trim()) {
      driveFileId       = clientDriveFileId.trim();
      driveFileIdSource = "response";
    } else {
      // Fallback: Drive'da actualFileName ile ara (klasör-içi, retry: 0ms, 100ms, 300ms)
      const fallback = await findFileByActualName(
        session.actualFileName as string,
        session.folderId as string | undefined,
      );
      driveFileId      = fallback.id;
      driveFileIdSource = fallback.source;
      fallbackUsed     = true;
      fallbackRetries  = fallback.retries;
    }

    // 7. Drive dosyasını herkese açık yap
    await setPublicReadPermission(driveFileId);

    const webViewLink  = `https://drive.google.com/file/d/${driveFileId}/view`;
    const downloadUrl  = `https://drive.google.com/uc?export=download&id=${driveFileId}`;

    // 8. Submission + SubmissionFile oluştur
    const submission = await createSubmission({
      studentId: session.studentId as string,
      taskId:    session.taskId as string,
      groupId:   session.groupId as string,
      file: {
        driveFileId,
        driveViewLink: webViewLink,
        fileUrl:       downloadUrl,
        fileName:      session.originalFileName as string,
        fileSize:      session.fileSize as number,
        mimeType:      session.mimeType as string,
      },
      isLate: false,
      ...(note?.trim() ? { note: note.trim() } : {}),
    });

    // submission_files versiyonu — hata submission'ı iptal etmemeli
    try {
      await createSubmissionFile({
        submissionId:  submission.id,
        studentId:     session.studentId as string,
        driveFileId,
        driveViewLink: webViewLink,
        fileUrl:       downloadUrl,
        fileName:      session.originalFileName as string,
        fileSize:      session.fileSize as number,
        mimeType:      session.mimeType as string,
      });
    } catch (fileErr) {
      console.warn("[complete-upload] createSubmissionFile başarısız (non-fatal):", fileErr);
    }

    // 9. Session'ı completed olarak işaretle
    await adminDb.collection("upload_sessions").doc(uploadId).update({
      status:           "completed",
      driveFileId,
      driveFileIdSource,
      fallbackUsed,
      fallbackRetries,
      completedAt:      FieldValue.serverTimestamp(),
    });

    const response: CompleteUploadResponse = {
      submissionId:      submission.id,
      driveFileId,
      driveViewLink:     webViewLink,
      downloadUrl,
      fileName:          submission.file.fileName,
      fileSize:          submission.file.fileSize,
      status:            submission.status,
      driveFileIdSource,
    };

    return NextResponse.json(response);

  } catch (err: unknown) {
    if (isDriveError(err)) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[complete-upload] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası.", detail }, { status: 500 });
  }
}
