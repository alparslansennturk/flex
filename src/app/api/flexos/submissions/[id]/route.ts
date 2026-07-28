import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import { firestoreSubmissionFileRepo } from "@/app/lib/server/submission-file-repo.firestore";
import { getSubmissionForStaff } from "@/app/lib/domain/services/submission-service";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/submissions/[id] — teslim + dosyaları + kişi (gated `submission.read`). */
export const GET = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const actor = await actorFromCaller(caller);

  try {
    const result = await getSubmissionForStaff(actor, id, {
      submissions: firestoreSubmissionRepo,
      submissionFiles: firestoreSubmissionFileRepo,
      groups: firestoreGroupRepo,
      persons: firestorePersonRepo,
    });
    return NextResponse.json(result);
  } catch (e) {
    return apiError(e, "flexos/submissions/[id]");
  }
});
