import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { assignToGroup, removeFromGroup, setEnrollmentStatus } from "@/app/lib/domain/services/enrollment-service";
import type { EnrollmentStatus } from "@/app/lib/domain/core/enrollment";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

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
    if (body.status) {
      const enrollment = await setEnrollmentStatus(
        actorFromCaller(caller),
        id,
        body.status,
        { enrollments: firestoreEnrollmentRepo, groups: firestoreGroupRepo },
      );
      return NextResponse.json({ id: enrollment.id, status: enrollment.status });
    }

    if (!body.groupId) return NextResponse.json({ error: "groupId veya status zorunludur." }, { status: 400 });

    const enrollment = await assignToGroup(
      actorFromCaller(caller),
      { enrollmentId: id, groupId: body.groupId },
      { enrollments: firestoreEnrollmentRepo, groups: firestoreGroupRepo },
    );
    return NextResponse.json({ id: enrollment.id, groupId: enrollment.groupId });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/enrollments/:id PATCH]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
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
    const enrollment = await removeFromGroup(
      actorFromCaller(caller),
      id,
      { enrollments: firestoreEnrollmentRepo, groups: firestoreGroupRepo },
    );
    return NextResponse.json({ id: enrollment.id, status: enrollment.status });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/enrollments/:id DELETE]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
