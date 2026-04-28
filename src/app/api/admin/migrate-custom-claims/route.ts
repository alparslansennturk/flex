import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getTypeForRole, type NewUserRole } from "@/app/lib/user-validation";

// Tek seferlik migration: mevcut users'a Firebase custom claims set eder.
// Çağrı: POST /api/admin/migrate-custom-claims
//         Header: x-admin-secret: <ADMIN_SECRET>

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = getAuth();
  const usersSnap = await adminDb.collection("users").get();

  let updated  = 0;
  let skipped  = 0;
  let failed   = 0;
  const errors: string[] = [];

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const uid  = doc.id;

    // Rol belirle: önce tekil role, yoksa roles dizisinin ilki
    const role: string = data.role || data.roles?.[0] || "";

    if (!role) {
      skipped++;
      errors.push(`${uid} (${data.email}): rol bulunamadı, atlandı`);
      continue;
    }

    const validRoles: NewUserRole[] = ["admin", "instructor", "student", "accountant"];
    const typedRole = validRoles.includes(role as NewUserRole)
      ? (role as NewUserRole)
      : "instructor"; // bilinmeyen rol → internal olarak kabul et

    const type = getTypeForRole(typedRole);

    try {
      // Mevcut custom claim'i kontrol et — aynıysa güncelleme yapma
      const authUser = await auth.getUser(uid);
      const existing = authUser.customClaims ?? {};

      if (existing.role === typedRole && existing.type === type) {
        skipped++;
        continue;
      }

      await auth.setCustomUserClaims(uid, { role: typedRole, type });
      updated++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Firebase Auth'da hesabı olmayan Firestore kaydı — atla
      if (message.includes("no user record")) {
        skipped++;
        errors.push(`${uid} (${data.email}): Firebase Auth kaydı yok, atlandı`);
      } else {
        failed++;
        errors.push(`${uid} (${data.email}): ${message}`);
      }
    }
  }

  return NextResponse.json({
    success: true,
    total:   usersSnap.size,
    updated,
    skipped,
    failed,
    errors:  errors.length > 0 ? errors : undefined,
    message: `Migration tamamlandı: ${updated} güncellendi, ${skipped} atlandı, ${failed} hata.`,
  });
}
