import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { logActivityAdmin } from "@/app/lib/activityLogAdmin";

const TR_MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
function formatTRDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d)} ${TR_MONTHS[parseInt(m) - 1]} ${y}`;
}

/** Türkiye saati (UTC+3) ile şimdiki dakikayı döndürür */
function trNowMins(): number {
  const now = new Date();
  const trMs = now.getTime() + 3 * 60 * 60 * 1000;
  const tr = new Date(trMs);
  return tr.getUTCHours() * 60 + tr.getUTCMinutes();
}

/** Türkiye saati (UTC+3) ile bugün ve dünün tarih string'lerini döndürür */
function trDates(): { today: string; yesterday: string } {
  const now = new Date();
  const trMs = now.getTime() + 3 * 60 * 60 * 1000;
  const tr = new Date(trMs);
  const today = tr.toISOString().split("T")[0];
  const yMs = trMs - 24 * 60 * 60 * 1000;
  const yesterday = new Date(yMs).toISOString().split("T")[0];
  return { today, yesterday };
}

/** "14:00-17:00" → { start: 840, end: 1020 } */
function parseSession(session: string): { start: number; end: number } | null {
  const match = session.match(/(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})/);
  if (!match) return null;
  return {
    start: parseInt(match[1]) * 60 + parseInt(match[2]),
    end:   parseInt(match[3]) * 60 + parseInt(match[4]),
  };
}

// Ders bitiminden sonra kapatma süreleri (dakika)
const CLOSE_AFTER_STARTED_MIN = 180;   // yoklama başlatılmış → 3 saat sonra kapat
const CLOSE_AFTER_NOT_TAKEN_MIN = 360; // yoklama alınmamış → 6 saat sonra kapat

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { today, yesterday } = trDates();
  const nowMins = trNowMins();

  // Bugün ve dünün kapatılmamış yoklama kayıtlarını çek
  const [todaySnap, yesterdaySnap] = await Promise.all([
    adminDb.collection("design_attendance").where("date", "==", today).get(),
    adminDb.collection("design_attendance").where("date", "==", yesterday).get(),
  ]);

  const allDocs = [...todaySnap.docs, ...yesterdaySnap.docs];
  const unclosed = allDocs.filter(d => !d.data().attendanceClosed);

  if (unclosed.length === 0) {
    return NextResponse.json({ closed: 0, checked: allDocs.length });
  }

  // Grup session bilgilerini toplu çek (tek seferde)
  const groupIds = [...new Set(unclosed.map(d => d.data().groupId).filter(Boolean))];
  const groupSessionMap = new Map<string, string>();
  // Firestore "in" query max 30 eleman — chunk'la
  for (let i = 0; i < groupIds.length; i += 30) {
    const chunk = groupIds.slice(i, i + 30);
    const gSnap = await adminDb.collection("design_classes").where("__name__", "in", chunk).get();
    gSnap.docs.forEach(g => {
      const session = g.data().session;
      if (session) groupSessionMap.set(g.id, session);
    });
  }

  const toClose: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  for (const d of unclosed) {
    const data = d.data();
    const docDate = data.date as string;
    const groupId = data.groupId as string;
    // Önce attendance doc'undaki session alanına bak, yoksa grup lookup
    const session = (data.session as string) || groupSessionMap.get(groupId);
    const parsed = session ? parseSession(session) : null;

    if (!parsed) {
      // Session bilgisi yoksa — dün tarihli ise kapat (eski davranış)
      if (docDate === yesterday) {
        const hasEntries = data.entries && Object.keys(data.entries).length > 0;
        const wasStarted = !!data.lessonStartedAt;
        if (hasEntries || wasStarted) toClose.push(d);
      }
      continue;
    }

    const endMin = parsed.end;
    const hasEntries = data.entries && Object.keys(data.entries).length > 0;
    const wasStarted = !!data.lessonStartedAt;

    if (docDate === today) {
      // Bugünün dersleri — ders saati + kapatma süresi geçmiş mi?
      if (wasStarted || hasEntries) {
        // Yoklama başlatılmış → ders bitiminden 3 saat sonra kapat
        if (nowMins >= endMin + CLOSE_AFTER_STARTED_MIN) toClose.push(d);
      } else {
        // Yoklama alınmamış (doc var ama başlatılmamış) → 6 saat sonra kapat
        if (nowMins >= endMin + CLOSE_AFTER_NOT_TAKEN_MIN) toClose.push(d);
      }
    } else {
      // Dünün dersleri — ders saatini geçmiş, kapat
      // Dün için: nowMins + 1440 (24 saat) ile karşılaştır
      const elapsedSinceEnd = (24 * 60 - endMin) + nowMins;
      if (wasStarted || hasEntries) {
        if (elapsedSinceEnd >= CLOSE_AFTER_STARTED_MIN) toClose.push(d);
      } else {
        if (elapsedSinceEnd >= CLOSE_AFTER_NOT_TAKEN_MIN) toClose.push(d);
      }
    }
  }

  if (toClose.length === 0) {
    return NextResponse.json({ closed: 0, checked: unclosed.length });
  }

  const batch = adminDb.batch();
  const now = new Date();
  toClose.forEach(d => {
    batch.update(d.ref, { attendanceClosed: true, autoClosedAt: now });
  });
  await batch.commit();

  await Promise.allSettled(
    toClose.map(d => {
      const data = d.data();
      const groupCode = data.groupCode ?? data.groupId ?? d.id;
      const trDate = formatTRDate(data.date);
      const instructorId = data.instructorId;
      if (!instructorId) return Promise.resolve();
      return logActivityAdmin(
        "yoklama",
        "Yoklama Otomatik Bitirildi",
        `${groupCode} ${trDate} yoklaması otomatik bitirildi.`,
        instructorId,
      );
    })
  );

  return NextResponse.json({ closed: toClose.length, checked: unclosed.length });
}
