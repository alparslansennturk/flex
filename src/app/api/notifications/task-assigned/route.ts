import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  // Auth — instructor veya admin
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 401 });

  let decoded: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Geçersiz token." }, { status: 401 });
  }

  const role = decoded.role as string | undefined;
  if (role !== "admin" && role !== "instructor") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

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
      senderId:   decoded.uid,
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
