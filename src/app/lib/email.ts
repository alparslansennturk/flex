// ─── Tip Tanımları ──────────────────────────────────────────────────────────

export interface MailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html: string;
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

// ─── Core: Mail Gönder ───────────────────────────────────────────────────────

export async function sendMail(options: MailOptions): Promise<SendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  if (!apiKey || !senderEmail) {
    throw new Error("BREVO_API_KEY ve BREVO_SENDER_EMAIL environment variable'ları tanımlı olmalı.");
  }

  const toList = Array.isArray(options.to) ? options.to : [options.to];

  const body: Record<string, unknown> = {
    sender: { name: "Tasarım Atölyesi", email: senderEmail },
    to: toList.map(email => ({ email })),
    subject: options.subject,
    htmlContent: options.html,
  };

  if (options.text) {
    body.textContent = options.text;
  }

  if (options.attachments?.length) {
    body.attachment = options.attachments.map(a => ({
      name: a.filename,
      content: typeof a.content === "string"
        ? a.content
        : a.content.toString("base64"),
    }));
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[email] Brevo hatası:", errText);
      return { success: false, error: errText };
    }

    const data = await res.json();
    return { success: true, messageId: data.messageId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[email] Gönderim hatası:", message);
    return { success: false, error: message };
  }
}
