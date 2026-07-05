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
import { initUpload, type InitUploadInput } from "@/app/lib/domain/services/submission-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/submissions/init-resumable-upload — öğrenci-tarafı, capability
 * sistemi DIŞINDA (sahiplik: `person.authUid === caller.uid`). Canlıdaki
 * `init-resumable-upload` route'unun TEK canonical karşılığı — `sessionUri` ASLA
 * response'a dahil edilmez.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: Omit<InitUploadInput, "requesterUid" | "tenantId">;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const { session, currentUploads, maxUploads } = await initUpload(
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
      uploadId: session.id,
      actualFileName: session.actualFileName,
      currentUploads: currentUploads + 1,
      maxUploads,
      uploadsRemaining: maxUploads - currentUploads - 1,
      folderPath: session.folderPath,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/submissions/init-resumable-upload] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
