import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { notifyUser } from "@/app/lib/server/flexos-notify";
import { updateSubmissionStatus } from "@/app/lib/domain/services/submission-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import type { SubmissionStatus } from "@/app/lib/domain/core/submission";

/**
 * PATCH /api/flexos/submissions/[id]/status — gated (`submission.status.write`).
 * Canlıdaki `assignment-test/submissions/[id]/status` route'unun TEK canonical karşılığı.
 */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  let body: { status: SubmissionStatus };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = actorFromCaller(caller);

  try {
    const submission = await updateSubmissionStatus(actor, id, body.status, {
      submissions: firestoreSubmissionRepo,
      groups: firestoreGroupRepo,
      persons: firestorePersonRepo,
      assignments: firestoreAssignmentRepo,
      notify: notifyUser,
    });
    return NextResponse.json({ id: submission.id, status: submission.status });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/submissions/[id]/status PATCH] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
