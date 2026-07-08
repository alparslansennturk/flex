import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import { firestoreUploadSessionRepo } from "@/app/lib/server/upload-session-repo.firestore";
import { submissionDrive } from "@/app/lib/server/submission-drive";
import { initAttachmentUpload } from "@/app/lib/domain/services/submission-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/assignments/[id]/init-attachment-upload — eğitmenin ödeve referans
 * dosyası eklemesi (gated `assignment.edit`). Öğrenci teslimiyle AYNI resumable-upload
 * chunk proxy'sini (`/api/flexos/submissions/upload-chunk`) kullanır — `sessionUri`
 * ASLA response'a dahil edilmez.
 */
export const POST = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id: assignmentId } = await ctx.params;
  let body: { fileName: string; fileSize: number; mimeType: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const session = await initAttachmentUpload(
      actorFromCaller(caller),
      { assignmentId, fileName: body.fileName, fileSize: body.fileSize, mimeType: body.mimeType },
      {
        assignments: firestoreAssignmentRepo,
        groups: firestoreGroupRepo,
        trainers: firestoreTrainerRepo,
        uploadSessions: firestoreUploadSessionRepo,
        drive: submissionDrive,
      },
    );
    return NextResponse.json({ uploadId: session.id, fileName: session.actualFileName });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/assignments/[id]/init-attachment-upload] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
