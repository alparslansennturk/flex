import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// Türkiye saati (UTC+3) ile offsetDays gün öncesinin tarihini YYYY-MM-DD olarak döndürür
function trDateString(offsetDays: number): string {
  const d = new Date();
  d.setTime(d.getTime() + (3 + offsetDays * 24) * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

// Cron: Her gece 00:00 Türkiye saati (= 21:00 UTC)
// Dünün endDate'ine sahip, henüz tamamlanmamış task'ları "not ver" moduna alır.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Dün (TR saatine göre) = ödevin son günü
  const yesterday = trDateString(-1);

  try {
    const tasksSnap = await adminDb
      .collection("tasks")
      .where("endDate", "==", yesterday)
      .get();

    let transitioned = 0;
    let skipped = 0;

    for (const taskDoc of tasksSnap.docs) {
      const task = taskDoc.data();

      // Zaten tamamlanmış, arşivlenmiş veya duraklatılmış olanları atla
      if (
        task.status === "completed" ||
        task.status === "archived" ||
        task.isPaused === true
      ) {
        skipped++;
        continue;
      }

      // Aktif → not ver moduna geç
      await taskDoc.ref.update({
        status: "completed",
        autoGradedAt: FieldValue.serverTimestamp(),
      });

      transitioned++;
    }

    console.log(
      `[auto-grade-transition] ${yesterday}: ${transitioned} task geçiş yapıldı, ${skipped} atlandı.`
    );

    return NextResponse.json({
      success: true,
      date: yesterday,
      transitioned,
      skipped,
    });
  } catch (err) {
    console.error("[auto-grade-transition] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
