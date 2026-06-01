import { NextRequest, NextResponse } from "next/server";
import { updateSubmissionStatus } from "@/app/lib/submissions";
import { createTimelineEntry } from "@/app/lib/submission-timeline";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logActivityAdmin } from "@/app/lib/activityLogAdmin";
import type { SubmissionStatus } from "@/app/types/submission";
import type { TimelineEntryType } from "@/app/types/submission-timeline";

const STATUS_TO_TIMELINE: Partial<Record<SubmissionStatus, TimelineEntryType>> = {
  revision:  "revision_needed",
  completed: "approved",
  reviewing: "comment",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: submissionId } = await params;
    const body = await req.json() as { status: SubmissionStatus; authorId?: string };
    const { status, authorId } = body;

    const VALID: SubmissionStatus[] = ["submitted", "reviewing", "revision", "completed"];
    if (!VALID.includes(status))
      return NextResponse.json({ error: `Geçersiz status: ${status}` }, { status: 400 });

    const submissionSnap = await adminDb.collection("submissions").doc(submissionId).get();
    if (!submissionSnap.exists)
      return NextResponse.json({ error: `Submission bulunamadı: ${submissionId}` }, { status: 404 });

    const subData = submissionSnap.data()!;

    await updateSubmissionStatus(submissionId, status);

    // activity_log — sadece "completed" durumunda
    if (status === "completed") {
      try {
        const [studentDoc, taskDoc] = await Promise.all([
          adminDb.collection("students").doc(subData.studentId).get(),
          adminDb.collection("tasks").doc(subData.taskId).get(),
        ]);
        const sData = studentDoc.data();
        const studentName = sData
          ? `${sData.name ?? ""} ${sData.surname ?? ""}`.trim() || "Bir öğrenci"
          : "Bir öğrenci";
        const taskName = (taskDoc.data()?.name ?? taskDoc.data()?.title ?? subData.taskId) as string;
        await logActivityAdmin("teslim", "Ödev teslim edildi", `${studentName} — ${taskName}`, authorId ?? "");
      } catch (_) {}
    }

    // Timeline entry ekle
    const timelineType = STATUS_TO_TIMELINE[status];
    if (timelineType && authorId) {
      await createTimelineEntry({
        submissionId,
        studentId: subData.studentId,
        taskId:    subData.taskId,
        groupId:   subData.groupId,
        type:      timelineType,
        data:      {},
        authorId,
      });
    }

    // Öğrenciye bildirim (revision veya completed)
    if (status === "revision" || status === "completed") {
      (async () => {
        try {
          const [studentDoc, taskDoc] = await Promise.all([
            adminDb.collection("students").doc(subData.studentId).get(),
            adminDb.collection("tasks").doc(subData.taskId).get(),
          ]);
          const studentAuthUid = studentDoc.data()?.authUid as string | undefined;
          if (!studentAuthUid) return;

          const taskTitle = (taskDoc.data()?.name ?? taskDoc.data()?.title ?? "Ödeviniz") as string;
          const isRevision = status === "revision";

          await adminDb
            .collection("users").doc(studentAuthUid)
            .collection("notifications").doc()
            .set({
              type:       isRevision ? "message" : "assignment",
              entityId:   subData.taskId,
              senderId:   authorId ?? "system",
              title:      isRevision ? "Revize İstendi" : "Ödeviniz Onaylandı! 🎉",
              preview:    isRevision
                ? `"${taskTitle}" için revize gönderildi.`
                : `"${taskTitle}" tamamlandı, tebrikler!`,
              actionUrl:  `/student/${subData.studentId}/${subData.taskId}`,
              createdAt:  FieldValue.serverTimestamp(),
              isRead:     false,
              isArchived: false,
            });
        } catch (err) {
          console.error("[status] Bildirim hatası:", err);
        }
      })();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[status] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
