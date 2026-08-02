import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreViewPinRepo } from "@/app/lib/server/view-pin-repo.firestore";
import { verifyViewPin } from "@/app/lib/domain/services/view-access-service";
import { apiError } from "@/app/lib/server/api-error";

/**
 * POST /api/flexos/view-access/verify — Core→Full geçiş PIN doğrulaması.
 * Body: { pin }. `view.toggle` gated.
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: { pin?: string };
  try { body = (await req.json()) as { pin?: string }; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }

  if (!body.pin) return NextResponse.json({ error: "pin zorunludur." }, { status: 400 });

  const actor = await actorFromCaller(caller);
  try {
    const result = await verifyViewPin(actor, body.pin, firestoreViewPinRepo);
    return NextResponse.json(result);
  } catch (e) {
    return apiError(e, "flexos/view-access/verify POST");
  }
});
