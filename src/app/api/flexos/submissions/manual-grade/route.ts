import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import { gradeManually } from "@/app/lib/domain/services/submission-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { broadcast } from "@/app/lib/server/realtime-hub";

/**
 * POST /api/flexos/submissions/manual-grade — gerçek dijital teslim yokken eğitmenin
 * doğrudan not vermesi (gated `submission.grade`, `[id]/grade` ile AYNI yetki).
 * `gradeManually` gerçek Submission varsa günceller, yoksa dosyasız yeni bir Submission açar.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: { assignmentId: string; personId: string; groupId: string; isLate: boolean; grade: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = await actorFromCaller(caller);

  try {
    const submission = await gradeManually(actor, body, {
      submissions: firestoreSubmissionRepo,
      groups: firestoreGroupRepo,
      assignments: firestoreAssignmentRepo,
    });
    broadcast(actor.tenantId, { type: "grades.changed", id: submission.id });
    return NextResponse.json({ id: submission.id, grade: submission.grade });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/submissions/manual-grade POST] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
