import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { can } from "@/app/lib/domain/access/can";
import { firestoreCaseRepo } from "@/app/lib/server/case-repo.firestore";
import { firestoreActivityRepo } from "@/app/lib/server/activity-repo.firestore";
import { updateCase, type UpdateCaseInput } from "@/app/lib/domain/services/case-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { apiError } from "@/app/lib/server/api-error";

/**
 * GET /api/flexos/cases/[id] — tekil talep + aktivite zaman çizelgesi.
 */
export const GET = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await actorFromCaller(caller);
  if (!can(actor, "case.read")) {
    return NextResponse.json({ error: "Yetersiz yetki." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const c = await firestoreCaseRepo.getById(id, actor.tenantId);
  if (!c) return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });

  const activities = await firestoreActivityRepo.listByCase(id, actor.tenantId);
  return NextResponse.json({ case: c, activities });
});

/**
 * PATCH /api/flexos/cases/[id] — statü / sorumlu güncelle.
 */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  let body: UpdateCaseInput;
  try {
    body = (await req.json()) as UpdateCaseInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const { id } = await ctx.params;

  try {
    const actor = await actorFromCaller(caller);
    const updated = await updateCase(actor, id, body, firestoreCaseRepo);
    broadcast(actor.tenantId, { type: "activities.changed", id: updated.id });
    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (e) {
    return apiError(e, "flexos/cases/[id]");
  }
});
