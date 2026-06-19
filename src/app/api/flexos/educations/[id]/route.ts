import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreEducationRepo, firestoreSectionRepo, firestoreTrackRepo } from "@/app/lib/server/catalog-repo.firestore";
import { updateEducation, deleteEducation, type UpdateEducationInput } from "@/app/lib/domain/services/catalog-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/** GET /api/flexos/educations/[id] — tek eğitim (düzenleme için ön-doldurma). */
export const GET = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const actor = actorFromCaller(caller);
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
    const edu = await updateEducation(actorFromCaller(caller), id, body, firestoreEducationRepo);
    return NextResponse.json({ id: edu.id, onSale: edu.onSale ?? false });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/educations/:id]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** DELETE /api/flexos/educations/[id] — eğitim sil (cascade: sections + tracks). */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });
  try {
    await deleteEducation(actorFromCaller(caller), id, { educations: firestoreEducationRepo, sections: firestoreSectionRepo, tracks: firestoreTrackRepo });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/educations/:id DELETE]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
