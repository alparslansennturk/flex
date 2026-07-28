import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreEducationRepo, firestoreSectionRepo, firestoreTrackRepo } from "@/app/lib/server/catalog-repo.firestore";
import { updateEducation, deleteEducation, type UpdateEducationInput } from "@/app/lib/domain/services/catalog-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/educations/[id] — tek eğitim (düzenleme için ön-doldurma). */
export const GET = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const actor = await actorFromCaller(caller);
  const item = await firestoreEducationRepo.getById(id, actor.tenantId);
  if (!item) return NextResponse.json({ error: "Eğitim bulunamadı." }, { status: 404 });
  return NextResponse.json({ item });
});

/** PATCH /api/flexos/educations/[id] — eğitim güncelle (gated `education.edit`; Taslak↔Satışta dahil). */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: UpdateEducationInput;
  try { body = (await req.json()) as UpdateEducationInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }

  try {
    const actor = await actorFromCaller(caller);
    const edu = await updateEducation(actor, id, body, firestoreEducationRepo);
    broadcast(actor.tenantId, { type: "educations.changed", id: edu.id });
    return NextResponse.json({ id: edu.id, onSale: edu.onSale ?? false });
  } catch (e) {
    return apiError(e, "flexos/educations/[id]");
  }
});

/** DELETE /api/flexos/educations/[id] — eğitim sil (cascade: sections + tracks). */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });
  try {
    const actor = await actorFromCaller(caller);
    await deleteEducation(actor, id, { educations: firestoreEducationRepo, sections: firestoreSectionRepo, tracks: firestoreTrackRepo });
    broadcast(actor.tenantId, { type: "educations.changed", id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "flexos/educations/[id]");
  }
});
