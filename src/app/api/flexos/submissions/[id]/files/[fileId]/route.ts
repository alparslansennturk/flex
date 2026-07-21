import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import { firestoreSubmissionFileRepo } from "@/app/lib/server/submission-file-repo.firestore";
import { submissionDrive } from "@/app/lib/server/submission-drive";
import { submissionStorage } from "@/app/lib/server/submission-storage";
import { deleteFileAsStaff } from "@/app/lib/domain/services/submission-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * DELETE /api/flexos/submissions/[id]/files/[fileId] — gated (`submission.status.write`).
 * Eğitmen/op tarafı — `deleteFile`'ın (öğrenci-only) staff karşılığı, `deleteFileAsStaff`
 * ile AYNI kilit: tamamlanmış (`completed`) teslimde önce onay geri alınmalı (bkz. preview
 * ekranındaki "Onayı Geri Al").
 */
export const DELETE = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string; fileId: string }> }) => {
  const { id, fileId } = await ctx.params;
  const actor = await actorFromCaller(caller);

  try {
    await deleteFileAsStaff(actor, id, fileId, {
      submissions: firestoreSubmissionRepo,
      submissionFiles: firestoreSubmissionFileRepo,
      groups: firestoreGroupRepo,
      drive: submissionDrive,
      storage: submissionStorage,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/submissions/[id]/files/[fileId] DELETE] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
