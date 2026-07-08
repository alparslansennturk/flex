import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreViewPinRepo } from "@/app/lib/server/view-pin-repo.firestore";
import { getViewAccessStatus } from "@/app/lib/domain/services/view-access-service";
import { ForbiddenError } from "@/app/lib/domain/errors";

/** GET /api/flexos/view-access — owner mı + PIN kurulu mu (`view.toggle` gated). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  try {
    const status = await getViewAccessStatus(actor, firestoreViewPinRepo);
    return NextResponse.json(status);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    console.error("[flexos/view-access GET]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
