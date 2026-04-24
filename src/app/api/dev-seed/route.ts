import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET() {
  try {
    // 1. İlk grubu bul
    const groupsSnap = await adminDb.collection("groups").limit(1).get();
    if (groupsSnap.empty) return NextResponse.json({ error: "Hiç grup yok" }, { status: 404 });
    const group = groupsSnap.docs[0];

    // 2. Bu gruptaki ilk öğrenciyi bul
    const studentsSnap = await adminDb
      .collection("students")
      .where("groupId", "==", group.id)
      .limit(1)
      .get();
    if (studentsSnap.empty) return NextResponse.json({ error: "Bu grupta öğrenci yok" }, { status: 404 });
    const student = studentsSnap.docs[0];

    // 3. İlk aktif task'i bul
    const tasksSnap = await adminDb.collection("tasks").limit(1).get();
    if (tasksSnap.empty) return NextResponse.json({ error: "Hiç task yok" }, { status: 404 });
    const task = tasksSnap.docs[0];

    // 4. Bu öğrenci + task için zaten submission var mı?
    const existingSnap = await adminDb
      .collection("submissions")
      .where("studentId", "==", student.id)
      .where("taskId", "==", task.id)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0];
      return NextResponse.json({
        message: "Zaten mevcut submission var",
        submissionId: existing.id,
        groupId: group.id,
        assignmentId: task.id,
        studentName: `${student.data().name} ${student.data().lastName}`,
        previewUrl: `/dashboard/assignment-test/${group.id}/${task.id}`,
      });
    }

    // 5. Test submission oluştur
    const submissionRef = await adminDb.collection("submissions").add({
      studentId:   student.id,
      taskId:      task.id,
      groupId:     group.id,
      iteration:   1,
      status:      "submitted",
      isLate:      false,
      note:        "Bu test amaçlı oluşturulmuş bir gönderimdir.",
      file: {
        driveFileId:   "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs",
        driveViewLink: "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view",
        fileUrl:       "https://drive.google.com/uc?id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs",
        fileName:      "ÖDEV_BILLBOARD_TEST.jpg",
        fileSize:      204800,
        mimeType:      "image/jpeg",
      },
      submittedAt: FieldValue.serverTimestamp(),
      updatedAt:   FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      message: "Test submission oluşturuldu ✓",
      submissionId: submissionRef.id,
      groupId: group.id,
      assignmentId: task.id,
      studentName: `${student.data().name} ${student.data().lastName}`,
      previewUrl: `/dashboard/assignment-test/${group.id}/${task.id}`,
      detailUrl:  `/dashboard/assignment-test/${group.id}/${task.id}/${submissionRef.id}/preview`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Silmek için DELETE
export async function DELETE() {
  try {
    const snap = await adminDb
      .collection("submissions")
      .where("note", "==", "Bu test amaçlı oluşturulmuş bir gönderimdir.")
      .get();

    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    return NextResponse.json({ message: `${snap.size} test submission silindi.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
