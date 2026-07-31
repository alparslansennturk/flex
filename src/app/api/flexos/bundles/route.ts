import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreBundleRepo } from "@/app/lib/server/bundle-repo.firestore";
import { createBundle, type CreateBundleInput } from "@/app/lib/domain/services/bundle-service";
import { can } from "@/app/lib/domain/access/can";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/bundles — paket listesi. */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  if (!can(actor, "bundle.read")) return NextResponse.json({ error: "Yetersiz yetki." }, { status: 403 });
  const items = await firestoreBundleRepo.list(actor.tenantId);
  return NextResponse.json({ items });
});

/** POST /api/flexos/bundles — paket oluştur. */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateBundleInput;
  try {
    body = (await req.json()) as CreateBundleInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const bundle = await createBundle((await actorFromCaller(caller)), body, firestoreBundleRepo);
    return NextResponse.json({ id: bundle.id }, { status: 201 });
  } catch (e) {
    return apiError(e, "flexos/bundles");
  }
});
