import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/app/lib/firebase-admin";
import { sendWelcomeEmail } from "@/app/services/emailService";
import { withAuth } from "@/app/lib/with-auth";

// Koruma: ADMIN_SECRET header zorunlu
// Örnek çağrı:
//   curl -X POST https://<domain>/api/admin/send-welcome-all \
//        -H "x-admin-secret: <ADMIN_SECRET değeri>"

async function handler(_req: NextRequest) {
  try {
    const studentsSnap = await adminDb
      .collection("students")
      .where("status", "==", "active")
      .get();

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const doc of studentsSnap.docs) {
      const student = doc.data();

      if (student.welcomeEmailSent === true) {
        skipped++;
        continue;
      }

      if (!student.email?.trim()) {
        skipped++;
        continue;
      }

      const name = `${student.name ?? ""} ${student.lastName ?? ""}`.trim();
      const result = await sendWelcomeEmail(student.email.trim(), name);

      await adminDb.collection("mailLogs").add({
        to: student.email.trim(),
        name,
        subject: "Hesabın Oluşturuldu — Flex",
        type: "welcome",
        groupCode: student.groupCode ?? null,
        status: result.success ? "success" : "failed",
        messageId: result.messageId ?? null,
        error: result.error ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });

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

export const POST = withAuth(handler, { allowAdminSecret: true });
