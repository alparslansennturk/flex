import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/app/lib/firebase-admin";

// POST /api/student/sync
// Öğrenci login sonrası: students/{studentDocId}.authUid eksik veya yanlışsa düzeltir.
// Güvenlik: users/{uid}.studentDocId alanı (admin tarafından set edilmiş) ile eşleşme zorunlu.

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // users doc'tan studentDocId bul (admin tarafından set edildi — yetkili kaynak)
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

    let studentDocId = userDoc.data()?.studentDocId as string | undefined;

    // users doc'ta yoksa students koleksiyonunda authUid ile ara — sadece aktif öğrenci
    if (!studentDocId) {
      const snap = await adminDb.collection("students")
        .where("authUid", "==", uid)
        .where("status", "==", "active")
        .limit(1)
        .get();
      if (!snap.empty) {
        studentDocId = snap.docs[0].id;
        // users doc'a da yaz — ileride hızlanır
        await adminDb.collection("users").doc(uid).update({ studentDocId });
        console.log(`[student/sync] studentDocId users doc'a yazıldı: ${uid} → ${studentDocId}`);
      }
    }

    if (!studentDocId) return NextResponse.json({ success: true, skipped: true });

    // students doc'ta authUid zaten doğruysa skip
    const studentRef = adminDb.collection("students").doc(studentDocId);
    const studentDoc = await studentRef.get();
    if (!studentDoc.exists) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const updates: Promise<unknown>[] = [];

    if (studentDoc.data()?.authUid !== uid) {
      updates.push(studentRef.update({ authUid: uid }));
      console.log(`[student/sync] authUid güncellendi: ${studentDocId} → ${uid}`);
    }

    // Claims eksik veya yanlış studentDocId içeriyorsa güncelle
    if (!decoded.studentDocId || decoded.studentDocId !== studentDocId) {
      const existingClaims = decoded as Record<string, unknown>;
      const claimsToSet: Record<string, unknown> = {
        role: existingClaims.role || "student",
        studentDocId,
      };
      if (existingClaims.type) claimsToSet.type = existingClaims.type;
      updates.push(adminAuth.setCustomUserClaims(uid, claimsToSet));
      console.log(`[student/sync] claims güncellendi: ${uid} → studentDocId=${studentDocId}`);
    }

    await Promise.all(updates);
    return NextResponse.json({ success: true, updated: updates.length > 0, claimsUpdated: !decoded.studentDocId && !!studentDocId });

  } catch (err) {
    console.error("[student/sync]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
