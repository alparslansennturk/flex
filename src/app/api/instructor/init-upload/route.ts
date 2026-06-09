import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { initResumableSession } from "@/app/lib/googledrive";
import { createFolderStructure } from "@/app/lib/googledrive-folder";
import { verifyRequestToken } from "@/app/lib/submission-validation";
import { isRateLimited } from "@/app/lib/rate-limit";
import crypto from "crypto";

// 7 günlük TTL — Drive session ile aynı
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Eğitmen dosyaları için 50MB limit (kitap PDF'leri küçük ama güvenli marj)
const MAX_FILE_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const caller = await verifyRequestToken(req);
    if (!caller) {
      return NextResponse.json({ error: "Kimlik doğrulaması gerekli." }, { status: 401 });
    }

    if (await isRateLimited(`instructor-upload:${caller.uid}`, 50, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Çok fazla istek. Lütfen bekleyin." }, { status: 429 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON body bekleniyor." }, { status: 400 });
    }

    const {
      fileName, fileSize, mimeType,
      groupName, instructorName, taskName, taskId,
      studentEmail, studentName, studentLastName, studentId, bookTitle,
    } = body as {
      fileName: string; fileSize: number; mimeType: string;
      groupName?: string; instructorName?: string; taskName?: string; taskId?: string;
      studentEmail?: string; studentName?: string; studentLastName?: string;
      studentId?: string; bookTitle?: string;
    };

    if (!fileName || !fileSize || !mimeType) {
      return NextResponse.json({ error: "fileName, fileSize, mimeType zorunludur." }, { status: 400 });
    }

    if (fileSize > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `Dosya boyutu 50MB sınırını aşıyor. Yüklenen: ${(fileSize / 1024 / 1024).toFixed(1)} MB` },
        { status: 413 },
      );
    }

    // Drive klasör hiyerarşisi oluştur: Gruplar/{group}/Eğitmen/{instructor}/{taskName}/
    let folderId: string;
    try {
      const folderResult = await createFolderStructure(
        groupName?.trim() || "Genel",
        instructorName?.trim() || "Eğitmen",
        "instructor",
        taskName?.trim() || undefined,
      );
      folderId = folderResult.folderId;
    } catch (folderErr) {
      const detail = folderErr instanceof Error ? folderErr.message : String(folderErr);
      console.error("[instructor/init-upload] Klasör oluşturulamadı:", folderErr);
      return NextResponse.json({ error: "Drive klasör yapısı oluşturulamadı.", detail }, { status: 500 });
    }

    // Drive resumable session başlat
    const sessionUri = await initResumableSession(fileName, fileSize, mimeType, folderId);

    const uploadId = crypto.randomUUID();
    const now      = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

    // upload_sessions'a kaydet — upload-chunk endpoint'i bu session'ı kullanır
    await adminDb.collection("upload_sessions").doc(uploadId).set({
      uploadId,
      userId:         caller.uid,
      type:           "instructor",
      fileName,
      fileSize,
      mimeType,
      sessionUri,
      folderId,
      groupName:      groupName      ?? "",
      instructorName: instructorName ?? "",
      taskName:       taskName       ?? "",
      taskId:         taskId         ?? "",
      studentEmail:   studentEmail   ?? "",
      studentName:    studentName    ?? "",
      studentLastName: studentLastName ?? "",
      studentId:      studentId      ?? "",
      bookTitle:      bookTitle      ?? "",
      status:         "uploading",
      createdAt:      FieldValue.serverTimestamp(),
      expiresAt,
    });

    return NextResponse.json({ uploadId, totalBytes: fileSize });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[instructor/init-upload] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası.", detail }, { status: 500 });
  }
}
