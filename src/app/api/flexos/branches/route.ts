import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreBranchRepo } from "@/app/lib/server/catalog-repo.firestore";
import { createBranch, type CreateBranchInput } from "@/app/lib/domain/services/catalog-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { apiError } from "@/app/lib/server/api-error";

/** POST /api/flexos/branches — branş oluştur (gated `branch.create`). */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateBranchInput;
  try { body = (await req.json()) as CreateBranchInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }
  try {
    const actor = await actorFromCaller(caller);
    const branch = await createBranch(actor, body, firestoreBranchRepo);
    broadcast(actor.tenantId, { type: "educations.changed", id: branch.id });
    return NextResponse.json({ id: branch.id }, { status: 201 });
  } catch (e) {
    return apiError(e, "flexos/branches");
  }
});

/** GET /api/flexos/branches — branş listesi (kiracıya göre). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  const items = await firestoreBranchRepo.list(actor.tenantId);
  return NextResponse.json({ items });
});
