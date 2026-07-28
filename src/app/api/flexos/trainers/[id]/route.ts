import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import { updateTrainer, deleteTrainer, type UpdateTrainerInput } from "@/app/lib/domain/services/trainer-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { apiError } from "@/app/lib/server/api-error";

/**
 * PATCH /api/flexos/trainers/[id] — eğitmen güncelle (gated `trainer.edit`).
 * Ücret yalnız `trainer.rate.write` varsa güncellenir (serviste).
 */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: UpdateTrainerInput;
  try {
    body = (await req.json()) as UpdateTrainerInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const actor = await actorFromCaller(caller);
    const result = await updateTrainer(actor, id, body, firestoreTrainerRepo);
    broadcast(actor.tenantId, { type: "trainers.changed", id: result.trainer.id });
    return NextResponse.json({ id: result.trainer.id, rateDropped: result.rateDropped });
  } catch (e) {
    return apiError(e, "flexos/trainers/[id]");
  }
});

/**
 * DELETE /api/flexos/trainers/[id] — eğitmen sil (gated `trainer.delete`).
 */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    const actor = await actorFromCaller(caller);
    await deleteTrainer(actor, id, firestoreTrainerRepo, { groups: firestoreGroupRepo });
    broadcast(actor.tenantId, { type: "trainers.changed", id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "flexos/trainers/[id]");
  }
});
