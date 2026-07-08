import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { isRateLimited } from "@/app/lib/rate-limit";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";

/**
 * POST /api/flexos/activation/verify — FlexOS kullanıcı ilk aktivasyonu.
 * Canlının `/api/activation/verify`'ıyla AYNI mantık, ayrı koleksiyonlar üzerinde
 * (`flexos_codes`/`flexos_users` — canlı `codes`/`users`'a hiç dokunulmaz). Public
 * (auth gerektirmez — kullanıcı henüz login olamıyor, kimliğini kod+email ile kanıtlar).
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (await isRateLimited(`flexos-activation:${ip}`, 10, 15 * 60 * 1000))
    return NextResponse.json({ error: "Çok fazla deneme. 15 dakika bekleyin." }, { status: 429 });

  try {
    const body = await req.json() as { email?: unknown; code?: unknown; password?: unknown };
    const { email, code, password } = body;

    if (!email || typeof email !== "string")
      return NextResponse.json({ error: "email zorunludur." }, { status: 400 });
    if (!code || typeof code !== "string")
      return NextResponse.json({ error: "Aktivasyon kodu zorunludur." }, { status: 400 });
    if (!password || typeof password !== "string")
      return NextResponse.json({ error: "Şifre zorunludur." }, { status: 400 });

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password))
      return NextResponse.json({
        error: "Şifre en az 8 karakter, bir büyük harf ve bir rakam içermelidir.",
      }, { status: 400 });

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCode = code.trim().toUpperCase();

    const codesSnap = await adminDb.collection("flexos_codes")
      .where("email", "==", normalizedEmail)
      .where("code", "==", normalizedCode)
      .where("status", "==", "pending")
      .where("tenantId", "==", DEFAULT_TENANT)
      .limit(1)
      .get();

    if (codesSnap.empty)
      return NextResponse.json({ error: "Geçersiz veya kullanılmış aktivasyon kodu." }, { status: 404 });

    const codeDoc = codesSnap.docs[0];
    const codeData = codeDoc.data();

    const expiresAt: Date = codeData.expiresAt?.toDate?.() ?? new Date(0);
    if (expiresAt < new Date())
      return NextResponse.json({ error: "Aktivasyon kodunun süresi dolmuş." }, { status: 410 });

    const flexosUserId = codeData.flexosUserId as string;

    const userRef = adminDb.collection("flexos_users").doc(flexosUserId);
    const userSnap = await userRef.get();
    if (!userSnap.exists || userSnap.data()?.tenantId !== DEFAULT_TENANT)
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    const authUid = userSnap.data()?.authUid as string | undefined;
    if (!authUid)
      return NextResponse.json({ error: "Bu kullanıcının hesabı bağlı değil." }, { status: 400 });

    await adminAuth.updateUser(authUid, { password, emailVerified: true });

    await userRef.update({ status: "aktif", updatedAt: new Date().toISOString() });

    await codeDoc.ref.update({ status: "used", usedAt: FieldValue.serverTimestamp() });

    return NextResponse.json({ success: true, flexosUserId });
  } catch (err: unknown) {
    console.error("[flexos/activation/verify] Hata:", err);
    const message = err instanceof Error ? err.message : "Sunucu hatası.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
