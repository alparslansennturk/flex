import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import { firestoreActivityLogRepo } from "@/app/lib/server/activity-log-repo.firestore";
import { gradeBatch, type BatchGradeItem } from "@/app/lib/domain/services/submission-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { invalidateActivityLogCache } from "@/app/api/flexos/egitmen-anasayfa/activity-log/route";
import { apiError } from "@/app/lib/server/api-error";

/**
 * POST /api/flexos/submissions/batch-grade — bir ödevin TÜM öğrenci notlarını TEK istekte
 * kaydeder (gated `submission.grade`). Eskiden `odev-notu` sayfası öğrenci başına ayrı
 * grade/manual-grade isteği + ayrı arşiv PATCH'i atıyordu (N+2 istek, her biri grup+ödev+
 * kimlik'i yeniden okuyordu — kota olayının bir kalemi). Artık grup+ödev+teslim listesi
 * bir kez okunur, tüm yazmalar toplanır, TEK broadcast atılır.
 *
 * `archive:true` → notlama sonrası ödev "archived"a çekilir (Ana Sayfa Ödev Parkuru'ndan
 * kalkar) ve ayrıca `assignments.changed` yayınlanır.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: { assignmentId: string; groupId: string; items: BatchGradeItem[]; archive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  if (!body?.assignmentId || !body?.groupId || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "assignmentId, groupId ve items zorunlu." }, { status: 400 });
  }

  const actor = await actorFromCaller(caller);

  try {
    const result = await gradeBatch(actor, body, {
      submissions: firestoreSubmissionRepo,
      groups: firestoreGroupRepo,
      assignments: firestoreAssignmentRepo,
      activityLog: firestoreActivityLogRepo,
    });
    broadcast(actor.tenantId, { type: "grades.changed", id: body.assignmentId });
    if (result.archived) broadcast(actor.tenantId, { type: "assignments.changed", id: body.assignmentId });
    invalidateActivityLogCache(actor.tenantId);
    return NextResponse.json(result);
  } catch (e) {
    return apiError(e, "flexos/submissions/batch-grade");
  }
});
