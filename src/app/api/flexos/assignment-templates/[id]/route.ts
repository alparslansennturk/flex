import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreAssignmentTemplateRepo } from "@/app/lib/server/assignment-template-repo.firestore";
import { updateTemplate, deleteTemplate, type UpdateTemplateInput } from "@/app/lib/domain/services/assignment-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * PATCH /api/flexos/assignment-templates/[id] — şablon güncelle (gated `template.manage`,
 * sahiplik kontrolü: kişisel şablonu sadece sahibi, global'i sadece Op/Admin düzenler).
 */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: UpdateTemplateInput;
  try {
    body = (await req.json()) as UpdateTemplateInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const template = await updateTemplate((await actorFromCaller(caller)), id, body, firestoreAssignmentTemplateRepo);
    return NextResponse.json({ id: template.id });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/assignment-templates/:id PATCH]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * DELETE /api/flexos/assignment-templates/[id] — şablon sil (gated `template.manage`,
 * sahiplik kontrolü).
 */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    await deleteTemplate((await actorFromCaller(caller)), id, firestoreAssignmentTemplateRepo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/assignment-templates/:id DELETE]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
