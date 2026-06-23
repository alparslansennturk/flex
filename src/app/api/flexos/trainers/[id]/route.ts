import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import { updateTrainer, deleteTrainer, type UpdateTrainerInput } from "@/app/lib/domain/services/trainer-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

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
    const result = await updateTrainer(actorFromCaller(caller), id, body, firestoreTrainerRepo);
    return NextResponse.json({ id: result.trainer.id, rateDropped: result.rateDropped });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/trainers/:id PATCH]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/**
 * DELETE /api/flexos/trainers/[id] — eğitmen sil (gated `trainer.delete`).
 */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    await deleteTrainer(actorFromCaller(caller), id, firestoreTrainerRepo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/trainers/:id DELETE]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
