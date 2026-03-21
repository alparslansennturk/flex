import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// ─── Tip Tanımları ──────────────────────────────────────────────────────────

export interface MailOptions {
  to: string | string[];
  subject: string;
  /** Düz metin fallback (opsiyonel) */
  text?: string;
  /** HTML içerik */
  html: string;
  /**
   * Opsiyonel ek listesi — Buffer veya Base64 string destekler.
   *
   * TODO: Yarın ödev PDF gönderiminde bu alan kullanılacak.
   *       Örnek: { filename: "odev.pdf", content: pdfBuffer }
   *
   * TODO: İleride sertifika PDF'i de aynı yapıyla buraya eklenecek.
   *       Örnek: { filename: "sertifika.pdf", content: certBase64, encoding: "base64" }
   */
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    encoding?: "base64" | "utf-8";
    contentType?: string;
  }>;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── Transporter Singleton ───────────────────────────────────────────────────

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error(
      "GMAIL_USER ve GMAIL_APP_PASSWORD environment variable'ları tanımlı olmalı."
    );
  }

  _transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  return _transporter;
}

// ─── Gönderici Adresi ────────────────────────────────────────────────────────

export function getFromAddress(): string {
  return `Tasarım Atölyesi <${process.env.GMAIL_USER}>`;
}

// ─── Core: Mail Gönder ───────────────────────────────────────────────────────

export async function sendMail(options: MailOptions): Promise<SendResult> {
  try {
    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from: getFromAddress(),
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });

    return { success: true, messageId: info.messageId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[email] Gönderim hatası:", message);
    return { success: false, error: message };
  }
}

// ─── Bağlantı Testi ──────────────────────────────────────────────────────────

export async function testConnection(): Promise<boolean> {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log("[email] Gmail SMTP bağlantısı başarılı.");
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[email] Gmail SMTP bağlantı hatası:", message);
    return false;
  }
}
