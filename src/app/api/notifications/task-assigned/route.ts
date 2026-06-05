import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { withAuth, Caller } from "@/app/lib/with-auth";

async function handler(req: NextRequest, caller: Caller) {
  const { taskId, groupId, taskName, endDate } = await req.json() as {
    taskId:   string;
    groupId:  string;
    taskName: string;
    endDate?: string;
  };

  if (!taskId || !groupId || !taskName) {
    return NextResponse.json({ error: "taskId, groupId, taskName zorunlu." }, { status: 400 });
  }

  // Gruptaki öğrencileri bul
  const studentsSnap = await adminDb.collection("students")
    .where("groupId", "==", groupId)
    .get();

  const preview = endDate
    ? `Son teslim: ${endDate}`
    : "Ödevini görmek için tıkla.";

  const batch = adminDb.batch();
  let count = 0;

  for (const studentDoc of studentsSnap.docs) {
    const authUid = studentDoc.data().authUid as string | undefined;
    if (!authUid) continue;

    const userSnap = await adminDb.collection("users").doc(authUid).get();
    if (!userSnap.exists) continue;

    const ref = adminDb
      .collection("users").doc(authUid)
      .collection("notifications").doc();

    batch.set(ref, {
      type:       "assignment",
      entityId:   taskId,
      senderId:   caller.uid,
      title:      `Yeni ödev: ${taskName}`,
      preview,
      actionUrl:  `/student/${studentDoc.id}/${taskId}`,
      createdAt:  FieldValue.serverTimestamp(),
      isRead:     false,
      isArchived: false,
    });
    count++;
  }

  if (count === 0) return NextResponse.json({ success: true, sent: 0 });

  await batch.commit();
  console.log(`[task-assigned] ${count} öğrenciye bildirim gönderildi — task: ${taskId}, group: ${groupId}`);

  return NextResponse.json({ success: true, sent: count });
}

export const POST = withAuth(handler, { roles: ["admin", "instructor"] });
