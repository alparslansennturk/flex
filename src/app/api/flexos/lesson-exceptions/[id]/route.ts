import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreAttendanceRepo } from "@/app/lib/server/attendance-repo.firestore";
import { firestoreLessonExceptionRepo } from "@/app/lib/server/lesson-exception-repo.firestore";
import { deleteLessonException } from "@/app/lib/domain/services/lesson-exception-service";
import { apiError } from "@/app/lib/server/api-error";

/** DELETE /api/flexos/lesson-exceptions/[id] — istisnayı sil. Gated `attendance.write`. */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    await deleteLessonException((await actorFromCaller(caller)), id, {
      groups: firestoreGroupRepo,
      exceptions: firestoreLessonExceptionRepo,
      attendance: firestoreAttendanceRepo,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "flexos/lesson-exceptions/[id]");
  }
});
