import React from "react";
import { render } from "@react-email/components";
import { sendMail, type SendResult } from "@/app/lib/email";
import { OTPTemplate } from "@/app/components/emails/OTPTemplate";

// ─── OTP / Giriş Kodu ────────────────────────────────────────────────────────

export async function sendOTPEmail(
  to: string,
  otp: string,
  name?: string
): Promise<SendResult> {
  const html = await render(React.createElement(OTPTemplate, { otp, name }));

  return sendMail({
    to,
    subject: "Giriş Kodunuz — Tasarım Atölyesi",
    html,
  });
}

// ─── Hoş Geldiniz Maili ──────────────────────────────────────────────────────

export async function sendWelcomeEmail(
  to: string,
  name: string,
  tempPassword?: string
): Promise<SendResult> {
  const passwordBlock = tempPassword
    ? `
      <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 12px">
        Sisteme ilk girişte aşağıdaki geçici parolayı kullan:
      </p>
      <div style="background:#0f0f0f;border-radius:10px;padding:18px 24px;text-align:center;margin:0 0 12px">
        <span style="font-family:monospace;font-size:22px;font-weight:700;color:#fff;letter-spacing:6px">${tempPassword}</span>
      </div>
      <p style="font-size:12px;color:#aaa;margin:0 0 28px">İlk girişten sonra parolanı değiştirmen istenecek.</p>`
    : `<p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 28px">
        Hesabın hazır — sisteme giriş yapmak için aşağıdaki butonu kullan.
      </p>`;

  const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,Arial,sans-serif">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07)">

            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#FF5C00 0%,#7C3AED 100%);padding:32px 40px">
                <p style="margin:0;font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px">
                  tasarım<span style="opacity:0.75">atölyesi</span>
                </p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 40px 32px">
                <p style="font-size:20px;font-weight:700;color:#111;margin:0 0 8px">Hoş geldin, ${name}! 👋</p>
                <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px">
                  Tasarım Atölyesi sistemine kaydın tamamlandı. Artık ödevlerini takip edebilir,<br>
                  puanlarını görebilir ve sıralamada yerini alabilirsin.
                </p>

                ${passwordBlock}

                <a href="https://flex-one-iota.vercel.app/login"
                   style="display:block;background:#FF5C00;color:#fff;text-align:center;
                          text-decoration:none;font-size:15px;font-weight:600;
                          padding:14px 0;border-radius:8px;margin:0 0 32px">
                  Sisteme Giriş Yap →
                </a>

                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#fafafa;border-left:3px solid #FF5C00;border-radius:4px;padding:14px 16px">
                      <p style="margin:0;font-size:13px;color:#666;line-height:1.6">
                        Herhangi bir sorun yaşarsan eğitmeninle iletişime geçebilirsin.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#fafafa;border-top:1px solid #f0f0f0;padding:20px 40px">
                <p style="margin:0;font-size:12px;color:#bbb;line-height:1.6">
                  Bu mail Tasarım Atölyesi sistemi tarafından otomatik gönderilmiştir.<br>
                  Eğer bu hesap sana ait değilse bu maili görmezden gelebilirsin.
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendMail({
    to,
    subject: "Hesabın Oluşturuldu — Tasarım Atölyesi",
    html,
  });
}

// ─── Bildirim Maili ──────────────────────────────────────────────────────────

export async function sendNotificationEmail(
  to: string,
  subject: string,
  message: string,
  name?: string
): Promise<SendResult> {
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:40px auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
      <p style="font-size:22px;font-weight:700;margin:0 0 24px">
        <span style="color:#FF5C00">tasarım</span><span style="color:#7C3AED">atölyesi</span>
      </p>
      ${name ? `<p style="font-size:16px;color:#111;font-weight:600">Merhaba ${name},</p>` : ""}
      <p style="font-size:15px;color:#555;line-height:1.6">${message}</p>
      <hr style="border-color:#eee;margin:24px 0"/>
      <p style="font-size:12px;color:#bbb;margin:0">Bu mail Tasarım Atölyesi sistemi tarafından otomatik gönderilmiştir.</p>
    </div>
  `;

  return sendMail({ to, subject, html });
}

// ─── Toplu Mail ──────────────────────────────────────────────────────────────

export interface BulkMailItem {
  to: string;
  subject: string;
  html: string;
  /**
   * TODO: Ödev PDF gönderiminde her öğrenciye kişisel PDF eklemek için
   *       bu alana { filename, content } dizisi eklenecek.
   */
  attachments?: Array<{ filename: string; content: Buffer | string }>;
}

export async function sendBulkEmails(
  items: BulkMailItem[]
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = await Promise.allSettled(
    items.map((item) => sendMail(item))
  );

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.success) {
      sent++;
    } else {
      failed++;
      const errMsg =
        result.status === "rejected"
          ? String(result.reason)
          : (result.value.error ?? "Bilinmeyen hata");
      errors.push(errMsg);
    }
  }

  console.log(`[emailService] Toplu gönderim: ${sent} başarılı, ${failed} başarısız`);
  return { sent, failed, errors };
}
