import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyRequestToken } from "@/app/lib/submission-validation";
import { deleteFromDrive } from "@/app/lib/googledrive";

/**
 * POST /api/tasks/delete
 * Cascade task silme:
 *   1. tasks dokümanı
 *   2. lottery_results dokümanı
 *   3. assignment_archive dokümanları (taskId ile eşleşen)
 *   4. submissions dokümanları (taskId ile eşleşen)
 *   5. Drive dosyaları (kitapDriveFiles, kolajDriveFiles, sosyalDriveFiles)
 *   6. upload_sessions (taskId ile eşleşen)
 */
export async function POST(req: NextRequest) {
  const caller = await verifyRequestToken(req);
  if (!caller) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  // Sadece admin ve instructor silebilir (claims veya Firestore roles)
  let hasAccess = ["admin", "instructor"].includes(caller.role);
  if (!hasAccess) {
    const userSnap = await adminDb.collection("users").doc(caller.uid).get();
    const userData = userSnap.data();
    hasAccess = !!(
      userData?.role === "admin" || userData?.role === "instructor" ||
      userData?.roles?.includes("admin") || userData?.roles?.includes("instructor")
    );
  }
  if (!hasAccess) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  let body: { taskId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body bekleniyor." }, { status: 400 });
  }

  const { taskId } = body;
  if (!taskId) {
    return NextResponse.json({ error: "taskId zorunludur." }, { status: 400 });
  }

  const deleted: Record<string, number> = {};

  try {
    // 1. Task dokümanını oku (Drive dosya ID'leri için) ve sil
    const taskSnap = await adminDb.collection("tasks").doc(taskId).get();
    const taskData = taskSnap.exists ? taskSnap.data() : null;

    // Drive dosyalarını topla
    const driveFileIds: string[] = [];
    for (const field of ["kitapDriveFiles", "kolajDriveFiles", "sosyalDriveFiles"] as const) {
      const files = taskData?.[field] as Record<string, { url?: string }> | undefined;
      if (!files) continue;
      for (const entry of Object.values(files)) {
        // URL'den fileId çıkar: https://drive.google.com/file/d/{fileId}/view
        const match = entry.url?.match(/\/d\/([^/]+)/);
        if (match?.[1]) driveFileIds.push(match[1]);
      }
    }

    // Task alt koleksiyonları temizle (threads → comments, genel comments)
    if (taskSnap.exists) {
      try {
        // tasks/{taskId}/threads/{studentId}/comments
        const threadsSnap = await adminDb.collection("tasks").doc(taskId).collection("threads").get();
        for (const threadDoc of threadsSnap.docs) {
          const commentsSnap = await threadDoc.ref.collection("comments").get();
          if (!commentsSnap.empty) {
            const batch = adminDb.batch();
            commentsSnap.docs.forEach(c => batch.delete(c.ref));
            await batch.commit();
          }
          await threadDoc.ref.delete();
        }
        // tasks/{taskId}/comments (genel yorumlar)
        const generalComments = await adminDb.collection("tasks").doc(taskId).collection("comments").get();
        if (!generalComments.empty) {
          const batch = adminDb.batch();
          generalComments.docs.forEach(c => batch.delete(c.ref));
          await batch.commit();
        }
      } catch { /* non-fatal */ }

      // Task dokümanı sil
      await adminDb.collection("tasks").doc(taskId).delete();
      deleted.tasks = 1;
    }

    // 2. lottery_results sil
    const lotterySnap = await adminDb.collection("lottery_results").doc(taskId).get();
    if (lotterySnap.exists) {
      await adminDb.collection("lottery_results").doc(taskId).delete();
      deleted.lottery_results = 1;
    }

    // 3. assignment_archive sil — hem doc ID = taskId hem where query
    let archiveCount = 0;
    // Yeni format: doc ID = taskId
    const archiveDirectSnap = await adminDb.collection("assignment_archive").doc(taskId).get();
    if (archiveDirectSnap.exists) {
      await adminDb.collection("assignment_archive").doc(taskId).delete();
      archiveCount++;
    }
    // Eski format: rastgele doc ID, taskId field ile aranır
    const archiveQuerySnap = await adminDb.collection("assignment_archive")
      .where("taskId", "==", taskId).get();
    if (!archiveQuerySnap.empty) {
      const batch = adminDb.batch();
      archiveQuerySnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      archiveCount += archiveQuerySnap.size;
    }
    deleted.assignment_archive = archiveCount;

    // 4. submissions sil
    const subsSnap = await adminDb.collection("submissions")
      .where("taskId", "==", taskId).get();
    if (!subsSnap.empty) {
      // Submission Drive dosyalarını da topla
      for (const d of subsSnap.docs) {
        const fileData = d.data().file;
        if (fileData?.driveFileId) driveFileIds.push(fileData.driveFileId);
      }
      // Batch sil (500 limit)
      for (let i = 0; i < subsSnap.docs.length; i += 500) {
        const batch = adminDb.batch();
        subsSnap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      deleted.submissions = subsSnap.size;
    }

    // 5. upload_sessions sil (taskId ile eşleşen)
    const sessionsSnap = await adminDb.collection("upload_sessions")
      .where("taskId", "==", taskId).get();
    if (!sessionsSnap.empty) {
      const batch = adminDb.batch();
      sessionsSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      deleted.upload_sessions = sessionsSnap.size;
    }

    // 6. Drive dosyalarını sil (non-fatal — bir tanesi başarısız olursa diğerleri devam eder)
    let driveDeleted = 0;
    for (const fileId of driveFileIds) {
      try {
        await deleteFromDrive(fileId);
        driveDeleted++;
      } catch (err) {
        console.warn(`[tasks/delete] Drive dosyası silinemedi (${fileId}):`, err);
      }
    }
    deleted.drive_files = driveDeleted;

    // 7. Öğrenci gradedTasks temizliği
    if (taskData?.grades) {
      const grades = taskData.grades as Record<string, unknown>;
      const studentIds = Object.keys(grades);
      for (let i = 0; i < studentIds.length; i += 500) {
        const batch = adminDb.batch();
        for (const sid of studentIds.slice(i, i + 500)) {
          batch.update(adminDb.collection("students").doc(sid), {
            [`gradedTasks.${taskId}`]: FieldValue.delete(),
          });
        }
        try { await batch.commit(); } catch { /* non-fatal */ }
      }
    }

    return NextResponse.json({ success: true, deleted });
  } catch (err) {
    console.error("[tasks/delete] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
