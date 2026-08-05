import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import type { Attendance } from "@/app/lib/domain/core/attendance";
import type { Group } from "@/app/lib/domain/core/group";

/**
 * FlexOS eşdeğeri — eski `auto-close-attendance/route.ts` (`design_attendance`/
 * `design_classes`) SADECE eski Flex Core sistemi için çalışıyordu, FlexOS'un kendi
 * `flexos_attendance`/`flexos_groups` koleksiyonlarına hiç port edilmemişti (2026-07-25
 * kullanıcı bulgusu: "hepsini kapattığımı sanıyordum, kural yok muydu" — kural VARDI ama
 * sadece eski sistemde). Aynı davranış: yoklama başlatılmış (`lessonStartedAt` veya
 * `entries` dolu) → ders bitiminden 3 saat sonra kapat; hiç başlatılmamış → 6 saat sonra
 * kapat. Ayrı bir uç — eski cron'a DOKUNULMADI (o hâlâ eski sistem için çalışmaya devam
 * ediyor, FlexOS "yeni koleksiyonlar eskilere yazmıyor" prensibiyle simetrik: bu da
 * eskilere hiç dokunmuyor).
 */

const TR_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function formatTRDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d, 10)} ${TR_MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

/** Türkiye saati (UTC+3) ile şimdiki dakikayı döndürür (gece yarısından). */
function trNowMins(): number {
  const now = new Date();
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return tr.getUTCHours() * 60 + tr.getUTCMinutes();
}

/** Türkiye saati (UTC+3) ile bugün ve dünün tarih string'lerini döndürür. */
function trDates(): { today: string; yesterday: string } {
  const now = new Date();
  const trMs = now.getTime() + 3 * 60 * 60 * 1000;
  const tr = new Date(trMs);
  const today = tr.toISOString().split("T")[0];
  const yesterday = new Date(trMs - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  return { today, yesterday };
}

/** "19.00" → 1140 (dakika, gece yarısından). Ayrıştırılamıyorsa null — `enrollment-service.ts::parseHM` ile aynı format. */
function parseHM(t?: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(".").map((n) => Number(n));
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

// Ders bitiminden sonra kapatma süreleri (dakika) — eski cron'la AYNI değerler.
const CLOSE_AFTER_STARTED_MIN = 180; // yoklama başlatılmış → 3 saat sonra kapat
const CLOSE_AFTER_NOT_TAKEN_MIN = 360; // yoklama hiç alınmamış → 6 saat sonra kapat

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { today, yesterday } = trDates();
  const nowMins = trNowMins();

  const [todaySnap, yesterdaySnap] = await Promise.all([
    adminDb.collection("flexos_attendance").where("tenantId", "==", DEFAULT_TENANT).where("date", "==", today).get(),
    adminDb.collection("flexos_attendance").where("tenantId", "==", DEFAULT_TENANT).where("date", "==", yesterday).get(),
  ]);

  const allDocs = [...todaySnap.docs, ...yesterdaySnap.docs];
  const unclosed = allDocs.filter((d) => !(d.data() as Attendance).attendanceClosed);

  if (unclosed.length === 0) {
    return NextResponse.json({ closed: 0, checked: allDocs.length });
  }

  // Grup bitiş saatlerini toplu çek (tek seferde) — Firestore "in" max 30 eleman.
  const groupIds = [...new Set(unclosed.map((d) => (d.data() as Attendance).groupId).filter(Boolean))];
  const groupEndMinMap = new Map<string, number>();
  for (let i = 0; i < groupIds.length; i += 30) {
    const chunk = groupIds.slice(i, i + 30);
    const gSnap = await adminDb.collection("flexos_groups").where("__name__", "in", chunk).get();
    gSnap.docs.forEach((g) => {
      const group = g.data() as Group;
      const endMin = parseHM(group.schedule?.endTime);
      if (endMin !== null) groupEndMinMap.set(g.id, endMin);
    });
  }

  const toClose: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  for (const d of unclosed) {
    const data = d.data() as Attendance;
    const endMin = groupEndMinMap.get(data.groupId);
    if (endMin === undefined) continue; // grup/saat bilgisi yoksa dokunma (güvenli taraf)

    const hasEntries = !!data.entries && Object.keys(data.entries).length > 0;
    const wasStarted = !!data.lessonStartedAt;
    const closeAfter = wasStarted || hasEntries ? CLOSE_AFTER_STARTED_MIN : CLOSE_AFTER_NOT_TAKEN_MIN;

    if (data.date === today) {
      if (nowMins >= endMin + closeAfter) toClose.push(d);
    } else {
      // Dünün dersi — gece yarısını sarmalayan geçen süre.
      const elapsedSinceEnd = (24 * 60 - endMin) + nowMins;
      if (elapsedSinceEnd >= closeAfter) toClose.push(d);
    }
  }

  if (toClose.length === 0) {
    return NextResponse.json({ closed: 0, checked: unclosed.length });
  }

  // Firestore batch tek commit'te EN FAZLA 500 işlem kabul eder. 2026-08-05 k6 taraması:
  // aynı saatte biten çok sayıda ders varsa (gerçekçi — çoğu grup ayn ~19:00-22:00 aralığında
  // bitiyor) bu cron sessizce 500 hatasıyla düşebilirdi, kimse fark etmezdi (arka plan işi).
  // 500'lük parçalara bölünüp ayrı commit'lerle yazılıyor.
  //
  // 2026-08-05 /code-review bulgusu (gerçek, `auto-close-attendance`'teki AYNI sorun):
  // bir chunk'ın commit'i patlarsa fonksiyon try/catch'siz çöküyordu — ÖNCEKİ chunk'lar
  // kalıcı olarak kapanmış yazılmış oluyordu ama yanıt 500 dönüp hiç başarılı olmamış
  // gibi görünüyordu. Artık her chunk kendi try/catch'inde, yanıt/özet SADECE gerçekten
  // kapatılanları yansıtıyor.
  const nowISO = new Date().toISOString();
  const closedDocs: typeof toClose = [];
  for (let i = 0; i < toClose.length; i += 500) {
    const chunk = toClose.slice(i, i + 500);
    const batch = adminDb.batch();
    chunk.forEach((d) => {
      batch.update(d.ref, { attendanceClosed: true, closedAt: nowISO });
    });
    try {
      await batch.commit();
      closedDocs.push(...chunk);
    } catch (e) {
      console.error("[auto-close-flexos-attendance] batch commit başarısız, sonraki chunk'larla devam ediliyor:", e);
    }
  }

  // Sadece log amaçlı — bilgi kaybı olmasın diye tarih formatlı liste dönüyor.
  const closedSummary = closedDocs.map((d) => {
    const data = d.data() as Attendance;
    return `${data.groupId} ${formatTRDate(data.date)}`;
  });

  return NextResponse.json({ closed: closedDocs.length, failed: toClose.length - closedDocs.length, checked: unclosed.length, closedSummary });
}
