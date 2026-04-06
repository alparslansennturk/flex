import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { sendMail } from "@/app/lib/email";

// Bir önceki ayın başı ve sonu (UTC+3 tabanlı yerel zaman)
function getPrevMonthRange(): { start: Date; end: Date; label: string } {
  const now   = new Date(Date.now() + 3 * 60 * 60 * 1000); // UTC+3
  const year  = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const month = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1; // 0-indexed

  const label = new Date(Date.UTC(year, month, 1)).toLocaleDateString("tr-TR", {
    month: "long",
    year:  "numeric",
    timeZone: "UTC",
  });

  return {
    start: new Date(year, month, 1),
    end:   new Date(year, month + 1, 1),
    label,
  };
}

/**
 * Öğrencinin belirli bir aydaki istatistiklerini hesaplar.
 * Tüm gradedTasks'tan endDate'e göre filtreler — classId fark etmez (G1→G2 dahil).
 * g2StartXP dahil değildir.
 */
function calcMonthlyStats(
  gradedTasks: Record<string, { xp?: number; penalty?: number; endDate?: string }> | undefined,
  monthStart: Date,
  monthEnd: Date,
): { monthlyXP: number; monthlyPenalty: number; monthlyTasks: number } {
  if (!gradedTasks) return { monthlyXP: 0, monthlyPenalty: 0, monthlyTasks: 0 };

  let monthlyXP = 0, monthlyPenalty = 0, monthlyTasks = 0;

  for (const entry of Object.values(gradedTasks)) {
    if (!entry.endDate) continue;
    const d = new Date(entry.endDate);
    if (d < monthStart || d >= monthEnd) continue;
    if ((entry.xp ?? 0) > 0) {
      monthlyXP      += entry.xp      ?? 0;
      monthlyPenalty += entry.penalty ?? 0;
      monthlyTasks   += 1;
    }
  }

  return { monthlyXP, monthlyPenalty, monthlyTasks };
}

export async function POST() {
  try {
    const { start, end, label } = getPrevMonthRange();

    // Tüm aktif öğrencileri çek
    const snap = await adminDb
      .collection("students")
      .where("status", "==", "active")
      .get();

    if (snap.empty) {
      return NextResponse.json({ message: "Aktif öğrenci bulunamadı." }, { status: 200 });
    }

    type Candidate = {
      id: string;
      name: string;
      lastName: string;
      email: string;
      monthlyXP: number;
      monthlyPenalty: number;
      monthlyTasks: number;
    };

    const candidates: Candidate[] = snap.docs
      .map(doc => {
        const d = doc.data();
        if (d.isScoreHidden) return null;
        const stats = calcMonthlyStats(d.gradedTasks, start, end);
        if (stats.monthlyXP === 0) return null;
        return {
          id:       doc.id,
          name:     (d.name     as string) ?? "",
          lastName: (d.lastName as string) ?? "",
          email:    (d.email    as string) ?? "",
          ...stats,
        };
      })
      .filter((c): c is Candidate => c !== null);

    if (candidates.length === 0) {
      return NextResponse.json({ message: `${label} ayına ait puan kaydı bulunamadı.` }, { status: 200 });
    }

    // Sıralama: en yüksek XP → en az ceza → en fazla görev
    candidates.sort((a, b) => {
      const xd = b.monthlyXP      - a.monthlyXP;      if (xd !== 0) return xd;
      const pd = a.monthlyPenalty - b.monthlyPenalty;  if (pd !== 0) return pd;
      const td = b.monthlyTasks   - a.monthlyTasks;    if (td !== 0) return td;
      return 0;
    });

    const best = candidates[0];

    // Beraberlik: aynı istatistiklere sahip tüm öğrenciler kazanır
    const winners = candidates.filter(
      c =>
        c.monthlyXP      === best.monthlyXP &&
        c.monthlyPenalty === best.monthlyPenalty &&
        c.monthlyTasks   === best.monthlyTasks,
    );

    const mailResults: { name: string; email: string; success: boolean }[] = [];

    for (const winner of winners) {
      if (!winner.email) continue;

      const DARK  = "#09172A";
      const WHITE = "#ffffff";
      const EB    = "font-weight:800";
      const BOLD  = "font-weight:700";
      const MED   = "font-weight:500";
      const BASE  = `font-family:'Baloo 2',Arial,sans-serif;color:${DARK};line-height:1.4`;
      const IMAGE_URL = "https://flex-one-iota.vercel.app/assets/illustrations/monthly-winner/winner-01.jpg";

      const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:'Baloo 2',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0"
       style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07)">
  <tr>
    <td valign="top" style="padding:0">
      <table width="560" height="560" cellpadding="0" cellspacing="0"
             background="${IMAGE_URL}"
             style="background-image:url('${IMAGE_URL}');background-size:cover;background-position:center;width:560px;height:560px">
        <tr><td colspan="3" height="143"></td></tr>
        <tr valign="middle">
          <td width="302" height="278"></td>
          <td width="241" valign="middle" style="padding:0 18px 0 12px">
            <p style="margin:0 0 4px 0;${BASE};${BOLD};font-size:18px">Tebrikler ${winner.name},</p>
            <p style="margin:0 0 2px 0;${BASE};${MED};font-size:13px">
              ${label} ayında <span style="${EB}">${winner.monthlyXP} puan</span> ile ay,<br>birincisi oldun.
            </p>
            <p style="margin:0 0 2px 0;${BASE};${EB};font-size:13px">Harika bir performans...</p>
            <p style="margin:0 0 10px 0;${BASE};${MED};font-size:13px">
              Bu başarı seni beklenenden daha<br>ileri götürecek.<br>Aynen devam :)
            </p>
            <p style="margin:0;font-size:12px;${BOLD}">
              <span style="color:${DARK}">tasarım</span><span style="color:${WHITE}">atölyesi</span>
            </p>
          </td>
          <td width="17"></td>
        </tr>
        <tr><td colspan="3" height="139"></td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:28px 40px 24px;text-align:center">
      <a href="https://flex-one-iota.vercel.app/dashboard/league"
         style="display:inline-block;background:#FF5C00;color:#fff;text-decoration:none;
                font-family:'Baloo 2',Arial,sans-serif;font-size:15px;font-weight:700;
                padding:14px 40px;border-radius:10px">
        Sıralamayı Gör →
      </a>
    </td>
  </tr>
  <tr>
    <td style="background:#fafafa;border-top:1px solid #f0f0f0;padding:16px 40px;text-align:center">
      <p style="margin:0;font-size:12px;color:#bbbbbb;font-family:'Baloo 2',Arial,sans-serif">
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
        to: winner.email,
        subject: `🏆 Tebrikler! ${label} Ayının Birincisisin`,
        html,
      });

      mailResults.push({ name: `${winner.name} ${winner.lastName}`, email: winner.email, success: result.success });
    }

    return NextResponse.json({
      success: true,
      month:   label,
      winners: mailResults,
    });

  } catch (err) {
    console.error("[monthly-winner] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
