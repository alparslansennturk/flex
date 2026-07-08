import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreViewPinRepo } from "@/app/lib/server/view-pin-repo.firestore";
import { setViewPin } from "@/app/lib/domain/services/view-access-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/view-access/pin — PIN kurar/değiştirir (kurulum ve değişiklik aynı).
 * Body: { newPin }. Eski PIN istenmez — bu ekrana ulaşmak için zaten owner auth+capability şart.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: { newPin?: string };
  try { body = (await req.json()) as { newPin?: string }; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }

  if (!body.newPin) return NextResponse.json({ error: "newPin zorunludur." }, { status: 400 });

  const actor = await actorFromCaller(caller);
  try {
    await setViewPin(actor, { newPin: body.newPin }, firestoreViewPinRepo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/view-access/pin POST]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
