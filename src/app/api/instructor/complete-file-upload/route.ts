import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { setPublicReadPermission, findFileByActualName } from "@/app/lib/googledrive";
import { verifyRequestToken } from "@/app/lib/submission-validation";

export async function POST(req: NextRequest) {
  const caller = await verifyRequestToken(req);
  if (!caller) return NextResponse.json({ error: "Kimlik doğrulaması gerekli." }, { status: 401 });

  let body: { uploadId: string; driveFileId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON body bekleniyor." }, { status: 400 }); }

  const { uploadId, driveFileId: clientDriveFileId } = body;
  if (!uploadId) return NextResponse.json({ error: "uploadId zorunludur." }, { status: 400 });

  const sessionDoc = await adminDb.collection("upload_sessions").doc(uploadId).get();
  if (!sessionDoc.exists) return NextResponse.json({ error: "Session bulunamadı." }, { status: 404 });

  const session = sessionDoc.data()!;
  if (session.status === "completed") return NextResponse.json({ error: "Zaten tamamlandı." }, { status: 409 });
  if (session.userId !== caller.uid) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  const expiresAt = session.expiresAt instanceof Timestamp
    ? session.expiresAt.toDate()
    : new Date(session.expiresAt as string);
  if (new Date() > expiresAt) {
    await adminDb.collection("upload_sessions").doc(uploadId).update({ status: "failed" });
    return NextResponse.json({ error: "Session süresi dolmuş." }, { status: 410 });
  }

  let driveFileId: string;
  if (clientDriveFileId?.trim()) {
    driveFileId = clientDriveFileId.trim();
  } else {
    const fallback = await findFileByActualName(session.fileName as string, session.folderId as string | undefined);
    driveFileId = fallback.id;
  }

  await setPublicReadPermission(driveFileId);

  const webViewLink = `https://drive.google.com/file/d/${driveFileId}/view`;

  await adminDb.collection("upload_sessions").doc(uploadId).update({
    status:      "completed",
    driveFileId,
    completedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({
    webViewLink,
    fileName: session.fileName as string,
    fileId:   driveFileId,
  });
}
