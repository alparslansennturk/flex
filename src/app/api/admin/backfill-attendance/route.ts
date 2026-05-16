import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

// Tek seferlik: grubun startDate'inden dünkü güne kadar olan tüm ders günlerine
// design_attendance kaydı oluşturur. Zaten kaydı olan günleri atlar.
// Çağrı: POST /api/admin/backfill-attendance
//         Header: x-admin-secret: <ADMIN_SECRET>
//         Body (opsiyonel): { groupId: "...", dryRun: true }

const TR_DAYS: Record<string, number> = {
  pts: 1, pzt: 1, pazartesi: 1,
  sal: 2, sali: 2,
  çar: 3, car: 3, carsamba: 3,
  per: 4, persembe: 4,
  cum: 5, cuma: 5,
  cts: 6, cmt: 6, cumartesi: 6,
  paz: 0, pazar: 0,
};

function parseWeekDays(label: string): number[] {
  if (!label) return [];
  const lower = label
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o");
  const found: number[] = [];
  for (const [key, day] of Object.entries(TR_DAYS)) {
    if (lower.includes(key) && !found.includes(day)) found.push(day);
  }
  return found;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const filterGroupId: string | undefined = body.groupId;
  const filterGroupCode: string | undefined = body.groupCode;
  const dryRun: boolean = body.dryRun ?? false;

  // Tatilleri yükle
  const holidaysSnap = await adminDb.collection("holidays").get();
  const holidayDates = new Set<string>();
  holidaysSnap.docs.forEach(d => {
    const { startDate, endDate } = d.data() as { startDate: string; endDate: string };
    const cur = new Date(startDate + "T12:00:00");
    const end = new Date(endDate + "T12:00:00");
    while (cur <= end) {
      holidayDates.add(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
  });

  // Grupları yükle (arşivlenenler hariç)
  const groupsSnap = await adminDb.collection("groups").get();
  let groups = groupsSnap.docs
    .filter(d => d.data().status !== "archived")
    .map(d => ({ id: d.id, ...d.data() } as Record<string, any>));

  if (filterGroupId) groups = groups.filter(g => g.id === filterGroupId);
  else if (filterGroupCode) groups = groups.filter(g => g.code === filterGroupCode);

  // Dünkü gün (bugün dahil değil — bugün yoklamayı kullanıcı alacak)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const results: Record<string, any>[] = [];

  for (const group of groups) {
    const { session, startDate, sessionHours: groupSessionHours, discipline, instructorId } = group;

    if (!startDate) {
      results.push({ groupId: group.id, code: group.code, skipped: "startDate yok" });
      continue;
    }

    const weekDays = parseWeekDays(session ?? "");
    if (weekDays.length === 0) {
      results.push({ groupId: group.id, code: group.code, skipped: "session'da gün bulunamadı" });
      continue;
    }

    // sessionHours öncelik: grup → branş → 3
    let sessionHours: number = groupSessionHours ?? 3;
    if (!groupSessionHours && discipline) {
      const branchDoc = await adminDb.collection("branches").doc(discipline).get();
      sessionHours = branchDoc.data()?.sessionHours ?? 3;
    }

    // Bu grubun aktif öğrencileri
    const studentsSnap = await adminDb
      .collection("students")
      .where("groupId", "==", group.id)
      .where("status", "==", "active")
      .get();

    if (studentsSnap.empty) {
      results.push({ groupId: group.id, code: group.code, skipped: "aktif öğrenci yok" });
      continue;
    }

    const entries: Record<string, { hours: number; online: boolean }> = {};
    studentsSnap.docs.forEach(sd => {
      entries[sd.id] = { hours: sessionHours, online: false };
    });

    // startDate'den dünkü güne kadar tüm ders günlerini bul
    const start = new Date(startDate + "T12:00:00");
    let created = 0;
    let alreadyExists = 0;
    const skippedHolidays: string[] = [];
    const lessonDates: string[] = [];

    const cur = new Date(start);
    while (cur.toISOString().slice(0, 10) <= yesterdayStr) {
      const dateKey = cur.toISOString().slice(0, 10);
      const dow = cur.getDay();

      if (weekDays.includes(dow)) {
        if (holidayDates.has(dateKey)) {
          skippedHolidays.push(dateKey);
        } else {
          const docId = `${group.id}_${dateKey}`;
          const existing = await adminDb.collection("design_attendance").doc(docId).get();

          if (existing.exists) {
            alreadyExists++;
          } else {
            if (!dryRun) {
              await adminDb.collection("design_attendance").doc(docId).set({
                groupId: group.id,
                date: dateKey,
                month: dateKey.slice(0, 7),
                instructorId: instructorId ?? "",
                sessionHours,
                entries,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
              });
            }
            created++;
            lessonDates.push(dateKey);
          }
        }
      }

      cur.setDate(cur.getDate() + 1);
    }

    results.push({
      groupId: group.id,
      code: group.code,
      startDate,
      weekDays,
      sessionHours,
      studentCount: studentsSnap.size,
      created,
      alreadyExists,
      skippedHolidays,
      ...(dryRun ? { lessonDates } : {}),
      dryRun,
    });
  }

  return NextResponse.json({ success: true, dryRun, results });
}
