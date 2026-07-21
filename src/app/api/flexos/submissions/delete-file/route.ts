import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreSubmissionRepo } from "@/app/lib/server/submission-repo.firestore";
import { firestoreSubmissionFileRepo } from "@/app/lib/server/submission-file-repo.firestore";
import { submissionDrive } from "@/app/lib/server/submission-drive";
import { submissionStorage } from "@/app/lib/server/submission-storage";
import { deleteFile } from "@/app/lib/domain/services/submission-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/** POST /api/flexos/submissions/delete-file — öğrenci kendi (tamamlanmamış) teslimindeki bir dosyayı siler. */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: { submissionId: string; fileId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    await deleteFile(
      { ...body, requesterUid: caller.uid, tenantId: DEFAULT_TENANT },
      {
        persons: firestorePersonRepo,
        submissions: firestoreSubmissionRepo,
        submissionFiles: firestoreSubmissionFileRepo,
        drive: submissionDrive,
        storage: submissionStorage,
      },
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/submissions/delete-file] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
