import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreBranchRepo } from "@/app/lib/server/catalog-repo.firestore";
import { createBranch, type CreateBranchInput } from "@/app/lib/domain/services/catalog-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/** POST /api/flexos/branches — branş oluştur (gated `branch.create`). */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateBranchInput;
  try { body = (await req.json()) as CreateBranchInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }
  try {
    const branch = await createBranch((await actorFromCaller(caller)), body, firestoreBranchRepo);
    return NextResponse.json({ id: branch.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/branches]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** GET /api/flexos/branches — branş listesi (kiracıya göre). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  const items = await firestoreBranchRepo.list(actor.tenantId);
  return NextResponse.json({ items });
});
