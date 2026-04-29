import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { deleteFromDrive, isDriveError } from "@/app/lib/googledrive";
import { verifyRequestToken } from "@/app/lib/submission-validation";
import { softDeleteFile } from "@/app/lib/submission-files";
import type { DeleteFileResponse } from "@/app/types/upload";

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

    const { submissionId, fileVersionId } = body as {
      submissionId:  string;
      fileVersionId: string; // submission_files doc ID
    };

    if (!submissionId || !fileVersionId) {
      return NextResponse.json(
        { error: "submissionId ve fileVersionId zorunludur." },
        { status: 400 },
      );
    }

    // 3. Submission al + yetki kontrolü
    const submissionSnap = await adminDb.collection("submissions").doc(submissionId).get();
    if (!submissionSnap.exists) {
      return NextResponse.json({ error: "Submission bulunamadı." }, { status: 404 });
    }

    const submissionData = submissionSnap.data()!;

    // Öğrenci: sadece kendi submission'ı
    // caller.uid = Auth UID, submissionData.studentId = Firestore doc ID
    // users/{caller.uid}.studentDocId üzerinden eşleştir
    if (caller.role === "student") {
      const userDoc = await adminDb.collection("users").doc(caller.uid).get();
      const callerStudentDocId = userDoc.data()?.studentDocId as string | undefined;
      if (callerStudentDocId !== submissionData.studentId) {
        return NextResponse.json(
          { error: "Başkasının dosyasını silemezsiniz." },
          { status: 403 },
        );
      }
    }

    // Tamamlanmış submission dosyası silinemez
    if (submissionData.status === "completed") {
      return NextResponse.json(
        { error: "Tamamlanmış ödev dosyası silinemez." },
        { status: 403 },
      );
    }

    // 4. submission_files kaydını al
    const fileSnap = await adminDb.collection("submission_files").doc(fileVersionId).get();
    if (!fileSnap.exists) {
      return NextResponse.json({ error: "Dosya versiyonu bulunamadı." }, { status: 404 });
    }

    const fileData = fileSnap.data()!;

    // submissionId eşleşme kontrolü
    if (fileData.submissionId !== submissionId) {
      return NextResponse.json(
        { error: "Dosya bu submission'a ait değil." },
        { status: 400 },
      );
    }

    // Zaten silinmiş mi?
    if (fileData.deleted === true) {
      return NextResponse.json({ error: "Dosya zaten silinmiş." }, { status: 409 });
    }

    const driveFileId = fileData.driveFileId as string;

    // 5. Google Drive'dan kalıcı sil
    await deleteFromDrive(driveFileId);

    // 6. DB'de soft-delete
    await softDeleteFile(fileVersionId, caller.uid);

    // 7. Kalan aktif dosya sayısını hesapla (audit/UI için)
    const remainingSnap = await adminDb.collection("submission_files")
      .where("submissionId", "==", submissionId)
      .where("deleted", "!=", true)
      .get();

    const response: DeleteFileResponse = {
      success:      true,
      updatedCount: remainingSnap.size,
      message:      "Dosya başarıyla silindi.",
    };

    return NextResponse.json(response);

  } catch (err: unknown) {
    if (isDriveError(err)) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[delete-file] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası.", detail }, { status: 500 });
  }
}
