import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreAttendanceRepo } from "@/app/lib/server/attendance-repo.firestore";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import { firestoreEducationRepo, firestoreBranchRepo } from "@/app/lib/server/catalog-repo.firestore";

/**
 * GET /api/flexos/attendance/report — Yoklama Raporu. Gated `attendance.report.read`
 * (Eğitim Op + Finans + Admin — EĞİTMENDE YOK, 2026-07-02 kararı).
 *
 * Sınıf durumu takibi (Op) + hakediş kaynak verisi (Finans, yoklama saati × hourlyRate
 * hesabı BURADA YAPILMAZ — Finans modülü ayrı iş, bu uç sadece ham+join'li kayıtları verir).
 *
 * Filtreler: `groupId`, `trainerId`, `month` (YYYY-MM) — hepsi opsiyonel.
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);

  if (!can(actor, "attendance.report.read")) {
    return NextResponse.json({ error: "Yetki yok: attendance.report.read" }, { status: 403 });
  }

  const groupIdFilter = req.nextUrl.searchParams.get("groupId") ?? undefined;
  const trainerIdFilter = req.nextUrl.searchParams.get("trainerId") ?? undefined;
  const monthFilter = req.nextUrl.searchParams.get("month") ?? undefined;

  const [records, groups, trainers, educations, branches] = await Promise.all([
    firestoreAttendanceRepo.list(actor.tenantId),
    firestoreGroupRepo.list(actor.tenantId),
    firestoreTrainerRepo.list(actor.tenantId),
    firestoreEducationRepo.list(actor.tenantId),
    firestoreBranchRepo.list(actor.tenantId),
  ]);

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const trainerMap = new Map(trainers.map((t) => [t.id, t.name]));
  const eduMap = new Map(educations.map((e) => [e.id, e]));
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  const items = records
    .filter((r) => !groupIdFilter || r.groupId === groupIdFilter)
    .filter((r) => !trainerIdFilter || r.trainerId === trainerIdFilter)
    .filter((r) => !monthFilter || r.month === monthFilter)
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
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ items });
});
