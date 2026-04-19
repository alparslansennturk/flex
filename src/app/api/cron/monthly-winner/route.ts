import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { sendMail } from "@/app/lib/email";
import { saveMailLog } from "@/app/services/emailService";
import { calcStudentFinalScore, DEFAULT_SCORING, ScoringSettings } from "@/app/lib/scoring";

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

// Hybrid kural: hangi aya yazılacağını belirler
//   completedAt <= endDate → deadline ayı (zamanında / erken)
//   completedAt >  endDate → teslim ayı (geç)
//   completedAt yoksa     → endDate ayı (eski veri)
function effectiveDate(
  completedAt: string | undefined,
  endDate: string | undefined,
): string | null {
  if (!completedAt) return endDate ?? null;
  if (!endDate)     return completedAt;
  return completedAt <= endDate ? endDate : completedAt;
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
  const mo         = String(month + 1).padStart(2, "0");
  const monthStart = `${year}-${mo}-01`;
  const lastDay    = new Date(year, month + 1, 0).getDate();
  const monthEnd   = `${year}-${mo}-${String(lastDay).padStart(2, "0")}`;

  try {
    // Duplicate koruması
    const winnerDocRef = adminDb.collection("monthly_winners").doc(monthKey);
    if ((await winnerDocRef.get()).exists) {
      return NextResponse.json({ success: true, skipped: true, reason: "already_sent", month: monthKey });
    }

    // Scoring ayarlarını çek
    const settingsSnap = await adminDb.collection("settings").doc("scoring").get();
    const settings: ScoringSettings = settingsSnap.exists
      ? (settingsSnap.data() as ScoringSettings)
      : DEFAULT_SCORING;

    // O aya deadline'ı düşen görevleri çek (totalAssignedTasks için)
    const tasksSnap = await adminDb
      .collection("tasks")
      .where("endDate", ">=", monthStart)
      .where("endDate", "<=", monthEnd)
      .get();

    const assignedByClass: Record<string, number> = {};
    tasksSnap.docs.forEach(d => {
      const classId = d.data().classId as string | undefined;
      const status  = d.data().status  as string | undefined;
      if (!classId || status === "archived") return;
      assignedByClass[classId] = (assignedByClass[classId] ?? 0) + 1;
    });

    // Tüm aktif öğrencileri çek
    const snap = await adminDb
      .collection("students")
      .where("status", "==", "active")
      .get();

    if (snap.empty) {
      return NextResponse.json({ success: true, skipped: true, reason: "no_students" });
    }

    type Candidate = {
      id: string;
      name: string;
      lastName: string;
      email: string;
      monthlyScore: number;
      monthlyXP: number;
      monthlyPenalty: number;
      monthlyTasks: number;
    };

    const candidates: Candidate[] = snap.docs
      .map(doc => {
        const d = doc.data();
        const gradedTasks = (d.gradedTasks ?? {}) as Record<string, {
          xp?: number; penalty?: number; endDate?: string; completedAt?: string;
        }>;
        const groupCode = (d.groupCode as string) ?? "";

        // O aya ait girişleri filtrele (hybrid kural)
        let monthlyXP = 0, monthlyPenalty = 0, monthlyTasks = 0;
        for (const entry of Object.values(gradedTasks)) {
          const eff = effectiveDate(entry.completedAt, entry.endDate);
          if (!eff || eff < monthStart || eff > monthEnd) continue;
          if ((entry.xp ?? 0) > 0) {
            monthlyXP      += entry.xp      ?? 0;
            monthlyPenalty += entry.penalty ?? 0;
            monthlyTasks   += 1;
          }
        }

        if (monthlyXP === 0) return null;

        const totalAssigned = assignedByClass[groupCode] || undefined;
        const { finalScore: monthlyScore } = calcStudentFinalScore(
          monthlyXP, monthlyTasks, settings, totalAssigned, 0, 0,
        );

        return {
          id:       doc.id,
          name:     (d.name     as string) ?? "",
          lastName: (d.lastName as string) ?? "",
          email:    (d.email    as string) ?? "",
          monthlyScore,
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

    // Sıralama: en yüksek aylık skor → en az ceza → en fazla görev
    candidates.sort((a, b) => {
      const sd = b.monthlyScore   - a.monthlyScore;   if (sd !== 0) return sd;
      const pd = a.monthlyPenalty - b.monthlyPenalty;  if (pd !== 0) return pd;
      const td = b.monthlyTasks   - a.monthlyTasks;    if (td !== 0) return td;
      return 0;
    });

    const best = candidates[0];

    // Beraberlik: aylık skor + ceza + görev sayısı aynıysa hepsi birinci
    const winners = candidates.filter(
      c =>
        c.monthlyScore   === best.monthlyScore &&
        c.monthlyPenalty === best.monthlyPenalty &&
        c.monthlyTasks   === best.monthlyTasks,
    );

    const mailResults: { name: string; email: string; success: boolean }[] = [];

    for (const winner of winners) {
      if (!winner.email) continue;
      const subject = `🏆 Tebrikler! ${monthLabel} Ayının Birincisisin`;
      const result = await sendMail({
        to: winner.email,
        subject,
        html: buildWinnerHtml(winner.name, Math.round(winner.monthlyScore), monthLabel),
      });
      await saveMailLog({ to: winner.email, subject, type: "monthly-winner", result });
      mailResults.push({ name: `${winner.name} ${winner.lastName}`, email: winner.email, success: result.success });
      console.log(`[monthly-winner] ${monthKey} — ${winner.name} ${winner.lastName} (${Math.round(winner.monthlyScore)} puan) → ${winner.email} [${result.success ? "OK" : "FAIL"}]`);
    }

    // Duplicate koruması + kayıt
    await winnerDocRef.set({
      winners: winners.map(w => ({
        studentId:      w.id,
        name:           `${w.name} ${w.lastName}`,
        email:          w.email,
        monthlyScore:   Math.round(w.monthlyScore),
        monthlyXP:      w.monthlyXP,
        monthlyPenalty: w.monthlyPenalty,
        monthlyTasks:   w.monthlyTasks,
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
