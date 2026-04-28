import { NextRequest, NextResponse } from "next/server";
import { updateSubmission } from "@/app/lib/submissions";
import { adminDb } from "@/app/lib/firebase-admin";
// ✅ NEW VALIDATION START
import {
  verifyRequestToken,
  validateScore,
  validateUserInGroup,
} from "@/app/lib/submission-validation";
// ✅ NEW VALIDATION END

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: submissionId } = await params;
    const body = await req.json() as { grade: number; gradedBy?: string };
    const { grade, gradedBy } = body;

    if (typeof grade !== "number" || grade < 0 || grade > 100)
      return NextResponse.json({ error: "grade 0–100 arası bir sayı olmalıdır." }, { status: 400 });

    // ✅ NEW VALIDATION START
    // 1. Skor aralığı (mevcut kontrole ek olarak yeni helper ile tutarlı)
    if (!validateScore(grade))
      return NextResponse.json({ error: "Puan 0–100 arasında olmalıdır." }, { status: 400 });

    // 2. Caller auth kontrolü (token varsa)
    const caller = await verifyRequestToken(req);
    if (caller) {
      // 3. Öğrenci not veremez
      if (caller.role === "student")
        return NextResponse.json({ error: "Öğrenciler not veremez." }, { status: 403 });
    }
    // ✅ NEW VALIDATION END

    const submissionSnap = await adminDb.collection("submissions").doc(submissionId).get();
    if (!submissionSnap.exists)
      return NextResponse.json({ error: `Submission bulunamadı: ${submissionId}` }, { status: 404 });

    // ✅ NEW VALIDATION START
    // 4. Zaten tamamlanmış submission tekrar not alamaz
    const subData = submissionSnap.data()!;
    if (subData.status === "completed")
      return NextResponse.json({ error: "Zaten onaylanmış gönderim tekrar notlandırılamaz." }, { status: 400 });

    // 5. Caller grubun üyesi mi (token varsa)
    if (caller && subData.groupId) {
      const isMember = await validateUserInGroup(caller.uid, subData.groupId as string);
      if (!isMember)
        return NextResponse.json({ error: "Bu grubun üyesi değilsiniz." }, { status: 403 });
    }
    // ✅ NEW VALIDATION END

    await updateSubmission(submissionId, {
      grade,
      ...(gradedBy ? { gradedBy } : {}),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[grade] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
