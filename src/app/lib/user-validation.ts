// Server-side only (Admin SDK bağlamında kullanılır)

export type NewUserRole = "admin" | "instructor" | "student" | "accountant";
export type UserType    = "internal" | "external";

// role → type mapping (client'tan asla alınmaz)
export function getTypeForRole(role: NewUserRole): UserType {
  const internal: NewUserRole[] = ["admin", "instructor", "accountant"];
  return internal.includes(role) ? "internal" : "external";
}

export function validateRole(role: string): role is NewUserRole {
  return ["admin", "instructor", "student", "accountant"].includes(role);
}

// 8 karakter büyük harf + rakam
export function generateActivationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ambiguous chars removed (0,O,1,I)
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export interface ActivationEmailInput {
  name:      string;
  email:     string;
  code:      string;
  expiresAt: Date;
}

export interface EmailTemplate {
  subject: string;
  html:    string;
  text:    string;
}

export function buildActivationEmail(input: ActivationEmailInput): EmailTemplate {
  const { name, email, code, expiresAt } = input;
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/login?email=${encodeURIComponent(email)}&code=${code}`;
  const expiry   = expiresAt.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  const subject = "Tasarım Atölyesi — Aktivasyon Kodunuz";

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#FF6B35;padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Tasarım Atölyesi</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 48px;">
            <h2 style="margin:0 0 16px;font-size:20px;color:#111;">Merhaba ${name},</h2>
            <p style="margin:0 0 24px;color:#444;line-height:1.6;">
              Hesabın oluşturuldu. Aşağıdaki aktivasyon kodunu kullanarak hesabına ilk kez giriş yapabilirsin.
            </p>

            <div style="background:#f9f9f9;border:2px dashed #FF6B35;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
              <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;">Aktivasyon Kodun</p>
              <p style="margin:0;font-size:32px;font-weight:800;letter-spacing:6px;color:#111;font-family:monospace;">${code}</p>
            </div>

            <p style="margin:0 0 24px;color:#444;line-height:1.6;">
              Ya da aşağıdaki butona tıklayarak doğrudan giriş yapabilirsin:
            </p>

            <div style="text-align:center;margin-bottom:32px;">
              <a href="${loginUrl}" style="display:inline-block;background:#FF6B35;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
                Hesabıma Giriş Yap
              </a>
            </div>

            <p style="margin:0 0 8px;color:#888;font-size:13px;">
              Bu kod <strong>${expiry}</strong> tarihine kadar geçerlidir.
            </p>
            <p style="margin:0;color:#bbb;font-size:12px;">
              Bu e-postayı beklemiyor idiysen lütfen dikkate alma.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:20px 48px;border-top:1px solid #eee;text-align:center;">
            <p style="margin:0;color:#aaa;font-size:12px;">© Tasarım Atölyesi — FLEX OS</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const text = [
    `Merhaba ${name},`,
    "",
    "Hesabın oluşturuldu. Aktivasyon kodun: " + code,
    "",
    "Giriş linki: " + loginUrl,
    "",
    `Bu kod ${expiry} tarihine kadar geçerlidir.`,
  ].join("\n");

  return { subject, html, text };
}
