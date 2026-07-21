import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreUploadSessionRepo } from "@/app/lib/server/upload-session-repo.firestore";
import { submissionStorage } from "@/app/lib/server/submission-storage";
import { completeAttachmentUpload } from "@/app/lib/domain/services/submission-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

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
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/assignments/[id]/complete-attachment-upload] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
