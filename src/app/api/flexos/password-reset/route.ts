import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/app/lib/firebase-admin";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { isRateLimited } from "@/app/lib/rate-limit";
import { sendMail } from "@/app/lib/email";

/**
 * POST /api/flexos/password-reset — canlının `/api/password-reset`'iyle AYNI mantık,
 * tek fark: aktivasyon linki `/flexos/giris/aktivasyon`'a gider (canlının `/login/
 * activation`'ı yerine). Firebase Auth hesabı üzerinden çalışır — hangi koleksiyona
 * (canlı `users` mı `flexos_users` mı) ait olduğuna bakmaz, tamamen email tabanlı.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (await isRateLimited(`flexos-pw-reset:${ip}`, 5, 15 * 60 * 1000))
      return NextResponse.json({ error: "Çok fazla istek. 15 dakika bekleyin." }, { status: 429 });

    const body = await req.json() as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email)
      return NextResponse.json({ error: "E-posta zorunludur." }, { status: 400 });

    let userName = "";
    try {
      const userRecord = await adminAuth.getUserByEmail(email);
      userName = userRecord.displayName ?? "";
    } catch {
      // Kullanıcı bulunamazsa bile güvenlik gereği aynı cevabı dön (email enumeration koruması)
      return NextResponse.json({ success: true });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://flex-one-iota.vercel.app";
    const resetLink = await adminAuth.generatePasswordResetLink(email, {
      url: `${appUrl}/flexos/giris`,
    });

    const url = new URL(resetLink);
    const oobCode = url.searchParams.get("oobCode") ?? "";
    const activationLink = `${appUrl}/flexos/giris/aktivasyon?oobCode=${oobCode}`;

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
            <p style="margin:0;font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.5px">flex</p>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px 32px">
            <p style="font-size:20px;font-weight:700;color:#111;margin:0 0 8px">Merhaba${userName ? `, ${userName}` : ""}! 👋</p>
            <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px">
              Hesabın için bir şifre sıfırlama talebi aldık. Aşağıdaki butona tıklayarak yeni şifreni belirleyebilirsin.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px">
              <tr>
                <td align="center">
                  <a href="${activationLink}"
                     style="display:inline-block;background:#FF8D28;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:10px;letter-spacing:0.2px">
                    Yeni Şifremi Belirle →
                  </a>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
              <tr>
                <td style="background:#FFF4EB;border:2px dashed #FF8D28;border-radius:12px;padding:16px 20px;text-align:center">
                  <p style="margin:0;font-size:12px;color:#D66500;font-weight:700;text-transform:uppercase;letter-spacing:1px">Bu link 1 saat geçerlidir</p>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fafafa;border-left:3px solid #FF5C00;border-radius:4px;padding:14px 16px">
                  <p style="margin:0;font-size:13px;color:#666;line-height:1.6">
                    Bu talebi sen yapmadıysan bu e-postayı dikkate alma.<br>
                    Herhangi bir sorunda yöneticinle iletişime geçebilirsin.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#fafafa;border-top:1px solid #f0f0f0;padding:20px 40px">
            <p style="margin:0;font-size:12px;color:#bbb;line-height:1.6">
              Bu mail Flex sistemi tarafından otomatik gönderilmiştir.
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
      subject: "Şifre Sıfırlama — Flex",
      html,
    });

    await adminDb.collection("mailLogs").add({
      to: email,
      name: userName,
      subject: "Şifre Sıfırlama — Flex",
      type: "flexos-password-reset",
      status: result.success ? "success" : "failed",
      messageId: result.messageId ?? null,
      error: result.error ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[flexos/password-reset] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
