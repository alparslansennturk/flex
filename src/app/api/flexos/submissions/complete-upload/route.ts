import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import { firestoreSubmissionFileRepo } from "@/app/lib/server/submission-file-repo.firestore";
import { firestoreUploadSessionRepo } from "@/app/lib/server/upload-session-repo.firestore";
import { submissionDrive } from "@/app/lib/server/submission-drive";
import { completeUpload } from "@/app/lib/domain/services/submission-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/submissions/complete-upload — Submission+SubmissionFile'ı yazan,
 * UploadSession'ı `completed`'a çeken TEK canonical adım. Canlıdaki `complete-upload`'un karşılığı.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: { uploadId: string; driveFileId?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const submission = await completeUpload(
      { ...body, requesterUid: caller.uid, tenantId: DEFAULT_TENANT },
      {
        assignments: firestoreAssignmentRepo,
        groups: firestoreGroupRepo,
        persons: firestorePersonRepo,
        enrollments: firestoreEnrollmentRepo,
        submissions: firestoreSubmissionRepo,
        submissionFiles: firestoreSubmissionFileRepo,
        uploadSessions: firestoreUploadSessionRepo,
        drive: submissionDrive,
      },
    );

    return NextResponse.json({
      submissionId: submission.id,
      status: submission.status,
      iteration: submission.iteration,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/submissions/complete-upload] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
