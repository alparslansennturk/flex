import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { isRateLimited } from "@/app/lib/rate-limit";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { sendMail } from "@/app/lib/email";
import { generateActivationCode } from "@/app/lib/user-validation";

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

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (await isRateLimited(`resend:${ip}`, 10, 15 * 60 * 1000))
      return NextResponse.json({ error: "Çok fazla istek. 15 dakika bekleyin." }, { status: 429 });

    const body = await req.json() as { studentDocId?: unknown };
    const { studentDocId } = body;
    if (!studentDocId || typeof studentDocId !== "string")
      return NextResponse.json({ error: "studentDocId zorunludur." }, { status: 400 });

    // Öğrenci bilgilerini al
    const studentSnap = await adminDb.collection("students").doc(studentDocId).get();
    if (!studentSnap.exists)
      return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const student = studentSnap.data()!;
    const authUid = student.authUid as string | undefined;
    const email = student.email as string | undefined;
    const name = `${student.name ?? ""} ${student.lastName ?? ""}`.trim();
    const groupCode = student.groupCode as string | undefined;

    if (!authUid) return NextResponse.json({ error: "Bu öğrenciye ait Firebase hesabı yok." }, { status: 400 });
    if (!email) return NextResponse.json({ error: "Öğrencinin e-posta adresi yok." }, { status: 400 });

    // Eski pending kodları expire et
    const oldCodesSnap = await adminDb.collection("codes")
      .where("userId", "==", authUid)
      .where("status", "==", "pending")
      .get();

    const batch = adminDb.batch();
    oldCodesSnap.docs.forEach(d => batch.update(d.ref, { status: "expired", expiredAt: FieldValue.serverTimestamp() }));
    await batch.commit();

    // Yeni kod üret
    const code = generateActivationCode();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await adminDb.collection("codes").add({
      code,
      userId: authUid,
      studentDocId,
      email: email.toLowerCase(),
      role: "student",
      type: "external",
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      status: "pending",
    });

    // Mail gönder
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://flex-one-iota.vercel.app";
    const loginLink = `${appUrl}/login?email=${encodeURIComponent(email)}&code=${code}`;

    const html = `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07)">

        <tr>
          <td style="background:linear-gradient(90deg,#FF8D28 0%,#D66500 100%);padding:32px 40px">
            <p style="margin:0;font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.5px">tasarımatölyesi</p>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px 32px">
            <p style="font-size:20px;font-weight:700;color:#111;margin:0 0 8px">Merhaba, ${name}! 👋</p>
            <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 16px">
              Aktivasyon kodun yenilendi. Aşağıdaki kodu kullanarak hesabını oluşturabilirsin.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
              <tr>
                <td style="background:#FFF4EB;border:2px dashed #FF8D28;border-radius:12px;padding:20px 24px;text-align:center">
                  <p style="margin:0 0 6px;font-size:12px;color:#D66500;font-weight:700;text-transform:uppercase;letter-spacing:1px">Yeni Aktivasyon Kodun</p>
                  <p style="margin:0;font-size:30px;font-weight:800;letter-spacing:8px;color:#111;font-family:monospace">${code}</p>
                  <p style="margin:8px 0 0;font-size:12px;color:#999">30 gün geçerlidir</p>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px">
              <tr>
                <td align="left">
                  <a href="${loginLink}"
                     style="display:inline-block;background:#FF8D28;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;letter-spacing:0.2px">
                    Hesabımı Oluştur →
                  </a>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fafafa;border-left:3px solid #FF5C00;border-radius:4px;padding:14px 16px">
                  <p style="margin:0;font-size:13px;color:#666;line-height:1.6">
                    Önceki aktivasyon kodun artık geçersizdir.<br>
                    Herhangi bir sorunda eğitmeninle iletişime geçebilirsin.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#fafafa;border-top:1px solid #f0f0f0;padding:20px 40px">
            <p style="margin:0;font-size:12px;color:#bbb;line-height:1.6">
              Bu mail Tasarım Atölyesi sistemi tarafından otomatik gönderilmiştir.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const result = await sendMail({
      to: email,
      subject: "Yeni Aktivasyon Kodun — Tasarım Atölyesi",
      html,
    });

    await adminDb.collection("mailLogs").add({
      to: email,
      name,
      subject: "Yeni Aktivasyon Kodun — Tasarım Atölyesi",
      type: "resend-activation",
      groupCode: groupCode ?? null,
      status: result.success ? "success" : "failed",
      messageId: result.messageId ?? null,
      error: result.error ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (!result.success)
      return NextResponse.json({ error: result.error }, { status: 500 });

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    console.error("[resend-activation] Hata:", err);
    const message = err instanceof Error ? err.message : "Sunucu hatası.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
