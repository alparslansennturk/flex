import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/app/lib/firebase-admin";
import { verifyRequestToken } from "@/app/lib/submission-validation";

// POST /api/admin/fix-student-link
// Aynı email farklı gruba atandığında users/{uid}.studentDocId'nin
// eski doc'a kilitlenme sorununu düzeltir.
//
// Body: { email: string }
// Yaptığı:
//   1. Email → Firebase Auth uid
//   2. students koleksiyonunda authUid=uid ve status=active olan doc bul
//   3. users/{uid}.studentDocId'yi o doc'a güncelle
//   4. Firebase Auth custom claims'i güncelle

export async function POST(req: NextRequest) {
  const caller = await verifyRequestToken(req);
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body bekleniyor." }, { status: 400 });
  }

  const { email } = body;
  if (!email?.trim()) {
    return NextResponse.json({ error: "email zorunludur." }, { status: 400 });
  }

  try {
    // 1. Firebase Auth'tan uid al
    const authUser = await adminAuth.getUserByEmail(email.trim());
    const uid = authUser.uid;

    // 2. users doc'taki mevcut studentDocId
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const oldStudentDocId = userDoc.data()?.studentDocId as string | undefined;

    // 3. students koleksiyonunda bu uid'ye bağlı aktif öğrenciyi bul
    const activeSnap = await adminDb.collection("students")
      .where("authUid", "==", uid)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (activeSnap.empty) {
      // Aktif bulunamazsa tüm authUid eşleşenlerini listele (tanı için)
      const allSnap = await adminDb.collection("students")
        .where("authUid", "==", uid)
        .get();
      return NextResponse.json({
        error: "Bu email için aktif öğrenci bulunamadı.",
        allMatches: allSnap.docs.map(d => ({
          id: d.id, status: d.data().status, groupId: d.data().groupId,
        })),
      }, { status: 404 });
    }

    const correctDoc   = activeSnap.docs[0];
    const newStudentDocId = correctDoc.id;

    if (oldStudentDocId === newStudentDocId) {
      return NextResponse.json({
        message: "Zaten doğru. Güncelleme gerekmedi.",
        studentDocId: newStudentDocId,
      });
    }

    // 4. users doc güncelle
    await adminDb.collection("users").doc(uid).update({ studentDocId: newStudentDocId });

    // 5. Firebase Auth custom claims güncelle
    const existingClaims = authUser.customClaims ?? {};
    await adminAuth.setCustomUserClaims(uid, {
      ...existingClaims,
      studentDocId: newStudentDocId,
    });

    console.log(`[fix-student-link] ${email} → ${oldStudentDocId ?? "yok"} → ${newStudentDocId}`);

    return NextResponse.json({
      success:       true,
      email,
      uid,
      oldStudentDocId: oldStudentDocId ?? null,
      newStudentDocId,
      studentData: {
        name:    correctDoc.data().name,
        groupId: correctDoc.data().groupId,
        status:  correctDoc.data().status,
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[fix-student-link]", err);
    return NextResponse.json({ error: "Sunucu hatası.", detail }, { status: 500 });
  }
}
