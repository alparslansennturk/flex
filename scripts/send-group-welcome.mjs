// Grup 598 öğrencilerine giriş bilgisi + aktivasyon kodu maili gönderir
// Kullanım: node scripts/send-group-welcome.mjs [--dry-run]
import { readFileSync } from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// ── .env.local parse ─────────────────────────────────────────────────────────
const envRaw = readFileSync(".env.local", "utf8");
for (const line of envRaw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val   = trimmed.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const GROUP_CODE = "Grup 598";
const DRY_RUN    = process.argv.includes("--dry-run");

// ── Firebase Admin init ───────────────────────────────────────────────────────
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db   = getFirestore();
const auth = getAuth();

// ── Yardımcılar ───────────────────────────────────────────────────────────────
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function sendBrevoMail({ to, subject, html }) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key":      process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept:         "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Tasarım Atölyesi", email: process.env.BREVO_SENDER_EMAIL },
      to:      [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: err };
  }
  const data = await res.json();
  return { success: true, messageId: data.messageId };
}

function buildEmailHtml(name, code, loginLink) {
  return `
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
            <p style="font-size:20px;font-weight:700;color:#111;margin:0 0 8px">Hoş geldin, ${name}! 👋</p>
            <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 16px">
              Tasarım Atölyesi sürecine kaydın başarıyla oluşturuldu.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
              <tr>
                <td style="background:#FFF4EB;border:2px dashed #FF8D28;border-radius:12px;padding:20px 24px;text-align:center">
                  <p style="margin:0 0 6px;font-size:12px;color:#D66500;font-weight:700;text-transform:uppercase;letter-spacing:1px">Aktivasyon Kodun</p>
                  <p style="margin:0;font-size:30px;font-weight:800;letter-spacing:8px;color:#111;font-family:monospace">${code}</p>
                  <p style="margin:8px 0 0;font-size:12px;color:#999">30 gün geçerlidir</p>
                </td>
              </tr>
            </table>
            <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 20px">
              Aşağıdaki butona tıklayarak hesabını aktive edebilir ve şifreni belirleyebilirsin:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px">
              <tr>
                <td align="left">
                  <a href="${loginLink}"
                     style="display:inline-block;background:#FF8D28;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;letter-spacing:0.2px">
                    Hesabımı Aktive Et →
                  </a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fafafa;border-left:3px solid #FF5C00;border-radius:4px;padding:14px 16px">
                  <p style="margin:0;font-size:13px;color:#666;line-height:1.6">
                    Bu mail yalnızca bilgilendirme amaçlıdır.<br>
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
              Bu mail Tasarım Atölyesi sistemi tarafından otomatik gönderilmiştir.<br>
              Eğer bu hesap sana ait değilse bu maili görmezden gelebilirsin.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Ana akış ──────────────────────────────────────────────────────────────────
async function main() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://flex-one-iota.vercel.app";

  console.log(`\n=== Grup ${GROUP_CODE} — Giriş Bilgisi Mail Gönderimi ===`);
  if (DRY_RUN) console.log("⚠️  DRY-RUN modu: mail gönderilmeyecek\n");

  // 1) Grup 598 öğrencilerini çek
  const snap = await db.collection("students")
    .where("groupCode", "==", GROUP_CODE)
    .get();

  if (snap.empty) {
    console.log(`Grup ${GROUP_CODE} için öğrenci bulunamadı.`);
    return;
  }

  console.log(`${snap.docs.length} öğrenci bulundu.\n`);

  let sent = 0, skipped = 0, failed = 0;

  for (const doc of snap.docs) {
    const student      = doc.data();
    const studentDocId = doc.id;
    const email        = student.email?.trim();
    const name         = `${student.name ?? ""} ${student.lastName ?? ""}`.trim();

    if (!email) {
      console.log(`  [ATLA] ${name} — email yok`);
      skipped++;
      continue;
    }

    console.log(`\n→ ${name} <${email}>`);

    // 2) Firebase Auth kullanıcısı oluştur/al
    let uid = student.authUid ?? null;

    try {
      if (!uid) {
        let authUser;
        try {
          authUser = await auth.getUserByEmail(email);
          uid = authUser.uid;
          console.log(`  Auth kullanıcı zaten var: ${uid}`);
        } catch {
          if (!DRY_RUN) {
            authUser = await auth.createUser({ email, displayName: name, emailVerified: false });
            uid = authUser.uid;
            console.log(`  Auth kullanıcı oluşturuldu: ${uid}`);
          } else {
            uid = "DRY-RUN-UID";
            console.log(`  [DRY] Auth kullanıcı oluşturulacaktı`);
          }
        }
      } else {
        console.log(`  Auth UID zaten kayıtlı: ${uid}`);
      }

      if (!DRY_RUN && uid !== "DRY-RUN-UID") {
        // Custom claims
        await auth.setCustomUserClaims(uid, { role: "student", type: "external", studentDocId });

        // users/{uid} doc
        const userDoc = await db.collection("users").doc(uid).get();
        if (!userDoc.exists) {
          await db.collection("users").doc(uid).set({
            uid, email: email.toLowerCase(), name,
            surname: "", roles: ["student"], role: "student",
            type: "external", permissions: [], isInstructor: false,
            isActivated: false, status: "pending_activation",
            studentDocId, createdAt: FieldValue.serverTimestamp(),
          });
        } else if (!userDoc.data()?.studentDocId) {
          await db.collection("users").doc(uid).update({ studentDocId });
        }

        // students docuna authUid yaz
        if (!student.authUid) {
          await db.collection("students").doc(studentDocId).update({ authUid: uid });
        }
      }

      // 3) Mevcut pending kodu kontrol et
      let code = null;
      if (!DRY_RUN && uid !== "DRY-RUN-UID") {
        const existingCodes = await db.collection("codes")
          .where("userId", "==", uid)
          .where("status", "==", "pending")
          .get();

        if (!existingCodes.empty) {
          const existing = existingCodes.docs[0].data();
          const expiresAt = existing.expiresAt?.toDate?.() ?? new Date(0);
          if (expiresAt > new Date()) {
            code = existing.code;
            console.log(`  Mevcut pending kod kullanılıyor: ${code}`);
          }
        }
      }

      // Yeni kod üret
      if (!code) {
        code = generateCode();
        if (!DRY_RUN && uid !== "DRY-RUN-UID") {
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          await db.collection("codes").add({
            code, userId: uid, studentDocId,
            email: email.toLowerCase(),
            role: "student", type: "external",
            createdAt: FieldValue.serverTimestamp(),
            expiresAt, status: "pending",
          });
          console.log(`  Yeni aktivasyon kodu oluşturuldu: ${code}`);
        } else {
          console.log(`  [DRY] Aktivasyon kodu: ${code}`);
        }
      }

      // 4) Mail gönder
      const loginLink = `${appUrl}/login?email=${encodeURIComponent(email)}&code=${code}`;
      const html      = buildEmailHtml(name, code, loginLink);

      if (DRY_RUN) {
        console.log(`  [DRY] Mail gönderilecekti → ${loginLink}`);
        sent++;
        continue;
      }

      const result = await sendBrevoMail({
        to: email, subject: "Hesabın Oluşturuldu — Tasarım Atölyesi", html,
      });

      await db.collection("mailLogs").add({
        to: email, name,
        subject: "Hesabın Oluşturuldu — Tasarım Atölyesi",
        type: "welcome", groupCode: GROUP_CODE,
        status: result.success ? "success" : "failed",
        messageId: result.messageId ?? null,
        error: result.error ?? null, hasCode: true,
        createdAt: FieldValue.serverTimestamp(),
      });

      if (result.success) {
        console.log(`  ✓ Mail gönderildi`);
        sent++;
      } else {
        console.error(`  ✗ Mail hatası: ${result.error}`);
        failed++;
      }

    } catch (err) {
      console.error(`  ✗ Hata: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Tamamlandı ===`);
  console.log(`Gönderildi: ${sent} | Atlandı: ${skipped} | Başarısız: ${failed}`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
