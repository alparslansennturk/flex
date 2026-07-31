import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreActivityLogRepo } from "@/app/lib/server/activity-log-repo.firestore";
import { gradeSubmission } from "@/app/lib/domain/services/submission-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { invalidateActivityLogCache } from "@/app/api/flexos/egitmen-anasayfa/activity-log/route";
import { apiError } from "@/app/lib/server/api-error";

/**
 * PATCH /api/flexos/submissions/[id]/grade — gated (`submission.grade`).
 * Canlıdaki `assignment-test/submissions/[id]/grade` route'unun TEK canonical karşılığı.
 */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  let body: { grade: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = await actorFromCaller(caller);

  try {
    const submission = await gradeSubmission(actor, id, body.grade, {
      submissions: firestoreSubmissionRepo,
      groups: firestoreGroupRepo,
      assignments: firestoreAssignmentRepo,
      activityLog: firestoreActivityLogRepo,
    });
    broadcast(actor.tenantId, { type: "grades.changed", id: submission.id });
    invalidateActivityLogCache(actor.tenantId);
    return NextResponse.json({ id: submission.id, grade: submission.grade });
  } catch (e) {
    return apiError(e, "flexos/submissions/[id]/grade");
  }
});
