import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/app/lib/firebase-admin";
import { sendMail } from "@/app/lib/email";
import { saveMailLog } from "@/app/services/emailService";

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
  const dayAfter = trDateString(2);

  try {
    const tasksSnap = await adminDb
      .collection("tasks")
      .where("endDate", "in", [tomorrow, dayAfter])
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

      // Gruptaki öğrencileri çek
      const studentsSnap = await adminDb
        .collection("students")
        .where("groupId", "==", task.groupId)
        .get();

      const daysLeft = task.endDate === tomorrow ? "yarın" : "2 gün sonra";
      const taskName = task.name ?? "Ödev";
      const instructorName = task.createdByName ?? "Eğitmeniniz";
      const endDateFormatted = new Date(task.endDate + "T00:00:00").toLocaleDateString("tr-TR", {
        day: "numeric", month: "long", year: "numeric",
      });

      for (const studentDoc of studentsSnap.docs) {
        const student = studentDoc.data();
        if (!student.email) continue;

        const html = `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 32px;color:#111">
            <p style="font-size:15px;margin:0 0 16px">Sayın <strong>${student.name} ${student.lastName}</strong>,</p>
            <p style="font-size:14px;line-height:1.7;margin:0 0 16px">
              <strong>${taskName}</strong> adlı ödevinizin teslim tarihi <strong>${endDateFormatted}</strong> —
              teslim için <strong>${daysLeft}</strong> kaldı.
            </p>
            <p style="font-size:14px;line-height:1.7;margin:0 0 32px">Ödevinizi zamanında teslim etmeyi unutmayın.</p>
            <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin:0">${instructorName}</p>
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
