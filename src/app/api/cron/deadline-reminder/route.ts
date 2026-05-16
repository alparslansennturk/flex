import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/app/lib/firebase-admin";
import { sendMail } from "@/app/lib/email";
import { saveMailLog } from "@/app/services/emailService";
import { findCandidateEndDates, getEffectiveDeadline } from "@/app/lib/deadlineUtils";

// Türkiye saati (UTC+3) ile offset gün sonrasının tarihini YYYY-MM-DD olarak döndürür
function trDateString(offsetDays: number): string {
  const d = new Date();
  d.setTime(d.getTime() + (3 + offsetDays * 24) * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  // Vercel Cron güvenlik kontrolü
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today    = trDateString(0);
  const tomorrow = trDateString(1);

  try {
    // Tatilleri yükle — deadline tatile denk gelirse ilk iş gününe uzar
    const holidaysSnap = await adminDb.collection("holidays").get();
    const holidayDates = new Set<string>();
    holidaysSnap.docs.forEach(d => {
      const { startDate, endDate } = d.data() as { startDate: string; endDate: string };
      const cur = new Date(startDate + "T12:00:00");
      const end = new Date(endDate   + "T12:00:00");
      while (cur <= end) {
        holidayDates.add(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    });

    // Yarın efektif deadline olan tüm ham endDate'ler (tatil uzatması dahil)
    const candidateDates = findCandidateEndDates(tomorrow, holidayDates);
    if (candidateDates.length === 0) {
      return NextResponse.json({ success: true, sent: 0, skipped: 0, date: today, note: "yarın resmi iş günü değil" });
    }

    const tasksSnap = await adminDb
      .collection("tasks")
      .where("endDate", "in", candidateDates)
      .get();

    let sent = 0;
    let skipped = 0;

    for (const taskDoc of tasksSnap.docs) {
      const task = taskDoc.data();

      // Tamamlanmış, arşivlenmiş veya duraklatılmış task'ları atla
      if (task.status === "completed" || task.status === "archived" || task.isPaused) {
        skipped++;
        continue;
      }

      // Bu task için bugün zaten hatırlatma gönderildiyse atla
      const sentDates: string[] = task.reminderSentDates ?? [];
      if (sentDates.includes(today)) {
        skipped++;
        continue;
      }

      if (!task.groupId) continue;

      // Bu task için teslim yapmış öğrenci ID'lerini çek
      const submissionsSnap = await adminDb
        .collection("submissions")
        .where("taskId", "==", taskDoc.id)
        .get();
      const submittedStudentIds = new Set(
        submissionsSnap.docs.map(d => d.data().studentId).filter(Boolean)
      );

      // Gruptaki öğrencileri çek
      const studentsSnap = await adminDb
        .collection("students")
        .where("groupId", "==", task.groupId)
        .get();

      const effectiveDate = getEffectiveDeadline(task.endDate, holidayDates);
      const taskName = task.name ?? "Ödev";
      const endDateFormatted = new Date(effectiveDate + "T00:00:00").toLocaleDateString("tr-TR", {
        day: "numeric", month: "long", year: "numeric",
      });

      for (const studentDoc of studentsSnap.docs) {
        const student = studentDoc.data();
        if (!student.email) continue;
        if (student.isPassive) continue;                          // mezun / pasife alınmış
        if (student.accountStatus === "disabled") continue;      // hesabı devre dışı
        if (submittedStudentIds.has(studentDoc.id)) continue;    // ödevi zaten teslim etmiş

        const html = `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 32px;color:#111">
            <p style="font-size:15px;margin:0 0 16px">Merhaba ${student.name},</p>
            <p style="font-size:14px;line-height:1.7;margin:0 0 16px">
              "${taskName}" adlı ödevinizin teslim tarihi ${endDateFormatted}. Teslim için son 1 gün kaldı.
            </p>
            <p style="font-size:14px;line-height:1.7;margin:0">Ödevinizi zamanında teslim etmeyi unutmayın 😊</p>
          </div>`;

        const mailResult = await sendMail({
          to: student.email,
          subject: `Hatırlatma: "${taskName}" teslim tarihi yaklaşıyor (${endDateFormatted})`,
          html,
        });
        await saveMailLog({
          to: student.email,
          subject: `Hatırlatma: "${taskName}" teslim tarihi yaklaşıyor (${endDateFormatted})`,
          type: "deadline-reminder",
          result: mailResult,
          name: `${student.name ?? ""} ${student.lastName ?? ""}`.trim(),
          groupCode: task.groupId ?? undefined,
        });

        sent++;
      }

      // Bu task için bugün işaretlendi — cron yeniden çalışırsa tekrar atılmaz
      await taskDoc.ref.update({
        reminderSentDates: FieldValue.arrayUnion(today),
      });
    }

    console.log(`[deadline-reminder] Tamamlandı: ${sent} mail gönderildi, ${skipped} atlandı.`);
    return NextResponse.json({ success: true, sent, skipped, date: today });
  } catch (err) {
    console.error("[deadline-reminder] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
