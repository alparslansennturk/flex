import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreEducationRepo, firestoreSectionRepo, firestoreTrackRepo, firestoreBranchRepo } from "@/app/lib/server/catalog-repo.firestore";
import { createGroup, type CreateGroupInput } from "@/app/lib/domain/services/group-service";
import { officeName } from "@/app/lib/branch-offices";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/groups — yeni grup oluştur (gated `group.create`).
 * Yazım Admin SDK ile yeni `flexos_groups` koleksiyonuna; canlı `groups`'a dokunmaz.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateGroupInput;
  try {
    body = (await req.json()) as CreateGroupInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = actorFromCaller(caller);

  try {
    const group = await createGroup(actor, body, {
      groups: firestoreGroupRepo,
      educations: firestoreEducationRepo,
      sections: firestoreSectionRepo,
      tracks: firestoreTrackRepo,
    });
    return NextResponse.json({ id: group.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/groups] beklenmeyen hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * GET /api/flexos/groups?trainerId=... — grup listesi (kiracıya göre), zenginleştirilmiş.
 * Read-time join: eğitim adı + branş adı (eğitim→branchId) + doluluk (aktif enrollment sayısı).
 * Ham alanlar (code/type/status/educationId/schedule/capacity) korunur (geriye dönük uyumlu).
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);
  const trainerId = req.nextUrl.searchParams.get("trainerId") ?? undefined;

  const [groups, educations, branches, sections, enrollments] = await Promise.all([
    firestoreGroupRepo.list(actor.tenantId, trainerId),
    firestoreEducationRepo.list(actor.tenantId),
    firestoreBranchRepo.list(actor.tenantId),
    firestoreSectionRepo.list(actor.tenantId),
    firestoreEnrollmentRepo.list(actor.tenantId),
  ]);

  const eduMap = new Map(educations.map((e) => [e.id, e]));
  const branchMap = new Map(branches.map((b) => [b.id, b]));
  const sectionMap = new Map(sections.map((s) => [s.id, s]));

  // grup başına aktif kayıt sayısı (doluluk)
  const enrolledByGroup = new Map<string, number>();
  for (const enr of enrollments) {
    if (enr.groupId && enr.status === "active") {
      enrolledByGroup.set(enr.groupId, (enrolledByGroup.get(enr.groupId) ?? 0) + 1);
    }
  }

  const items = groups.map((g) => {
    const edu = g.educationId ? eduMap.get(g.educationId) : undefined;
    const branchName = edu?.branchId ? branchMap.get(edu.branchId)?.name : g.branch;
    const sec = g.sectionId ? sectionMap.get(g.sectionId) : undefined;
    return {
      id: g.id,
      code: g.code,
      type: g.type,
      status: g.status,
      educationId: g.educationId ?? null,
      educationName: edu?.name ?? "",
      branch: branchName ?? "",
      sectionId: g.sectionId ?? null,
      sectionName: sec?.name ?? "",
      branchOfficeId: g.branchOfficeId ?? null,
      branchOffice: officeName(g.branchOfficeId),
      trainerId: g.trainerId ?? "",
      schedule: g.schedule,
      capacity: g.capacity ?? 0,
      enrolled: enrolledByGroup.get(g.id) ?? 0,
    };
  });

  return NextResponse.json({ items });
});
