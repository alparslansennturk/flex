import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreRoleDefRepo } from "@/app/lib/server/role-def-repo.firestore";
import { listRoleDefs, createRoleDef, type CreateRoleDefInput } from "@/app/lib/domain/services/role-def-service";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/role-defs — rol listesi (gated `role.manage`, ilk çağrıda 6 yerleşik rol tohumlanır). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  try {
    const items = await listRoleDefs((await actorFromCaller(caller)), firestoreRoleDefRepo);
    return NextResponse.json({ items });
  } catch (e) {
    return apiError(e, "flexos/role-defs GET");
  }
});

/** POST /api/flexos/role-defs — yeni (kurum-özel) rol tanımla (gated `role.manage`). */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateRoleDefInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const roleDef = await createRoleDef((await actorFromCaller(caller)), body, firestoreRoleDefRepo);
    return NextResponse.json({ item: roleDef }, { status: 201 });
  } catch (e) {
    return apiError(e, "flexos/role-defs POST");
  }
});
