import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { sendMail } from "@/app/lib/email";
import { calcScore, computeStudentStats, DEFAULT_SCORING, type ScoringSettings } from "@/app/lib/scoring";

// Görsel 1200×1200, email 560px → ölçek 0.467
// Glass card: left 302px, top 143px, w 241px, h 278px
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
      font-weight: 600;
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

  <!-- HERO: Görsel arka planda, metin glass card üzerinde -->
  <tr>
    <td valign="top" style="padding:0;border-radius:16px 16px 0 0;overflow:hidden">
      <table width="560" height="560" cellpadding="0" cellspacing="0"
             background="${IMAGE_URL}"
             style="background-image:url('${IMAGE_URL}');background-size:cover;
                    background-position:center center;width:560px;height:560px;
                    border-radius:16px 16px 0 0">

        <!-- Üst boşluk -->
        <tr><td colspan="3" height="143"></td></tr>

        <!-- Metin satırı -->
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

        <!-- Alt boşluk -->
        <tr><td colspan="3" height="139"></td></tr>

      </table>
    </td>
  </tr>

  <!-- CTA -->
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

  <!-- Footer -->
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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ayın 1'inde çalışır — geçen ay etiketi
  const now = new Date(new Date().getTime() + 3 * 60 * 60 * 1000); // UTC+3
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthKey   = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = prevMonth.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

  try {
    // Duplicate koruması
    const winnerDocRef = adminDb.collection("monthly_winners").doc(monthKey);
    if ((await winnerDocRef.get()).exists) {
      return NextResponse.json({ success: true, skipped: true, reason: "already_sent", month: monthKey });
    }

    // Scoring ayarları + aktif sezon
    const settingsSnap = await adminDb.collection("settings").doc("scoring").get();
    const settingsData = settingsSnap.data() ?? {};
    const settings: ScoringSettings = (settingsData.leaderboard && settingsData.difficultyXP)
      ? settingsData as ScoringSettings
      : DEFAULT_SCORING;
    const activeSeasonId: string = settingsData.activeSeasonId ?? "season_1";

    // Tüm aktif öğrencileri çek → algoritma skoru + istatistik hesapla
    const snap = await adminDb
      .collection("students")
      .where("status", "==", "active")
      .get();

    if (snap.empty) {
      return NextResponse.json({ success: true, skipped: true, reason: "no_students" });
    }

    const candidates = snap.docs.map(doc => {
      const data = doc.data();
      const { totalXP, completedTasks, latePenaltyTotal } = computeStudentStats(
        data.gradedTasks,
        data.isScoreHidden,
        activeSeasonId,
      );
      return {
        doc,
        computedScore:  calcScore(totalXP, completedTasks, settings),
        latePenaltyTotal,
        completedTasks,
      };
    });

    // Tiebreaker zinciri:
    // 1. En yüksek algoritma skoru
    // 2. En az geç teslim (latePenaltyTotal düşük)
    // 3. En fazla tamamlanan görev
    // 4. Kura (random)
    candidates.sort((a, b) => {
      const sd = b.computedScore  - a.computedScore;  if (sd !== 0) return sd;
      const pd = a.latePenaltyTotal - b.latePenaltyTotal; if (pd !== 0) return pd;
      const td = b.completedTasks - a.completedTasks;  if (td !== 0) return td;
      return Math.random() - 0.5; // kura
    });

    const selected   = candidates[0];
    const winner     = selected.doc.data();
    const winnerId   = selected.doc.id;
    const firstName  = winner.name ?? "Öğrenci";
    const winnerName = `${winner.name} ${winner.lastName}`;
    const score      = Math.round(selected.computedScore);

    if (!winner.email) {
      return NextResponse.json({ success: true, skipped: true, reason: "no_email" });
    }

    const result = await sendMail({
      to: winner.email,
      subject: `🏆 Tebrikler! ${monthLabel} Ayının Birincisisin`,
      html: buildWinnerHtml(firstName, score, monthLabel),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Duplicate koruması için kaydet
    await winnerDocRef.set({
      studentId: winnerId,
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
