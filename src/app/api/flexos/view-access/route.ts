import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreViewPinRepo } from "@/app/lib/server/view-pin-repo.firestore";
import { getViewAccessStatus } from "@/app/lib/domain/services/view-access-service";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/view-access — owner mı + PIN kurulu mu (`view.toggle` gated). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  try {
    const status = await getViewAccessStatus(actor, firestoreViewPinRepo);
    return NextResponse.json(status);
  } catch (e) {
    return apiError(e, "flexos/view-access GET");
  }
});
