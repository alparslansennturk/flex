import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: unknown; code?: unknown; password?: unknown };
    const { email, code, password } = body;

    if (!email || typeof email !== "string")
      return NextResponse.json({ error: "email zorunludur." }, { status: 400 });
    if (!code || typeof code !== "string")
      return NextResponse.json({ error: "Aktivasyon kodu zorunludur." }, { status: 400 });
    if (!password || typeof password !== "string")
      return NextResponse.json({ error: "Şifre zorunludur." }, { status: 400 });

    // Şifre kuralları: min 8 karakter, büyük harf, rakam
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password))
      return NextResponse.json({
        error: "Şifre en az 8 karakter, bir büyük harf ve bir rakam içermelidir.",
      }, { status: 400 });

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCode  = code.trim().toUpperCase();

    // Kodu bul
    const codesSnap = await adminDb.collection("codes")
      .where("email",  "==", normalizedEmail)
      .where("code",   "==", normalizedCode)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (codesSnap.empty)
      return NextResponse.json({ error: "Geçersiz veya kullanılmış aktivasyon kodu." }, { status: 404 });

    const codeDoc  = codesSnap.docs[0];
    const codeData = codeDoc.data();

    // Süre kontrolü
    const expiresAt: Date = codeData.expiresAt?.toDate?.() ?? new Date(0);
    if (expiresAt < new Date())
      return NextResponse.json({ error: "Aktivasyon kodunun süresi dolmuş." }, { status: 410 });

    const userId       = codeData.userId       as string;
    const role         = codeData.role         as string;
    const studentDocId = codeData.studentDocId as string | undefined;

    // Firebase Auth: şifre set et
    const auth = getAuth();
    await auth.updateUser(userId, { password });

    // Firestore: hesabı aktive et
    await adminDb.collection("users").doc(userId).update({
      isActivated:  true,
      status:       "active",
      activatedAt:  FieldValue.serverTimestamp(),
    });

    // Kodu kullanıldı olarak işaretle
    await codeDoc.ref.update({
      status: "used",
      usedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, userId, role, studentDocId: studentDocId ?? userId });

  } catch (err: unknown) {
    console.error("[activation/verify] Hata:", err);
    const message = err instanceof Error ? err.message : "Sunucu hatası.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
