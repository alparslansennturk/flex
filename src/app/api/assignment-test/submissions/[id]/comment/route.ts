import { NextRequest, NextResponse } from "next/server";
import { createComment } from "@/app/lib/submission-comments";
import { createTimelineEntry } from "@/app/lib/submission-timeline";
import { adminDb } from "@/app/lib/firebase-admin";
import type { CommentAuthorType } from "@/app/types/submission";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: submissionId } = await params;
    const body = await req.json() as {
      authorId: string;
      authorType: CommentAuthorType;
      text: string;
    };

    const { authorId, authorType, text } = body;
    if (!authorId || !authorType || !text?.trim())
      return NextResponse.json({ error: "authorId, authorType, text zorunludur." }, { status: 400 });

    // Submission'ın varlığını doğrula
    const submissionSnap = await adminDb.collection("submissions").doc(submissionId).get();
    if (!submissionSnap.exists)
      return NextResponse.json({ error: `Submission bulunamadı: ${submissionId}` }, { status: 404 });

    const subData = submissionSnap.data()!;

    // Yorumu kaydet
    const comment = await createComment(submissionId, authorId, authorType, text.trim());

    // Timeline entry ekle
    await createTimelineEntry({
      submissionId,
      studentId: subData.studentId,
      taskId:    subData.taskId,
      groupId:   subData.groupId,
      type:      "comment",
      data:      { commentId: comment.id },
      authorId,
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    console.error("[comment] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
