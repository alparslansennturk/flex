import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreLabRepo } from "@/app/lib/server/catalog-repo.firestore";
import { createLab, type CreateLabInput } from "@/app/lib/domain/services/catalog-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { broadcast } from "@/app/lib/server/realtime-hub";

/** POST /api/flexos/labs — laboratuvar oluştur (gated `lab.create`). */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateLabInput;
  try { body = (await req.json()) as CreateLabInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }
  try {
    const actor = await actorFromCaller(caller);
    const lab = await createLab(actor, body, firestoreLabRepo);
    broadcast(actor.tenantId, { type: "educations.changed", id: lab.id });
    return NextResponse.json({ id: lab.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/labs]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** GET /api/flexos/labs — laboratuvar listesi (kiracıya göre). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  const items = await firestoreLabRepo.list(actor.tenantId);
  return NextResponse.json({ items });
});
