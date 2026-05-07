import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";

export async function POST(req: NextRequest) {
  try {
    // Bearer token doğrula
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const callerRole = decoded.role as string | undefined;
    if (callerRole !== "admin" && callerRole !== "instructor" && !decoded.admin) {
      return NextResponse.json({ error: "Yetersiz yetki." }, { status: 403 });
    }

    const body = await req.json() as { studentDocId?: unknown; action?: unknown };
    const { studentDocId, action } = body;

    if (!studentDocId || typeof studentDocId !== "string")
      return NextResponse.json({ error: "studentDocId zorunludur." }, { status: 400 });
    if (action !== "disable" && action !== "enable")
      return NextResponse.json({ error: "action 'disable' veya 'enable' olmalıdır." }, { status: 400 });

    // Öğrenci doc'unu al
    const studentSnap = await adminDb.collection("students").doc(studentDocId).get();
    if (!studentSnap.exists)
      return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const authUid = studentSnap.data()?.authUid as string | undefined;
    if (!authUid)
      return NextResponse.json({ error: "Bu öğrenciye ait Firebase hesabı yok." }, { status: 400 });

    const disabled = action === "disable";

    // Firebase Auth disabled toggle
    await adminAuth.updateUser(authUid, { disabled });

    // Re-enable: kullanıcı daha önce şifresini kurmuş mu kontrol et
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
}
