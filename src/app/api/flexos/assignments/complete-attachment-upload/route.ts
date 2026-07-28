import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreUploadSessionRepo } from "@/app/lib/server/upload-session-repo.firestore";
import { submissionStorage } from "@/app/lib/server/submission-storage";
import { completeAttachmentUpload } from "@/app/lib/domain/services/submission-service";
import { apiError } from "@/app/lib/server/api-error";

/**
 * POST /api/flexos/assignments/[id]/complete-attachment-upload — yüklemeyi tamamlar,
 * `Assignment.attachments`'a ekler (gated `assignment.edit`).
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: { uploadId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const assignment = await completeAttachmentUpload(
      await actorFromCaller(caller),
      body,
      {
        assignments: firestoreAssignmentRepo,
        groups: firestoreGroupRepo,
        uploadSessions: firestoreUploadSessionRepo,
        storage: submissionStorage,
      },
    );
    const last = assignment.attachments[assignment.attachments.length - 1];
    return NextResponse.json({ attachment: last });
  } catch (e) {
    return apiError(e, "flexos/assignments/complete-attachment-upload");
  }
});
