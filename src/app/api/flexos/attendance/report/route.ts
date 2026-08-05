import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreAttendanceRepo } from "@/app/lib/server/attendance-repo.firestore";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import { firestoreEducationRepo, firestoreBranchRepo } from "@/app/lib/server/catalog-repo.firestore";
import { apiError } from "@/app/lib/server/api-error";

/**
 * GET /api/flexos/attendance/report — Yoklama Raporu. Gated `attendance.report.read`
 * (Eğitim Op + Finans + Admin — EĞİTMENDE YOK, 2026-07-02 kararı).
 *
 * Sınıf durumu takibi (Op) + hakediş kaynak verisi (Finans, yoklama saati × hourlyRate
 * hesabı BURADA YAPILMAZ — Finans modülü ayrı iş, bu uç sadece ham+join'li kayıtları verir).
 *
 * Filtreler: `groupId`, `trainerId`, `month` (YYYY-MM) veya `from`/`to` (YYYY-MM-DD
 * tarih aralığı — Yoklama Raporu'nun çoklu-ay arama çubuğu için) — hepsi opsiyonel.
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);

  if (!can(actor, "attendance.report.read")) {
    return NextResponse.json({ error: "Yetki yok: attendance.report.read" }, { status: 403 });
  }

  const groupIdFilter = req.nextUrl.searchParams.get("groupId") ?? undefined;
  const trainerIdFilter = req.nextUrl.searchParams.get("trainerId") ?? undefined;
  const monthFilter = req.nextUrl.searchParams.get("month") ?? undefined;
  const fromFilter = req.nextUrl.searchParams.get("from") ?? undefined;
  const toFilter = req.nextUrl.searchParams.get("to") ?? undefined;

  // 2026-08-05 k6 bulgusu: bu uç `flexos_attendance`'ın TAMAMINI (filtre verilse BİLE)
  // okuyup JS'te filtreliyordu — 2000 kayıtta p95 ~3s, koleksiyon büyüdükçe SINIRSIZ
  // büyüyen bir maliyet. Filtreler artık Firestore sorgu seviyesine iniyor: en dar
  // filtre (groupId > trainerId > month > from/to) seçilip geri kalanı (varsa, nadir
  // kombinasyon) küçültülmüş küme üzerinde JS'te uygulanıyor — sonuç AYNI, maliyet
  // en yaygın kullanımda (Yoklama Raporu ekranı HER ZAMAN from/to gönderir, hiçbir
  // sayfa filtresiz çağırmaz) koleksiyon boyutundan bağımsız hale geliyor.
  let recordsPromise: Promise<Awaited<ReturnType<typeof firestoreAttendanceRepo.list>>>;
  if (groupIdFilter) {
    recordsPromise = firestoreAttendanceRepo.listByGroup(groupIdFilter, actor.tenantId, monthFilter);
  } else if (trainerIdFilter) {
    recordsPromise = firestoreAttendanceRepo.listByTrainer(trainerIdFilter, actor.tenantId, monthFilter);
  } else if (fromFilter && toFilter) {
    recordsPromise = firestoreAttendanceRepo.listByDateRange(actor.tenantId, fromFilter, toFilter);
  } else if (monthFilter) {
    recordsPromise = firestoreAttendanceRepo.listByMonth(actor.tenantId, monthFilter);
  } else {
    // Gerçekten hiçbir filtre yok — nadir/dokümante edilmiş pahalı yol.
    recordsPromise = firestoreAttendanceRepo.list(actor.tenantId);
  }

  try {
    const [records, groups, trainers, educations, branches] = await Promise.all([
      recordsPromise,
      firestoreGroupRepo.list(actor.tenantId),
      firestoreTrainerRepo.list(actor.tenantId),
      firestoreEducationRepo.list(actor.tenantId),
      firestoreBranchRepo.list(actor.tenantId),
    ]);

    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const trainerMap = new Map(trainers.map((t) => [t.id, t.name]));
    const eduMap = new Map(educations.map((e) => [e.id, e]));
    const branchMap = new Map(branches.map((b) => [b.id, b.name]));

    // Yukarıdaki sorgu seçimi HER ZAMAN uygulanan filtreyi Firestore'a indirse de,
    // NADİR bir kombinasyon (ör. hem groupId hem from/to birlikte) için kalan
    // filtreler burada küçültülmüş küme üzerinde güvenle tekrarlanıyor — sonucu
    // DEĞİŞTİRMEZ, sadece ikinci bir filtre zaten dar kümede ucuz.
    const items = records
      .filter((r) => !groupIdFilter || r.groupId === groupIdFilter)
      .filter((r) => !trainerIdFilter || r.trainerId === trainerIdFilter)
      .filter((r) => !monthFilter || r.month === monthFilter)
      .filter((r) => !fromFilter || r.date >= fromFilter)
      .filter((r) => !toFilter || r.date <= toFilter)
      .map((r) => {
        const group = groupMap.get(r.groupId);
        const edu = group?.educationId ? eduMap.get(group.educationId) : undefined;
        const totalHours = Object.values(r.entries).reduce((sum, e) => sum + (e.hours || 0), 0);
        return {
          id: r.id,
          groupId: r.groupId,
          groupCode: group?.code ?? "",
          educationName: edu?.name ?? "",
          branch: (edu?.branchId ? branchMap.get(edu.branchId) : group?.branch) ?? "",
          trainerId: r.trainerId ?? "",
          trainerName: r.trainerId ? trainerMap.get(r.trainerId) ?? "" : "",
          date: r.date,
          month: r.month,
          sessionHours: r.sessionHours,
          totalHours,
          studentCount: Object.keys(r.entries).length,
          attendanceClosed: r.attendanceClosed,
          createdByException: r.createdByException ?? false,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ items });
  } catch (e) {
    return apiError(e, "flexos/attendance/report GET");
  }
});
