import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreLabRepo } from "@/app/lib/server/catalog-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { updateLab, deleteLab, type UpdateLabInput } from "@/app/lib/domain/services/catalog-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { apiError } from "@/app/lib/server/api-error";

/** PATCH /api/flexos/labs/[id] — laboratuvar güncelle (gated `lab.edit`). */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });
  let body: UpdateLabInput;
  try { body = (await req.json()) as UpdateLabInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }
  try {
    const actor = await actorFromCaller(caller);
    const lab = await updateLab(actor, id, body, firestoreLabRepo);
    broadcast(actor.tenantId, { type: "educations.changed", id: lab.id });
    return NextResponse.json({ id: lab.id });
  } catch (e) {
    return apiError(e, "flexos/labs/[id]");
  }
});

/** DELETE /api/flexos/labs/[id] — laboratuvar sil (gated `lab.edit`, aktif grup varsa engellenir). */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });
  try {
    const actor = await actorFromCaller(caller);
    await deleteLab(actor, id, { labs: firestoreLabRepo, groups: firestoreGroupRepo });
    broadcast(actor.tenantId, { type: "educations.changed", id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "flexos/labs/[id]");
  }
});
