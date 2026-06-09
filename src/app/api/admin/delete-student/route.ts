import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/app/lib/firebase-admin";
import { verifyRequestToken } from "@/app/lib/submission-validation";

export async function POST(req: NextRequest) {
  const caller = await verifyRequestToken(req);
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  let body: { studentDocId: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON body bekleniyor." }, { status: 400 }); }

  const { studentDocId } = body;
  if (!studentDocId) return NextResponse.json({ error: "studentDocId zorunludur." }, { status: 400 });

  const studentRef = adminDb.collection("students").doc(studentDocId);
  const studentDoc = await studentRef.get();
  if (!studentDoc.exists) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

  const authUid = studentDoc.data()?.authUid as string | undefined;

  await studentRef.delete();

  if (authUid) {
    await adminDb.collection("users").doc(authUid).delete();
    try {
      await adminAuth.deleteUser(authUid);
    } catch {
      // Auth hesabı zaten silinmiş olabilir
    }
  }

  return NextResponse.json({ success: true, studentDocId, authUid: authUid ?? null });
}
