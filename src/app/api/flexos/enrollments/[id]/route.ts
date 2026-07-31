import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { assignToGroup, removeFromGroup, setEnrollmentStatus } from "@/app/lib/domain/services/enrollment-service";
import type { EnrollmentStatus } from "@/app/lib/domain/core/enrollment";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { apiError } from "@/app/lib/server/api-error";

/**
 * PATCH /api/flexos/enrollments/[id] — ya gruba atar ya da durum değiştirir.
 * Body: { groupId } (havuzdaki grupsuz kaydı gruba atar) VEYA
 *       { status: "active"|"completed"|"cancelled" } (Aktife Al/Mezun Et/Sil).
 * Gated `group.assign_student`.
 */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: { groupId?: string; status?: EnrollmentStatus };
  try { body = (await req.json()) as { groupId?: string; status?: EnrollmentStatus }; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }

  try {
    const actor = await actorFromCaller(caller);
    if (body.status) {
      const enrollment = await setEnrollmentStatus(
        actor,
        id,
        body.status,
        { enrollments: firestoreEnrollmentRepo, groups: firestoreGroupRepo },
      );
      broadcast(actor.tenantId, { type: "students.changed", id: enrollment.id });
      return NextResponse.json({ id: enrollment.id, status: enrollment.status });
    }

    if (!body.groupId) return NextResponse.json({ error: "groupId veya status zorunludur." }, { status: 400 });

    const enrollment = await assignToGroup(
      actor,
      { enrollmentId: id, groupId: body.groupId },
      { enrollments: firestoreEnrollmentRepo, groups: firestoreGroupRepo },
    );
    broadcast(actor.tenantId, { type: "students.changed", id: enrollment.id });
    return NextResponse.json({ id: enrollment.id, groupId: enrollment.groupId });
  } catch (e) {
    return apiError(e, "flexos/enrollments/[id]");
  }
});

/**
 * DELETE /api/flexos/enrollments/[id] — kaydı gruptan çıkar (soft, status: cancelled).
 * Gated `group.assign_student`.
 */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    const actor = await actorFromCaller(caller);
    const enrollment = await removeFromGroup(
      actor,
      id,
      { enrollments: firestoreEnrollmentRepo, groups: firestoreGroupRepo },
    );
    broadcast(actor.tenantId, { type: "students.changed", id: enrollment.id });
    return NextResponse.json({ id: enrollment.id, status: enrollment.status });
  } catch (e) {
    return apiError(e, "flexos/enrollments/[id]");
  }
});
