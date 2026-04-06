import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { sendMail } from "@/app/lib/email";

const IMAGE_URL =
  "https://flex-one-iota.vercel.app/assets/illustrations/monthly-winner/winner-01.jpg";

function buildWinnerHtml(firstName: string, score: number, monthLabel: string): string {
  const DARK  = "#09172A";
  const WHITE = "#ffffff";
  const EB    = "font-weight:800";
  const BOLD  = "font-weight:700";
  const MED   = "font-weight:500";
  const BASE  = `font-family:'Baloo 2',Arial,sans-serif;color:${DARK};line-height:1.4`;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @font-face {
      font-family: 'Baloo 2';
      font-style: normal;
      font-weight: 500;
      src: url('https://fonts.gstatic.com/s/baloo2/v23/wXK0E3kTposypRydzVT08TS3JnAmtdjEyppo_leP6HcMqzQ.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Baloo 2';
      font-style: normal;
      font-weight: 700;
      src: url('https://fonts.gstatic.com/s/baloo2/v23/wXK0E3kTposypRydzVT08TS3JnAmtdj9yppo_leP6HcMqzQ.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Baloo 2';
      font-style: normal;
      font-weight: 800;
      src: url('https://fonts.gstatic.com/s/baloo2/v23/wXK0E3kTposypRydzVT08TS3JnAmtdiayppo_leP6HcMqzQ.woff2') format('woff2');
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:'Baloo 2',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0"
       style="background:#ffffff;border-radius:16px;overflow:hidden;
              box-shadow:0 2px 16px rgba(0,0,0,0.07)">

  <tr>
    <td valign="top" style="padding:0;border-radius:16px 16px 0 0;overflow:hidden">
      <table width="560" height="560" cellpadding="0" cellspacing="0"
             background="${IMAGE_URL}"
             style="background-image:url('${IMAGE_URL}');background-size:cover;
                    background-position:center center;width:560px;height:560px;
                    border-radius:16px 16px 0 0">
        <tr><td colspan="3" height="143"></td></tr>
        <tr valign="middle">
          <td width="302" height="278"></td>
          <td width="241" valign="middle" style="padding:0 18px 0 12px;vertical-align:middle">
            <p style="margin:0 0 4px 0;${BASE};${BOLD};font-size:18px">
              Tebrikler ${firstName},
            </p>
            <p style="margin:0 0 2px 0;${BASE};${MED};font-size:13px">
              ${monthLabel} ayında
              <span style="${EB}"> ${score} puan</span>
              ile ay,<br>birincisi oldun.
            </p>
            <p style="margin:0 0 2px 0;${BASE};${EB};font-size:13px">
              Harika bir performans...
            </p>
            <p style="margin:0 0 10px 0;${BASE};${MED};font-size:13px">
              Bu başarı seni beklenenden daha<br>
              ileri götürecek.<br>
              Aynen devam :)
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
         style="display:inline-block;background:#FF5C00;color:#fff;
                text-decoration:none;font-family:'Baloo 2',Arial,sans-serif;
                font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px">
        Sıralamayı Gör →
      </a>
    </td>
  </tr>

  <tr>
    <td style="background:#fafafa;border-top:1px solid #f0f0f0;
               padding:16px 40px;text-align:center">
      <p style="margin:0;font-size:12px;color:#bbbbbb;line-height:1.6;
                font-family:'Baloo 2',Arial,sans-serif">
        Bu mail Tasarım Atölyesi sistemi tarafından otomatik gönderilmiştir.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Öğrencinin bir önceki aydaki istatistiklerini hesaplar.
 * - Tüm gradedTasks içinden endDate'i geçen aya düşen görevler alınır.
 * - G1→G2 geçişi hesaba katılır: classId fark etmeksizin o aya ait tüm görevler dahil edilir.
 * - g2StartXP aylık hesaba dahil DEĞİLDİR.
 */
function calcMonthlyStats(
  gradedTasks: Record<string, { xp?: number; penalty?: number; endDate?: string }> | undefined,
  monthStart: Date,
  monthEnd: Date,
): { monthlyXP: number; monthlyPenalty: number; monthlyTasks: number } {
  if (!gradedTasks) return { monthlyXP: 0, monthlyPenalty: 0, monthlyTasks: 0 };

  let monthlyXP = 0;
  let monthlyPenalty = 0;
  let monthlyTasks = 0;

  for (const entry of Object.values(gradedTasks)) {
    if (!entry.endDate) continue;
    const d = new Date(entry.endDate);
    if (d < monthStart || d >= monthEnd) continue;
    // xp > 0 → teslim edilmiş görev
    if ((entry.xp ?? 0) > 0) {
      monthlyXP      += entry.xp     ?? 0;
      monthlyPenalty += entry.penalty ?? 0;
      monthlyTasks   += 1;
    }
  }

  return { monthlyXP, monthlyPenalty, monthlyTasks };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ayın 1'inde çalışır — bir önceki ay
  const now = new Date(new Date().getTime() + 3 * 60 * 60 * 1000); // UTC+3
  const year  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1; // 0-indexed
  const monthKey   = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthLabel = new Date(year, month, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

  // Bir önceki ayın başı ve sonu (yerel zaman, UTC+3 baz alınarak)
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 1);

  try {
    // Duplicate koruması
    const winnerDocRef = adminDb.collection("monthly_winners").doc(monthKey);
    if ((await winnerDocRef.get()).exists) {
      return NextResponse.json({ success: true, skipped: true, reason: "already_sent", month: monthKey });
    }

    // Tüm aktif öğrencileri çek
    const snap = await adminDb
      .collection("students")
      .where("status", "==", "active")
      .get();

    if (snap.empty) {
      return NextResponse.json({ success: true, skipped: true, reason: "no_students" });
    }

    // Aylık istatistik hesapla
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
        // Puanı gizlenen öğrenciler ay birincisi olamaz
        if (d.isScoreHidden) return null;
        const { monthlyXP, monthlyPenalty, monthlyTasks } = calcMonthlyStats(
          d.gradedTasks,
          monthStart,
          monthEnd,
        );
        // O ay hiç puan almamışsa adaya alma
        if (monthlyXP === 0) return null;
        return {
          id:            doc.id,
          name:          (d.name      as string) ?? "",
          lastName:      (d.lastName  as string) ?? "",
          email:         (d.email     as string) ?? "",
          monthlyXP,
          monthlyPenalty,
          monthlyTasks,
        };
      })
      .filter((c): c is Candidate => c !== null);

    if (candidates.length === 0) {
      console.log(`[monthly-winner] ${monthKey} — o ay puan alan öğrenci yok.`);
      return NextResponse.json({ success: true, skipped: true, reason: "no_scores_this_month" });
    }

    // Sıralama:
    // 1. En yüksek aylık XP
    // 2. En az aylık ceza (düşük iyi)
    // 3. En fazla aylık görev sayısı
    candidates.sort((a, b) => {
      const xd = b.monthlyXP      - a.monthlyXP;      if (xd !== 0) return xd;
      const pd = a.monthlyPenalty - b.monthlyPenalty;  if (pd !== 0) return pd;
      const td = b.monthlyTasks   - a.monthlyTasks;    if (td !== 0) return td;
      return 0;
    });

    const best = candidates[0];

    // Beraberlik: tüm aynı istatistiklere sahip öğrenciler kazanır
    const winners = candidates.filter(
      c =>
        c.monthlyXP      === best.monthlyXP &&
        c.monthlyPenalty === best.monthlyPenalty &&
        c.monthlyTasks   === best.monthlyTasks,
    );

    // Her kazanana ayrı mail gönder
    const mailResults: { name: string; email: string; success: boolean }[] = [];

    for (const winner of winners) {
      if (!winner.email) continue;
      const result = await sendMail({
        to: winner.email,
        subject: `🏆 Tebrikler! ${monthLabel} Ayının Birincisisin`,
        html: buildWinnerHtml(winner.name, winner.monthlyXP, monthLabel),
      });
      mailResults.push({ name: `${winner.name} ${winner.lastName}`, email: winner.email, success: result.success });
      console.log(`[monthly-winner] ${monthKey} — ${winner.name} ${winner.lastName} (${winner.monthlyXP} puan) → ${winner.email} [${result.success ? "OK" : "FAIL"}]`);
    }

    // Duplicate koruması + kayıt
    await winnerDocRef.set({
      winners: winners.map(w => ({
        studentId: w.id,
        name:      `${w.name} ${w.lastName}`,
        email:     w.email,
        monthlyXP: w.monthlyXP,
        monthlyPenalty: w.monthlyPenalty,
        monthlyTasks: w.monthlyTasks,
      })),
      sentAt: new Date().toISOString(),
      month:  monthKey,
    });

    return NextResponse.json({
      success: true,
      month:   monthKey,
      winners: mailResults,
    });

  } catch (err) {
    console.error("[monthly-winner] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
