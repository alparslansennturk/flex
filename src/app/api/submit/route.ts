import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { uploadToDrive, validateDriveFile, isDriveError } from "@/app/lib/googledrive";
import { createSubmission } from "@/app/lib/submissions";

async function validateIds(studentId: string, taskId: string, groupId: string): Promise<string | null> {
  const [studentSnap, taskSnap, groupSnap] = await Promise.all([
    adminDb.collection("students").doc(studentId).get(),
    adminDb.collection("tasks").doc(taskId).get(),
    adminDb.collection("groups").doc(groupId).get(),
  ]);

  if (!studentSnap.exists) return `Öğrenci bulunamadı: ${studentId}`;
  if (!taskSnap.exists)    return `Ödev bulunamadı: ${taskId}`;
  if (!groupSnap.exists)   return `Grup bulunamadı: ${groupId}`;

  if (studentSnap.data()!.groupId !== groupId)
    return `Öğrenci (${studentId}) bu gruba (${groupId}) ait değil.`;

  return null;
}

export async function POST(req: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "multipart/form-data bekleniyor." }, { status: 400 });
    }

    const studentId = formData.get("studentId");
    const taskId    = formData.get("taskId");
    const groupId   = formData.get("groupId");
    const file      = formData.get("file");

    if (!studentId || typeof studentId !== "string")
      return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });
    if (!taskId || typeof taskId !== "string")
      return NextResponse.json({ error: "taskId zorunludur." }, { status: 400 });
    if (!groupId || typeof groupId !== "string")
      return NextResponse.json({ error: "groupId zorunludur." }, { status: 400 });
    if (!file || !(file instanceof File))
      return NextResponse.json({ error: "file zorunludur." }, { status: 400 });

    const mimeType = file.type || "application/octet-stream";
    const valErr = validateDriveFile(mimeType, file.size);
    if (valErr) {
      return NextResponse.json({ error: valErr.message }, { status: valErr.code === "FILE_TOO_LARGE" ? 413 : 422 });
    }

    const idErr = await validateIds(studentId, taskId, groupId);
    if (idErr) return NextResponse.json({ error: idErr }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    const driveResult = await uploadToDrive(buffer, file.name, mimeType);

    const submission = await createSubmission({
      studentId,
      taskId,
      groupId,
      fileUrl:       driveResult.downloadUrl,
      driveFileId:   driveResult.fileId,
      driveViewLink: driveResult.webViewLink,
      fileName:      driveResult.fileName,
      fileSize:      driveResult.fileSize,
      mimeType:      driveResult.mimeType,
    });

    return NextResponse.json({
      submissionId:  submission.id,
      driveFileId:   submission.driveFileId,
      driveViewLink: submission.driveViewLink,
      downloadUrl:   submission.fileUrl,
      fileName:      submission.fileName,
      fileSize:      submission.fileSize,
      status:        submission.status,
    });

  } catch (err: unknown) {
    if (isDriveError(err)) {
      const status = err.code === "FILE_TOO_LARGE" ? 413 : err.code === "INVALID_TYPE" ? 422 : 500;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("[submit] Beklenmeyen hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
