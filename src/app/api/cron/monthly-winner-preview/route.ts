import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { sendMail } from "@/app/lib/email";
import { saveMailLog } from "@/app/services/emailService";
import { calcStudentFinalScore, DEFAULT_SCORING, ScoringSettings } from "@/app/lib/scoring";

const ADMIN_EMAIL = "alparslan.sennturk@gmail.com";

// Hybrid kural: hangi aya yazılacağını belirler
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

  // UTC+3 ile bugünün tarihini al
  const now      = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Yalnızca ayın son günüyse çalış (yarın 1. gün = bugün son gün)
  if (tomorrow.getUTCDate() !== 1) {
    return NextResponse.json({ success: true, skipped: true, reason: "not_last_day_of_month" });
  }

  const year  = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed, bu ay
  const mo    = String(month + 1).padStart(2, "0");
  const monthStart = `${year}-${mo}-01`;
  const lastDay    = new Date(year, month + 1, 0).getDate();
  const monthEnd   = `${year}-${mo}-${String(lastDay).padStart(2, "0")}`;
  const monthLabel = new Date(year, month, 1).toLocaleDateString("tr-TR", {
    month: "long", year: "numeric",
  });

  try {
    // Scoring ayarlarını çek
    const settingsSnap = await adminDb.collection("settings").doc("scoring").get();
    const settings: ScoringSettings = settingsSnap.exists
      ? (settingsSnap.data() as ScoringSettings)
      : DEFAULT_SCORING;

    // Bu aya deadline'ı düşen görevleri çek
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
      name: string;
      lastName: string;
      email: string;
      groupCode: string;
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
          name:          (d.name     as string) ?? "",
          lastName:      (d.lastName as string) ?? "",
          email:         (d.email    as string) ?? "",
          groupCode,
          monthlyScore,
          monthlyXP,
          monthlyPenalty,
          monthlyTasks,
        };
      })
      .filter((c): c is Candidate => c !== null);

    if (candidates.length === 0) {
      return NextResponse.json({ success: true, skipped: true, reason: "no_scores_this_month" });
    }

    // Aynı sıralama mantığı: skor → ceza → görev sayısı
    candidates.sort((a, b) => {
      const sd = b.monthlyScore   - a.monthlyScore;   if (sd !== 0) return sd;
      const pd = a.monthlyPenalty - b.monthlyPenalty;  if (pd !== 0) return pd;
      const td = b.monthlyTasks   - a.monthlyTasks;    if (td !== 0) return td;
      return 0;
    });

    const best = candidates[0];
    const winners = candidates.filter(
      c =>
        c.monthlyScore   === best.monthlyScore &&
        c.monthlyPenalty === best.monthlyPenalty &&
        c.monthlyTasks   === best.monthlyTasks,
    );

    // Top 5 sıralamayı tablo olarak göster
    const top5 = candidates.slice(0, 5);

    const tableRows = top5.map((c, i) => {
      const isWinner = winners.some(w => w.name === c.name && w.lastName === c.lastName);
      const bg = i === 0 ? "#FFF8F0" : i % 2 === 0 ? "#F9FAFB" : "#FFFFFF";
      return `
      <tr style="background:${bg}">
        <td style="padding:10px 16px;font-weight:700;color:${isWinner ? "#C45000" : "#374151"}">${isWinner ? "🏆" : `${i + 1}.`}</td>
        <td style="padding:10px 16px;font-weight:600;color:#111827">${c.name} ${c.lastName}${isWinner ? " <span style='color:#C45000;font-size:11px'>(BİRİNCİ)</span>" : ""}</td>
        <td style="padding:10px 16px;color:#374151">${c.groupCode}</td>
        <td style="padding:10px 16px;font-weight:700;color:#111827;text-align:right">${Math.round(c.monthlyScore)}</td>
        <td style="padding:10px 16px;color:#6B7280;text-align:right">${c.monthlyXP} XP</td>
        <td style="padding:10px 16px;color:#6B7280;text-align:right">${c.monthlyTasks} görev</td>
        <td style="padding:10px 16px;color:#6B7280;text-align:right">${c.monthlyPenalty} ceza</td>
      </tr>`;
    }).join("");

    const winnerNames = winners.map(w => `<strong>${w.name} ${w.lastName}</strong>`).join(", ");

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0"
       style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

  <!-- Başlık -->
  <tr>
    <td style="background:#09172A;padding:24px 32px">
      <p style="margin:0;color:#FF8D28;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Aylık Lig Önizlemesi</p>
      <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:800">${monthLabel} — Birinci Adayı</h1>
    </td>
  </tr>

  <!-- Açıklama -->
  <tr>
    <td style="padding:24px 32px 16px">
      <p style="margin:0;font-size:15px;color:#374151;line-height:1.6">
        Yarın <strong>1 ${monthLabel.split(" ")[0]}</strong> tarihinde aylık lig maili otomatik gönderilecek.<br>
        Şu anki duruma göre ${winners.length > 1 ? "birinciler" : "birinci"}: ${winnerNames}
      </p>
      ${winners.length > 1 ? `<p style="margin:12px 0 0;font-size:13px;color:#6B7280">⚠️ ${winners.length} kişi berabere — hepsine mail gidecek.</p>` : ""}
    </td>
  </tr>

  <!-- Tablo -->
  <tr>
    <td style="padding:0 32px 24px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #E5E7EB">
        <thead>
          <tr style="background:#F9FAFB">
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#6B7280;font-weight:600">#</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#6B7280;font-weight:600">Öğrenci</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#6B7280;font-weight:600">Sınıf</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;color:#6B7280;font-weight:600">Puan</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;color:#6B7280;font-weight:600">XP</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;color:#6B7280;font-weight:600">Görev</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;color:#6B7280;font-weight:600">Ceza</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
      <p style="margin:12px 0 0;font-size:12px;color:#9CA3AF">İlk 5 öğrenci gösteriliyor. Toplam ${candidates.length} aktif öğrenci bu ay puan aldı.</p>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:16px 32px;text-align:center">
      <p style="margin:0;font-size:12px;color:#9CA3AF">
        Bu önizleme Tasarım Atölyesi sistemi tarafından otomatik gönderilmiştir.<br>
        Aylık lig maili yarın saat 09:00'da (UTC+3) gönderilecek.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const subject = `👀 Önizleme: ${monthLabel} Aylık Lig Birincisi — Yarın Mail Gidecek`;
    const result = await sendMail({ to: ADMIN_EMAIL, subject, html });
    await saveMailLog({ to: ADMIN_EMAIL, subject, type: "monthly-winner-preview", result });

    console.log(`[monthly-winner-preview] ${monthLabel} → ${ADMIN_EMAIL} [${result.success ? "OK" : "FAIL"}]`);

    return NextResponse.json({
      success: true,
      month:   monthLabel,
      winners: winners.map(w => `${w.name} ${w.lastName}`),
      mailSent: result.success,
    });

  } catch (err) {
    console.error("[monthly-winner-preview] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
