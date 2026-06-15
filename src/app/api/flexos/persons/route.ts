import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { createPerson, type CreatePersonInput } from "@/app/lib/domain/services/person-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/persons — yeni kişi oluştur (gated).
 *
 * Yetki + PII filtreleme service'te (`createPerson`). Bu route sadece:
 *  token → Actor, gövde → input, hata → HTTP kodu.
 * Yazım Admin SDK ile yeni `persons` koleksiyonuna; canlıya dokunmaz.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreatePersonInput;
  try {
    body = (await req.json()) as CreatePersonInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const actor = actorFromCaller(caller);

  try {
    const result = await createPerson(actor, body, firestorePersonRepo);
    return NextResponse.json(
      { id: result.person.id, piiDropped: result.piiDropped },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    }
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[flexos/persons] beklenmeyen hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
