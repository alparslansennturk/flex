import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreBranchOfficeRepo } from "@/app/lib/server/catalog-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { updateBranchOffice, deleteBranchOffice, type UpdateBranchOfficeInput } from "@/app/lib/domain/services/catalog-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { broadcast } from "@/app/lib/server/realtime-hub";

/** PATCH /api/flexos/branch-offices/[id] — şube adı/sıra güncelle (gated `office.edit`). */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });
  let body: UpdateBranchOfficeInput;
  try { body = (await req.json()) as UpdateBranchOfficeInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }
  try {
    const actor = await actorFromCaller(caller);
    const office = await updateBranchOffice(actor, id, body, firestoreBranchOfficeRepo);
    broadcast(actor.tenantId, { type: "educations.changed", id: office.id });
    return NextResponse.json({ id: office.id });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/branch-offices/:id PATCH]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** DELETE /api/flexos/branch-offices/[id] — şube sil (gated `office.edit`, aktif grup varsa engellenir). */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });
  try {
    const actor = await actorFromCaller(caller);
    await deleteBranchOffice(actor, id, { offices: firestoreBranchOfficeRepo, groups: firestoreGroupRepo });
    broadcast(actor.tenantId, { type: "educations.changed", id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/branch-offices/:id DELETE]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
