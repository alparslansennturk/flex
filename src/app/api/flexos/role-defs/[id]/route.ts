import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreRoleDefRepo } from "@/app/lib/server/role-def-repo.firestore";
import { updateRoleDef, type UpdateRoleDefInput } from "@/app/lib/domain/services/role-def-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/** PATCH /api/flexos/role-defs/[id] — rol güncelle (yetki modülleri dahil, gated `role.manage`). */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  let body: UpdateRoleDefInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const roleDef = await updateRoleDef((await actorFromCaller(caller)), id, body, firestoreRoleDefRepo);
    return NextResponse.json({ item: roleDef });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/role-defs/[id] PATCH] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
