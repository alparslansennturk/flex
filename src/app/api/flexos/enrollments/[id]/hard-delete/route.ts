import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreGradeRepo } from "@/app/lib/server/grade-repo.firestore";
import { deleteEnrollment } from "@/app/lib/domain/services/enrollment-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { apiError } from "@/app/lib/server/api-error";

/**
 * DELETE /api/flexos/enrollments/[id]/hard-delete — TEK bir kaydı TAMAMEN siler
 * (admin-only, `role.manage`). Ayrı bir uç — `DELETE /api/flexos/enrollments/[id]`
 * hâlâ SOFT (status: cancelled), bu davranışı değiştirmez.
 *
 * Satışa bağlı (saleId var) veya notu girilmiş kayıtlar reddedilir (`deleteEnrollment`
 * içinde) — sadece yanlışlıkla açılmış, hiçbir finansal/akademik izi olmayan tek bir
 * kayıt için. Kişi ve kişinin diğer kayıtları etkilenmez.
 */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    const actor = await actorFromCaller(caller);
    await deleteEnrollment(actor, id, {
      enrollments: firestoreEnrollmentRepo,
      grades: firestoreGradeRepo,
    });
    broadcast(actor.tenantId, { type: "students.changed", id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "flexos/enrollments/[id]/hard-delete");
  }
});
