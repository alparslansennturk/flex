import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { sendMail } from "@/app/lib/email";
import { generateActivationCode } from "@/app/lib/user-validation";

export async function POST(req: NextRequest) {
  try {
    const { email, name, groupCode, groupId, studentDocId } = await req.json();

    if (!email || !name)
      return NextResponse.json({ error: "email ve name zorunludur." }, { status: 400 });

    // ── Firebase Auth kullanıcısı oluştur (email varsa) ──────────────────────
    let uid: string | null = null;
    let code: string | null = null;

    if (email?.trim() && studentDocId) {
      try {
        const auth = getAuth();

        // Daha önce oluşturulmuş mu kontrol et
        let authUser;
        try {
          authUser = await auth.getUserByEmail(email.trim());
          uid = authUser.uid;
        } catch {
          // Yoksa oluştur
          authUser = await auth.createUser({
            email:         email.trim(),
            displayName:   name,
            emailVerified: false,
          });
          uid = authUser.uid;
        }

        // Custom claims set et
        await auth.setCustomUserClaims(uid, { role: "student", type: "external" });

        // users/{uid} doc oluştur
        const userDoc = await adminDb.collection("users").doc(uid).get();
        if (!userDoc.exists) {
          await adminDb.collection("users").doc(uid).set({
            uid,
            email:        email.trim().toLowerCase(),
            name,
            surname:      "",
            roles:        ["student"],
            role:         "student",
            type:         "external",
            permissions:  [],
            isInstructor: false,
            isActivated:  false,
            status:       "pending_activation",
            studentDocId, // login yönlendirmesi için
            createdAt:    FieldValue.serverTimestamp(),
          });
        } else {
          // Zaten varsa studentDocId'yi güncelle (eksikse)
          if (!userDoc.data()?.studentDocId) {
            await adminDb.collection("users").doc(uid).update({ studentDocId });
          }
        }

        // students/{studentDocId} docuna authUid ekle
        await adminDb.collection("students").doc(studentDocId).update({ authUid: uid });

        // Aktivasyon kodu üret
        code = generateActivationCode();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await adminDb.collection("codes").add({
          code,
          userId:       uid,
          studentDocId, // portal URL için
          email:        email.trim().toLowerCase(),
          role:         "student",
          type:         "external",
          createdAt:    FieldValue.serverTimestamp(),
          expiresAt,
          status:       "pending",
        });

        // Membership (groupId varsa)
        if (groupId) {
          await adminDb.collection("memberships").add({
            userId:    uid,
            groupId,
            role:      "student",
            status:    "active",
            createdAt: FieldValue.serverTimestamp(),
          });
        }

      } catch (authErr) {
        console.error("[welcome] Auth/kod oluşturma hatası:", authErr);
        // Auth hatası maili engellemesin — devam et
      }
    }

    // ── Email gönder ─────────────────────────────────────────────────────────
    const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "https://flex-one-iota.vercel.app";
    const loginLink = code
      ? `${appUrl}/login?email=${encodeURIComponent(email.trim())}&code=${code}`
      : `${appUrl}/league`;

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
            <p style="font-size:20px;font-weight:700;color:#111;margin:0 0 8px">Hoş geldin, ${name}! 👋</p>
            <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 16px">
              Tasarım Atölyesi sürecine kaydın başarıyla oluşturuldu.
            </p>

            ${code ? `
            <!-- Aktivasyon Kodu -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
              <tr>
                <td style="background:#FFF4EB;border:2px dashed #FF8D28;border-radius:12px;padding:20px 24px;text-align:center">
                  <p style="margin:0 0 6px;font-size:12px;color:#D66500;font-weight:700;text-transform:uppercase;letter-spacing:1px">Aktivasyon Kodun</p>
                  <p style="margin:0;font-size:30px;font-weight:800;letter-spacing:8px;color:#111;font-family:monospace">${code}</p>
                  <p style="margin:8px 0 0;font-size:12px;color:#999">30 gün geçerlidir</p>
                </td>
              </tr>
            </table>
            ` : ""}

            <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 20px">
              Aşağıdaki butona tıklayarak hesabını aktive edebilir ve şifreni belirleyebilirsin:
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px">
              <tr>
                <td align="left">
                  <a href="${loginLink}"
                     style="display:inline-block;background:#FF8D28;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;letter-spacing:0.2px">
                    ${code ? "Hesabımı Aktive Et →" : "Lig Sıralamama Git →"}
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

    const result = await sendMail({
      to:      email.trim(),
      subject: "Hesabın Oluşturuldu — Tasarım Atölyesi",
      html,
    });

    await adminDb.collection("mailLogs").add({
      to:        email.trim(),
      name,
      subject:   "Hesabın Oluşturuldu — Tasarım Atölyesi",
      type:      "welcome",
      groupCode: groupCode ?? null,
      status:    result.success ? "success" : "failed",
      messageId: result.messageId ?? null,
      error:     result.error ?? null,
      hasCode:   !!code,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (!result.success)
      return NextResponse.json({ error: result.error }, { status: 500 });

    return NextResponse.json({ success: true, messageId: result.messageId });

  } catch (err) {
    console.error("[welcome/route] Beklenmeyen hata:", err);
    return NextResponse.json({ error: "Sunucu hatası oluştu." }, { status: 500 });
  }
}
