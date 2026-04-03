import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/app/lib/firebase-admin";
import { sendMail } from "@/app/lib/email";

// Bir önceki ayın başı ve sonu (UTC+3)
function getPrevMonthRange(): { start: Timestamp; end: Timestamp; label: string } {
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000); // UTC+3
  const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const month = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1; // 0-indexed

  const startUTC = new Date(Date.UTC(year, month, 1) - 3 * 60 * 60 * 1000);
  const endUTC   = new Date(Date.UTC(year, month + 1, 1) - 3 * 60 * 60 * 1000);

  const label = new Date(Date.UTC(year, month, 1)).toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return {
    start: Timestamp.fromDate(startUTC),
    end:   Timestamp.fromDate(endUTC),
    label,
  };
}

export async function POST() {
  try {
    const { start, end, label } = getPrevMonthRange();

    // 1. Geçen ayki scoreLogs kayıtlarını çek
    const logsSnap = await adminDb
      .collection("scoreLogs")
      .where("createdAt", ">=", start)
      .where("createdAt", "<",  end)
      .get();

    if (logsSnap.empty) {
      await sendMail({
        to: "alparslan.sennturk@gmail.com",
        subject: `[Flex] ${label} — Aylık Birinci Bulunamadı`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 32px;color:#111">
            <p style="font-size:15px;margin:0 0 16px"><strong>${label}</strong> ayına ait puan kaydı bulunamadı.</p>
            <p style="font-size:14px;color:#555;margin:0">Bu ay hiçbir öğrenciye not girilmemiş olabilir.</p>
            <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin:32px 0 0">Tasarım Atölyesi — Flex</p>
          </div>`,
      });
      return NextResponse.json({ message: `${label} için kayıt bulunamadı. Admin bilgilendirildi.` }, { status: 200 });
    }

    // 2. Öğrenci bazlı puan topla
    const totals = new Map<string, { name: string; points: number }>();
    for (const doc of logsSnap.docs) {
      const { studentId, studentName, points } = doc.data() as {
        studentId: string;
        studentName: string;
        points: number;
      };
      const current = totals.get(studentId);
      totals.set(studentId, {
        name:   current?.name   ?? studentName,
        points: (current?.points ?? 0) + (points ?? 0),
      });
    }

    // 3. En yüksek puanlıyı bul
    let winnerId   = "";
    let winnerName = "";
    let winnerPts  = -1;

    for (const [id, { name, points }] of totals) {
      if (points > winnerPts) {
        winnerId   = id;
        winnerName = name;
        winnerPts  = points;
      }
    }

    // 4. Öğrencinin e-postasını Firestore'dan al
    const studentSnap = await adminDb.collection("students").doc(winnerId).get();
    const studentData = studentSnap.data();
    const email = studentData?.email as string | undefined;

    if (!email) {
      return NextResponse.json(
        { message: `Kazanan: ${winnerName} (${winnerPts} puan) — e-posta adresi bulunamadı.` },
        { status: 200 }
      );
    }

    // 5. Kutlama maili gönder
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;color:#111">
        <img
          src="https://flex-one-iota.vercel.app/assets/illustrations/monthly-winner/winner-01.jpg"
          alt="Aylık Birinci"
          style="width:100%;max-width:480px;border-radius:12px;margin-bottom:32px;display:block"
        />
        <h2 style="margin:0 0 16px;font-size:22px;color:#1a1a1a">
          Tebrikler, ${winnerName}! 🏆
        </h2>
        <p style="font-size:15px;line-height:1.7;margin:0 0 12px">
          <strong>${label}</strong> ayında en yüksek puanı sen kazandın!
        </p>
        <p style="font-size:15px;line-height:1.7;margin:0 0 32px">
          Bu ay topladığın puan: <strong>${winnerPts}</strong>
        </p>
        <p style="font-size:14px;line-height:1.7;margin:0 0 8px;color:#555">
          Harika çalışmaların için teşekkürler. Böyle devam et!
        </p>
        <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin:32px 0 0">
          Tasarım Atölyesi
        </p>
      </div>`;

    const result = await sendMail({
      to: email,
      subject: `${label} Birincisi Sensin! 🏆`,
      html,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log(`[monthly-winner] Mail gönderildi: ${winnerName} <${email}> — ${winnerPts} puan (${label})`);
    return NextResponse.json({
      success: true,
      winner:  winnerName,
      points:  winnerPts,
      month:   label,
      email,
    });
  } catch (err) {
    console.error("[monthly-winner] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
