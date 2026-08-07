import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreSurveyRepo } from "@/app/lib/server/survey-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { listCandidateGroups } from "@/app/lib/domain/services/survey-dispatch-service";
import { apiError } from "@/app/lib/server/api-error";

/**
 * GET /api/flexos/surveys/[id]/candidate-groups — "Anket Yap" akışı: hedef sınıf adayları.
 * Klasik Anket → eğitim sonuna gelmiş sınıflar, Hızlı Anket → hâlâ aktif sınıflar.
 * Her aday için kayıtlı öğrenci sayısı da döner (UI'da "24 öğrenci" gibi gösterim için).
 */
export const GET = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    const actor = await actorFromCaller(caller);
    const groups = await listCandidateGroups(actor, id, { surveys: firestoreSurveyRepo, groups: firestoreGroupRepo });
    const enrollments = await firestoreEnrollmentRepo.listByGroupIds(groups.map((g) => g.id), actor.tenantId);
    // dispatchSurvey'deki roster filtresiyle AYNI kural (active + completed) —
    // "eğitim sonuna gelmiş sınıf" adaylarında enrollment'lar zaten "completed"e
    // düşmüş oluyor (bkz. o dosyadaki yorum), sadece "active" sayılırsa 0 çıkar.
    const countByGroup = new Map<string, number>();
    for (const e of enrollments) {
      if ((e.status !== "active" && e.status !== "completed") || !e.groupId) continue;
      countByGroup.set(e.groupId, (countByGroup.get(e.groupId) ?? 0) + 1);
    }
    const items = groups.map((g) => ({
      id: g.id,
      code: g.code,
      branch: g.branch,
      status: g.status,
      studentCount: countByGroup.get(g.id) ?? 0,
    }));
    return NextResponse.json({ items });
  } catch (e) {
    return apiError(e, "flexos/surveys/[id]/candidate-groups GET");
  }
});
