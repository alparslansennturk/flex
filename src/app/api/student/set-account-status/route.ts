import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { withAuth } from "@/app/lib/with-auth";

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json() as { studentDocId?: unknown; action?: unknown };
    const { studentDocId, action } = body;

    if (!studentDocId || typeof studentDocId !== "string")
      return NextResponse.json({ error: "studentDocId zorunludur." }, { status: 400 });
    if (action !== "disable" && action !== "enable")
      return NextResponse.json({ error: "action 'disable' veya 'enable' olmalıdır." }, { status: 400 });

    const studentSnap = await adminDb.collection("students").doc(studentDocId).get();
    if (!studentSnap.exists)
      return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const authUid = studentSnap.data()?.authUid as string | undefined;
    if (!authUid)
      return NextResponse.json({ error: "Bu öğrenciye ait Firebase hesabı yok." }, { status: 400 });

    const disabled = action === "disable";
    await getAuth().updateUser(authUid, { disabled });

    let newAccountStatus: string;
    if (disabled) {
      newAccountStatus = "disabled";
    } else {
      const usersDoc = await adminDb.collection("users").doc(authUid).get();
      const isActivated = usersDoc.data()?.isActivated ?? false;
      newAccountStatus = isActivated ? "active" : "pending";
    }

    await adminDb.collection("students").doc(studentDocId).update({
      accountStatus: newAccountStatus,
      accountStatusUpdatedAt: new Date(),
    });

    return NextResponse.json({ success: true, accountStatus: newAccountStatus });

  } catch (err: unknown) {
    console.error("[student/set-account-status] Hata:", err);
    const message = err instanceof Error ? err.message : "Sunucu hatası.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { roles: ["admin", "instructor"] });
