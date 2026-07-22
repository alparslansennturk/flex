import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreBranchOfficeRepo } from "@/app/lib/server/catalog-repo.firestore";
import { createBranchOffice, type CreateBranchOfficeInput } from "@/app/lib/domain/services/catalog-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { broadcast } from "@/app/lib/server/realtime-hub";

/** POST /api/flexos/branch-offices — şube oluştur (gated `office.create`). */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateBranchOfficeInput;
  try { body = (await req.json()) as CreateBranchOfficeInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }
  try {
    const actor = await actorFromCaller(caller);
    const office = await createBranchOffice(actor, body, firestoreBranchOfficeRepo);
    broadcast(actor.tenantId, { type: "educations.changed", id: office.id });
    return NextResponse.json({ id: office.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/branch-offices]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** GET /api/flexos/branch-offices — şube listesi (kiracıya göre). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  const items = await firestoreBranchOfficeRepo.list(actor.tenantId);
  return NextResponse.json({ items });
});
