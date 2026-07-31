import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreViewPinRepo } from "@/app/lib/server/view-pin-repo.firestore";
import { setViewPin } from "@/app/lib/domain/services/view-access-service";
import { apiError } from "@/app/lib/server/api-error";

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
    return apiError(e, "flexos/view-access/pin");
  }
});
