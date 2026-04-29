import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { verifyRequestToken, getMaxUploads } from "@/app/lib/submission-validation";
import type { UploadCountResponse } from "@/app/types/upload";

export async function GET(req: NextRequest) {
  try {
    // 1. Auth — zorunlu
    const caller = await verifyRequestToken(req);
    if (!caller) {
      return NextResponse.json({ error: "Kimlik doğrulaması gerekli." }, { status: 401 });
    }

    // 2. Query params
    const { searchParams } = new URL(req.url);
    const taskId    = searchParams.get("taskId");
    const studentId = searchParams.get("studentId");

    if (!taskId || !studentId) {
      return NextResponse.json(
        { error: "taskId ve studentId query param zorunludur." },
        { status: 400 },
      );
    }

    // 3. Öğrenci başkasının sayısını sorgulayamaz
    // caller.uid = Auth UID, studentId = Firestore doc ID
    if (caller.role === "student") {
      const userDoc = await adminDb.collection("users").doc(caller.uid).get();
      const callerStudentDocId = userDoc.data()?.studentDocId as string | undefined;
      if (callerStudentDocId !== studentId) {
        return NextResponse.json({ error: "Yetki hatası." }, { status: 403 });
      }
    }

    // 4. Mevcut submission sayısı ve latest status
    const snap = await adminDb.collection("submissions")
      .where("studentId", "==", studentId)
      .where("taskId", "==", taskId)
      .get();

    const current = snap.size;
    let latestStatus: string | null = null;

    if (!snap.empty) {
      const sorted = snap.docs
        .map(d => ({ status: d.data().status as string, ts: d.data().submittedAt?.toMillis?.() ?? 0 }))
        .sort((a, b) => b.ts - a.ts);
      latestStatus = sorted[0].status;
    }

    const max       = getMaxUploads(latestStatus);
    const remaining = Math.max(0, max - current);

    const response: UploadCountResponse = { current, max, remaining };
    return NextResponse.json(response);

  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[upload-count] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası.", detail }, { status: 500 });
  }
}
