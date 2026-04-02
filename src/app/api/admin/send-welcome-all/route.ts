import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { sendWelcomeEmail } from "@/app/services/emailService";

// Koruma: ADMIN_SECRET header zorunlu
// Örnek çağrı:
//   curl -X POST https://<domain>/api/admin/send-welcome-all \
//        -H "x-admin-secret: <ADMIN_SECRET değeri>"

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const studentsSnap = await adminDb
      .collection("students")
      .where("welcomeEmailSent", "!=", true)
      .get();

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const doc of studentsSnap.docs) {
      const student = doc.data();

      if (!student.email?.trim()) {
        skipped++;
        continue;
      }

      const name = `${student.name ?? ""} ${student.lastName ?? ""}`.trim();
      const result = await sendWelcomeEmail(student.email.trim(), name);

      if (result.success) {
        await doc.ref.update({ welcomeEmailSent: true });
        sent++;
      } else {
        failed++;
        errors.push(`${student.email}: ${result.error}`);
        console.error("[send-welcome-all] Başarısız:", student.email, result.error);
      }
    }

    console.log(`[send-welcome-all] Tamamlandı: ${sent} gönderildi, ${skipped} atlandı, ${failed} başarısız`);
    return NextResponse.json({ success: true, sent, skipped, failed, errors });

  } catch (err) {
    console.error("[send-welcome-all] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
