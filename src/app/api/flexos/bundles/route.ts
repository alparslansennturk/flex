import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreBundleRepo } from "@/app/lib/server/bundle-repo.firestore";
import { createBundle, type CreateBundleInput } from "@/app/lib/domain/services/bundle-service";
import { can } from "@/app/lib/domain/access/can";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/** GET /api/flexos/bundles — paket listesi. */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);
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
    const bundle = await createBundle(actorFromCaller(caller), body, firestoreBundleRepo);
    return NextResponse.json({ id: bundle.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/bundles POST]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
