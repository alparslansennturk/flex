import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreRoleDefRepo } from "@/app/lib/server/role-def-repo.firestore";
import { listRoleDefs, createRoleDef, type CreateRoleDefInput } from "@/app/lib/domain/services/role-def-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/** GET /api/flexos/role-defs — rol listesi (gated `role.manage`, ilk çağrıda 6 yerleşik rol tohumlanır). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  try {
    const items = await listRoleDefs(actorFromCaller(caller), firestoreRoleDefRepo);
    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    console.error("[flexos/role-defs GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
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
    const roleDef = await createRoleDef(actorFromCaller(caller), body, firestoreRoleDefRepo);
    return NextResponse.json({ item: roleDef }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/role-defs POST] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
