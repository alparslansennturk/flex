import { NextRequest, NextResponse } from "next/server";
import { updateSubmission } from "@/app/lib/submissions";
import { adminDb } from "@/app/lib/firebase-admin";

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

    const submissionSnap = await adminDb.collection("submissions").doc(submissionId).get();
    if (!submissionSnap.exists)
      return NextResponse.json({ error: `Submission bulunamadı: ${submissionId}` }, { status: 404 });

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
