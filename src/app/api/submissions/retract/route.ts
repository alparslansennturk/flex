import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { deleteFromDrive, isDriveError } from "@/app/lib/googledrive";
import { verifyRequestToken } from "@/app/lib/submission-validation";

// Öğrencinin geri çekebileceği statüsler
const STUDENT_RETRACTABLE: string[] = ["submitted", "revision"];

export async function POST(req: NextRequest) {
  try {
    // 1. Auth — zorunlu
    const caller = await verifyRequestToken(req);
    if (!caller) {
      return NextResponse.json({ error: "Kimlik doğrulaması gerekli." }, { status: 401 });
    }

    // 2. Body
    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "JSON body bekleniyor." }, { status: 400 }); }

    const { submissionId } = body as { submissionId: string };
    if (!submissionId) {
      return NextResponse.json({ error: "submissionId zorunludur." }, { status: 400 });
    }

    // 3. Submission al
    const subRef  = adminDb.collection("submissions").doc(submissionId);
    const subSnap = await subRef.get();
    if (!subSnap.exists) {
      return NextResponse.json({ error: "Submission bulunamadı." }, { status: 404 });
    }

    const subData = subSnap.data()!;

    // 4. Yetki kontrolü
    if (caller.role === "student") {
      // Sahiplik: students/{studentId}.authUid üzerinden doğrula (init-upload ile tutarlı)
      const studentSnap = await adminDb.collection("students").doc(subData.studentId as string).get();
      if (!studentSnap.exists || studentSnap.data()?.authUid !== caller.uid) {
        return NextResponse.json({ error: "Başkasının teslimini geri çekemezsiniz." }, { status: 403 });
      }

      // Statü kontrolü
      if (!STUDENT_RETRACTABLE.includes(subData.status)) {
        return NextResponse.json(
          { error: `"${subData.status}" statüsündeki teslim geri çekilemez.` },
          { status: 403 },
        );
      }

      // dueDate kontrolü: teslim tarihi geçtiyse dosya mühürlenmiştir
      const taskSnap = await adminDb.collection("tasks").doc(subData.taskId as string).get();
      if (taskSnap.exists) {
        const endDate = taskSnap.data()?.endDate as string | undefined;
        if (endDate) {
          const end   = new Date(endDate); end.setHours(0, 0, 0, 0);
          const today = new Date();        today.setHours(0, 0, 0, 0);
          if (today > end) {
            return NextResponse.json(
              { error: "Teslim tarihi geçti. Dosya mühürlenmiştir." },
              { status: 403 },
            );
          }
        }
      }

      // Eğitmen not veya geri bildirim vermişse silinemez (yorumlar engel değil)
      if (subData.grade !== undefined || subData.feedback) {
        return NextResponse.json(
          { error: "Eğitmen değerlendirme yapmış. Bu teslim artık silinemez." },
          { status: 403 },
        );
      }
    }
    // Eğitmen: tüm statüslere müdahale edebilir

    // 5. Google Drive'dan dosyayı sil (non-fatal — Drive'da yoksa devam et)
    const driveFileId = subData.file?.driveFileId as string | undefined;
    if (driveFileId) {
      try {
        await deleteFromDrive(driveFileId);
      } catch (driveErr) {
        console.warn("[retract] Drive silme başarısız (devam ediliyor):", driveErr);
      }
    }

    // 6. submission_files kayıtlarını soft-delete yap (non-fatal)
    try {
      const filesSnap = await adminDb.collection("submission_files")
        .where("submissionId", "==", submissionId)
        .get();
      if (!filesSnap.empty) {
        const batch = adminDb.batch();
        filesSnap.docs.forEach(d => batch.update(d.ref, {
          deleted:   true,
          deletedBy: caller.uid,
          deletedAt: FieldValue.serverTimestamp(),
          isLatest:  false,
        }));
        await batch.commit();
      }
    } catch (fileErr) {
      console.warn("[retract] submission_files silme başarısız (devam ediliyor):", fileErr);
    }

    // 7. Submissions doc'unu sil
    await subRef.delete();

    return NextResponse.json({ success: true, message: "Teslim başarıyla geri çekildi." });

  } catch (err: unknown) {
    if (isDriveError(err)) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[retract] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası.", detail }, { status: 500 });
  }
}
