import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  initResumableSession,
  generateActualFileName,
  validateDriveFile,
} from "@/app/lib/googledrive";
import { verifyRequestToken } from "@/app/lib/submission-validation";
import {
  validateFileSizeLimit,
  validateUploadCount,
  getMaxUploads,
} from "@/app/lib/submission-validation";
import { ALLOWED_MIME_TYPES } from "@/app/types/storage";
import type { InitUploadResponse } from "@/app/types/upload";
import crypto from "crypto";

// upload_sessions için 7 günlük TTL (Drive session lifetime)
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

    const { studentId, taskId, groupId, fileName, fileSize, mimeType } = body as {
      studentId: string;
      taskId:    string;
      groupId:   string;
      fileName:  string;
      fileSize:  number;
      mimeType:  string;
    };

    if (!studentId || !taskId || !groupId || !fileName || !fileSize || !mimeType) {
      return NextResponse.json(
        { error: "studentId, taskId, groupId, fileName, fileSize, mimeType zorunludur." },
        { status: 400 },
      );
    }

    // 3. Dosya boyutu kontrolü (100 MB)
    if (!validateFileSizeLimit(fileSize)) {
      return NextResponse.json(
        { error: `Dosya boyutu 100 MB sınırını aşıyor. Yüklenen: ${(fileSize / 1024 / 1024).toFixed(1)} MB` },
        { status: 413 },
      );
    }

    // 4. MIME type kontrolü
    const allowed = ALLOWED_MIME_TYPES as readonly string[];
    if (!allowed.includes(mimeType)) {
      return NextResponse.json(
        { error: `İzin verilmeyen dosya türü: ${mimeType}` },
        { status: 422 },
      );
    }

    // 5. ID doğrulama (Firestore)
    const [studentSnap, taskSnap, groupSnap] = await Promise.all([
      adminDb.collection("students").doc(studentId).get(),
      adminDb.collection("tasks").doc(taskId).get(),
      adminDb.collection("groups").doc(groupId).get(),
    ]);

    if (!studentSnap.exists) return NextResponse.json({ error: `Öğrenci bulunamadı: ${studentId}` }, { status: 400 });
    if (!taskSnap.exists)    return NextResponse.json({ error: `Ödev bulunamadı: ${taskId}` }, { status: 400 });
    if (!groupSnap.exists)   return NextResponse.json({ error: `Grup bulunamadı: ${groupId}` }, { status: 400 });

    // 6. Öğrenci başkası adına yükleyemez
    // caller.uid = Firebase Auth UID  |  studentId = Firestore doc ID
    // students/{studentId}.authUid üzerinden eşleştir
    if (caller.role === "student" && studentSnap.data()?.authUid !== caller.uid) {
      return NextResponse.json(
        { error: "Başkası adına yükleme yapılamaz." },
        { status: 403 },
      );
    }

    if (studentSnap.data()!.groupId !== groupId) {
      return NextResponse.json(
        { error: `Öğrenci (${studentId}) bu gruba (${groupId}) ait değil.` },
        { status: 400 },
      );
    }

    // 7. Upload sayısı ve limit kontrolü
    const existingSnap = await adminDb.collection("submissions")
      .where("studentId", "==", studentId)
      .where("taskId", "==", taskId)
      .get();

    const currentUploads = existingSnap.size;

    // En son submission'ın statusü
    let latestStatus: string | null = null;
    if (!existingSnap.empty) {
      const sorted = existingSnap.docs
        .map(d => ({ status: d.data().status as string, ts: d.data().submittedAt?.toMillis?.() ?? 0 }))
        .sort((a, b) => b.ts - a.ts);
      latestStatus = sorted[0].status;
    }

    const maxUploads = getMaxUploads(latestStatus);

    if (!validateUploadCount(currentUploads, maxUploads)) {
      return NextResponse.json(
        {
          error:          `Upload limiti doldu. Maksimum ${maxUploads} yükleme hakkı.`,
          currentUploads,
          maxUploads,
          uploadsRemaining: 0,
        },
        { status: 429 },
      );
    }

    // 8. Unique filename oluştur
    const uploadId       = crypto.randomUUID();
    const actualFileName = generateActualFileName(uploadId, fileName);

    // 9. Google Drive resumable session başlat
    const sessionUri = await initResumableSession(actualFileName, fileSize, mimeType);

    // 10. upload_sessions'a kaydet
    const now       = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

    await adminDb.collection("upload_sessions").doc(uploadId).set({
      uploadId,
      userId:           caller.uid,
      studentId,
      taskId,
      groupId,
      originalFileName: fileName,
      actualFileName,
      fileSize,
      mimeType,
      sessionUri,
      status:           "uploading",
      createdAt:        FieldValue.serverTimestamp(),
      expiresAt,
    });

    // sessionUri kasıtlı olarak response'a eklenmez — server-side'da kalır
    const response: Omit<InitUploadResponse, "sessionUri"> = {
      uploadId,
      actualFileName,
      currentUploads,
      maxUploads,
      uploadsRemaining: maxUploads - currentUploads - 1,
      totalBytes:       fileSize,
    };

    return NextResponse.json(response);

  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[init-resumable-upload] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası.", detail }, { status: 500 });
  }
}
