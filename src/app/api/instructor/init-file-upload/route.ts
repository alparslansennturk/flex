import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { initResumableSession, ensureFolderPath } from "@/app/lib/googledrive";
import { verifyRequestToken } from "@/app/lib/submission-validation";
import { isRateLimited } from "@/app/lib/rate-limit";
import crypto from "crypto";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const caller = await verifyRequestToken(req);
  if (!caller) return NextResponse.json({ error: "Kimlik doğrulaması gerekli." }, { status: 401 });

  if (await isRateLimited(`instructor-file-upload:${caller.uid}`, 50, 60 * 60 * 1000))
    return NextResponse.json({ error: "Çok fazla istek." }, { status: 429 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON body bekleniyor." }, { status: 400 }); }

  const { fileName, fileSize, mimeType, folderPath } = body as {
    fileName: string; fileSize: number; mimeType: string; folderPath?: string[];
  };

  if (!fileName || !fileSize || !mimeType)
    return NextResponse.json({ error: "fileName, fileSize, mimeType zorunludur." }, { status: 400 });

  if (fileSize > MAX_FILE_BYTES)
    return NextResponse.json({ error: "Dosya boyutu 50MB sınırını aşıyor." }, { status: 413 });

  let folderId: string;
  try {
    folderId = await ensureFolderPath(folderPath?.length ? folderPath : ["Gruplar", "Genel"]);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Drive klasör yapısı oluşturulamadı.", detail }, { status: 500 });
  }

  const sessionUri = await initResumableSession(fileName, fileSize, mimeType, folderId);
  const uploadId   = crypto.randomUUID();
  const expiresAt  = new Date(Date.now() + SESSION_TTL_MS);

  await adminDb.collection("upload_sessions").doc(uploadId).set({
    uploadId,
    userId:    caller.uid,
    type:      "instructor_file",
    fileName,
    fileSize,
    mimeType,
    sessionUri,
    folderId,
    status:    "uploading",
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
  });

  return NextResponse.json({ uploadId, totalBytes: fileSize });
}
