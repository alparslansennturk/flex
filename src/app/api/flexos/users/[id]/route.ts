import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreFlexosUserRepo } from "@/app/lib/server/flexos-user-repo.firestore";
import {
  updateFlexosUser,
  deleteFlexosUser,
  type UpdateFlexosUserInput,
} from "@/app/lib/domain/services/flexos-user-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/flexos/users/[id] — Kullanıcı güncelle */
export const PATCH = withAuth<Ctx>(async (req: NextRequest, caller, ctx) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: UpdateFlexosUserInput;
  try {
    body = (await req.json()) as UpdateFlexosUserInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const user = await updateFlexosUser(actorFromCaller(caller), id, body, firestoreFlexosUserRepo);
    return NextResponse.json({ id: user.id });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/users/:id PATCH]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** DELETE /api/flexos/users/[id] — Kullanıcı sil */
export const DELETE = withAuth<Ctx>(async (_req: NextRequest, caller, ctx) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    await deleteFlexosUser(actorFromCaller(caller), id, firestoreFlexosUserRepo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/users/:id DELETE]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
