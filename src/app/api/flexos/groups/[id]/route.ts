import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { updateGroupStatus, deleteGroup } from "@/app/lib/domain/services/group-service";
import type { GroupStatus } from "@/app/lib/domain/core/group";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * PATCH /api/flexos/groups/[id] — grup güncelle.
 * Body sadece { status } ise → yaşam-döngüsü güncelleme (updateGroupStatus).
 * Body'de diğer alanlar varsa → genel alan güncelleme (getById → merge → save).
 * Gated `group.edit`.
 */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }

  const actor = await actorFromCaller(caller);

  // Sadece status varsa → lifecycle güncelleme (mevcut davranış)
  const keys = Object.keys(body).filter((k) => body[k] !== undefined);
  if (keys.length === 1 && keys[0] === "status") {
    if (!body.status) return NextResponse.json({ error: "status zorunludur." }, { status: 400 });
    try {
      const group = await updateGroupStatus(actor, id, body.status as GroupStatus, { groups: firestoreGroupRepo });
      return NextResponse.json({ id: group.id, status: group.status });
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
      if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
      console.error("[flexos/groups/:id PATCH status]", e);
      return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
    }
  }

  // Genel alan güncelleme
  try {
    const existing = await firestoreGroupRepo.getById(id, actor.tenantId);
    if (!existing) return NextResponse.json({ error: "Grup bulunamadı." }, { status: 404 });

    const { can } = await import("@/app/lib/domain/access/can");
    if (!can(actor, "group.edit", { groupId: id, ownerUid: existing.trainerId })) {
      return NextResponse.json({ error: "Yetkisiz.", capability: "group.edit" }, { status: 403 });
    }

    // İzin verilen alanları merge et
    if (body.code !== undefined) existing.code = body.code;
    if (body.type !== undefined) existing.type = body.type;
    if (body.educationId !== undefined) existing.educationId = body.educationId;
    if (body.sectionId !== undefined) existing.sectionId = body.sectionId;
    if (body.branchOfficeId !== undefined) existing.branchOfficeId = body.branchOfficeId;
    if (body.trainerId !== undefined) existing.trainerId = body.trainerId;
    if (body.capacity !== undefined) existing.capacity = body.capacity;
    if (body.schedule !== undefined) existing.schedule = { ...existing.schedule, ...body.schedule };
    if (body.status !== undefined) existing.status = body.status as GroupStatus;

    await firestoreGroupRepo.save(existing);
    return NextResponse.json({ id: existing.id });
  } catch (e) {
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
    await deleteGroup((await actorFromCaller(caller)), id, { groups: firestoreGroupRepo, enrollments: firestoreEnrollmentRepo });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/groups/:id DELETE]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
