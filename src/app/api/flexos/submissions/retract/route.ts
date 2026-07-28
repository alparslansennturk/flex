import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import { firestoreSubmissionFileRepo } from "@/app/lib/server/submission-file-repo.firestore";
import { submissionDrive } from "@/app/lib/server/submission-drive";
import { submissionStorage } from "@/app/lib/server/submission-storage";
import { retract } from "@/app/lib/domain/services/submission-service";
import { apiError } from "@/app/lib/server/api-error";

/** POST /api/flexos/submissions/retract — öğrenci kendi teslimini geri çeker. */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: { submissionId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    await retract(
      { ...body, requesterUid: caller.uid, tenantId: DEFAULT_TENANT },
      {
        assignments: firestoreAssignmentRepo,
        persons: firestorePersonRepo,
        submissions: firestoreSubmissionRepo,
        submissionFiles: firestoreSubmissionFileRepo,
        drive: submissionDrive,
        storage: submissionStorage,
      },
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e, "flexos/submissions/retract");
  }
});
