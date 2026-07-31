import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreBundleRepo } from "@/app/lib/server/bundle-repo.firestore";
import { updateBundle, deleteBundle, type UpdateBundleInput } from "@/app/lib/domain/services/bundle-service";
import { apiError } from "@/app/lib/server/api-error";

/** PATCH /api/flexos/bundles/[id] — paket güncelle. */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: UpdateBundleInput;
  try {
    body = (await req.json()) as UpdateBundleInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const bundle = await updateBundle((await actorFromCaller(caller)), id, body, firestoreBundleRepo);
    return NextResponse.json({ id: bundle.id });
  } catch (e) {
    return apiError(e, "flexos/bundles/[id]");
  }
});

/** DELETE /api/flexos/bundles/[id] — paket sil. */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    await deleteBundle((await actorFromCaller(caller)), id, firestoreBundleRepo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "flexos/bundles/[id]");
  }
});
