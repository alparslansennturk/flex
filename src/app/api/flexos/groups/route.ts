import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { createGroup, type CreateGroupInput } from "@/app/lib/domain/services/group-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/groups — yeni grup oluştur (gated `group.create`).
 * Yazım Admin SDK ile yeni `flexos_groups` koleksiyonuna; canlı `groups`'a dokunmaz.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateGroupInput;
  try {
    body = (await req.json()) as CreateGroupInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = actorFromCaller(caller);

  try {
    const group = await createGroup(actor, body, firestoreGroupRepo);
    return NextResponse.json({ id: group.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/groups] beklenmeyen hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
