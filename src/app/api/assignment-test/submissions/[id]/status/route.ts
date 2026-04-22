import { NextRequest, NextResponse } from "next/server";
import { updateSubmissionStatus } from "@/app/lib/submissions";
import { createTimelineEntry } from "@/app/lib/submission-timeline";
import { adminDb } from "@/app/lib/firebase-admin";
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[status] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
