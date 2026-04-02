import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { sendMail } from "@/app/lib/email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ayın 1'inde çalışır — "geçen ay" YYYY-MM anahtarı ile duplicate koruması
  const now = new Date(new Date().getTime() + 3 * 60 * 60 * 1000); // UTC+3
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = prevMonth.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

  try {
    // Duplicate kontrolü
    const winnerDocRef = adminDb.collection("monthly_winners").doc(monthKey);
    const winnerDoc = await winnerDocRef.get();
    if (winnerDoc.exists) {
      return NextResponse.json({ success: true, skipped: true, reason: "already_sent", month: monthKey });
    }

    // Aktif öğrencileri skora göre sırala
    const studentsSnap = await adminDb
      .collection("students")
      .where("status", "==", "active")
      .orderBy("score", "desc")
      .limit(1)
      .get();

    if (studentsSnap.empty) {
      return NextResponse.json({ success: true, skipped: true, reason: "no_students" });
    }

    const winner = studentsSnap.docs[0].data();
    if (!winner.email) {
      return NextResponse.json({ success: true, skipped: true, reason: "no_email" });
    }

    const winnerName = `${winner.name} ${winner.lastName}`;
    const score = winner.score ?? 0;

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
                <td style="background:linear-gradient(135deg,#FF5C00 0%,#7C3AED 100%);padding:32px 40px;text-align:center">
                  <p style="margin:0 0 8px;font-size:36px">🏆</p>
                  <p style="margin:0;font-size:22px;font-weight:800;color:#fff">Ayın Birincisi</p>
                  <p style="margin:4px 0 0;font-size:14px;color:rgba(255,255,255,0.8)">${monthLabel}</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:36px 40px 32px;text-align:center">
                  <p style="font-size:22px;font-weight:700;color:#111;margin:0 0 12px">
                    Tebrikler, ${winnerName}! 🎉
                  </p>
                  <p style="font-size:15px;color:#555;line-height:1.7;margin:0 0 28px">
                    ${monthLabel} ayında <strong>${score} puan</strong> ile sınıfının birincisi oldun.<br>
                    Harika bir performans — bu başarı seni beklenenden daha ileri götürecek.
                  </p>

                  <div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:12px;padding:20px 24px;margin:0 0 28px;display:inline-block;width:100%;box-sizing:border-box">
                    <p style="margin:0;font-size:13px;color:#7C3AED;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Aylık Puan</p>
                    <p style="margin:4px 0 0;font-size:32px;font-weight:800;color:#111">${score}</p>
                  </div>

                  <a href="https://flex-one-iota.vercel.app/login"
                     style="display:block;background:#FF5C00;color:#fff;text-align:center;
                            text-decoration:none;font-size:15px;font-weight:600;
                            padding:14px 0;border-radius:8px">
                    Sıralamayı Gör →
                  </a>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#fafafa;border-top:1px solid #f0f0f0;padding:20px 40px">
                  <p style="margin:0;font-size:12px;color:#bbb;line-height:1.6;text-align:center">
                    Bu mail Tasarım Atölyesi sistemi tarafından otomatik gönderilmiştir.
                  </p>
                </td>
              </tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    const result = await sendMail({
      to: winner.email,
      subject: `Tebrikler! ${monthLabel} Ayının Birincisisin 🏆`,
      html,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Duplicate koruması için kaydet
    await winnerDocRef.set({
      studentId: studentsSnap.docs[0].id,
      name: winnerName,
      email: winner.email,
      score,
      sentAt: new Date().toISOString(),
    });

    console.log(`[monthly-winner] ${monthKey} — ${winnerName} (${score} puan) → ${winner.email}`);
    return NextResponse.json({ success: true, winner: winnerName, score, month: monthKey });

  } catch (err) {
    console.error("[monthly-winner] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
