import { NextRequest, NextResponse } from "next/server";
import { createComment } from "@/app/lib/submission-comments";
import { createTimelineEntry } from "@/app/lib/submission-timeline";
import { adminDb } from "@/app/lib/firebase-admin";
import type { CommentAuthorType } from "@/app/types/submission";
// ✅ NEW VALIDATION START
import {
  verifyRequestToken,
  validateNonEmptyText,
  validateUserInGroup,
  validateStudentOwnsSubmission,
} from "@/app/lib/submission-validation";
// ✅ NEW VALIDATION END

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

    // ✅ NEW VALIDATION START
    // 1. Boş metin hard-fail
    if (!validateNonEmptyText(text))
      return NextResponse.json({ error: "Yorum boş olamaz." }, { status: 400 });
    // ✅ NEW VALIDATION END

    // Submission'ın varlığını doğrula (existing — DO NOT MODIFY)
    const submissionSnap = await adminDb.collection("submissions").doc(submissionId).get();
    if (!submissionSnap.exists)
      return NextResponse.json({ error: `Submission bulunamadı: ${submissionId}` }, { status: 404 });

    const subData = submissionSnap.data()!;

    // ✅ NEW VALIDATION START
    // 2. Token varsa ek güvenlik kontrolleri uygula
    const caller = await verifyRequestToken(req);
    if (caller) {
      // 3. Grup üyeliği doğrula
      const isMember = await validateUserInGroup(caller.uid, subData.groupId as string);
      if (!isMember)
        return NextResponse.json({ error: "Bu grubun üyesi değilsiniz." }, { status: 403 });

      // 4. Öğrenci sadece kendi submission'ına yorum yapabilir
      if (!validateStudentOwnsSubmission(caller.uid, subData.studentId as string, caller.role))
        return NextResponse.json({ error: "Başkasının gönderisine yorum yapılamaz." }, { status: 403 });
    }
    // ✅ NEW VALIDATION END

    // Yorumu kaydet (existing — DO NOT MODIFY)
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
