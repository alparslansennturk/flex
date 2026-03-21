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
  tempPassword: string
): Promise<SendResult> {
  // TODO: Yarın WelcomeTemplate.tsx oluşturulacak — şimdilik sade HTML
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:40px auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
      <p style="font-size:22px;font-weight:700;margin:0 0 24px">
        <span style="color:#FF5C00">tasarım</span><span style="color:#7C3AED">atölyesi</span>
      </p>
      <p style="font-size:16px;color:#111;font-weight:600">Merhaba ${name},</p>
      <p style="font-size:15px;color:#555;line-height:1.6">
        Hesabın oluşturuldu. Sisteme ilk girişte aşağıdaki geçici parolayı kullan.
      </p>
      <div style="background:#111;border-radius:12px;padding:20px;text-align:center;margin:24px 0">
        <span style="font-size:24px;font-weight:700;color:#fff;letter-spacing:4px">${tempPassword}</span>
      </div>
      <p style="font-size:13px;color:#999">İlk girişten sonra parolani değiştirmen istenecek.</p>
      <a href="https://flex-one-iota.vercel.app/login" style="display:block;background:#FF5C00;color:#fff;text-align:center;text-decoration:none;font-size:15px;font-weight:600;padding:14px 0;border-radius:8px;margin:24px 0">Giriş Yap</a>
      <hr style="border-color:#eee;margin:24px 0"/>
      <p style="font-size:12px;color:#bbb;margin:0">Bu mail Tasarım Atölyesi sistemi tarafından otomatik gönderilmiştir.</p>
    </div>
  `;

  return sendMail({
    to,
    subject: "Hesabınız Oluşturuldu — Tasarım Atölyesi",
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
