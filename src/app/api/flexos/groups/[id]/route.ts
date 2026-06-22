import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { updateGroupStatus, deleteGroup } from "@/app/lib/domain/services/group-service";
import type { GroupStatus } from "@/app/lib/domain/core/group";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * PATCH /api/flexos/groups/[id] — grup yaşam-döngüsü durumunu güncelle.
 * Body: { status } (domain GroupStatus). Gated `group.edit`.
 */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: { status?: GroupStatus };
  try { body = (await req.json()) as { status?: GroupStatus }; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }

  if (!body.status) return NextResponse.json({ error: "status zorunludur." }, { status: 400 });

  try {
    const group = await updateGroupStatus(actorFromCaller(caller), id, body.status, { groups: firestoreGroupRepo });
    return NextResponse.json({ id: group.id, status: group.status });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/groups/:id PATCH]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * DELETE /api/flexos/groups/[id] — grup sil. Gated `group.delete`.
 * Aktif kayıtlı grup silinmez (serviste kontrol).
 */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    await deleteGroup(actorFromCaller(caller), id, { groups: firestoreGroupRepo, enrollments: firestoreEnrollmentRepo });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/groups/:id DELETE]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
