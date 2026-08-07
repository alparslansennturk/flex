import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreSurveyDispatchRepo } from "@/app/lib/server/survey-dispatch-repo.firestore";
import { listDispatches } from "@/app/lib/domain/services/survey-dispatch-service";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/survey-dispatches — tüm gönderimler (dashboard KPI + "Aktif"/"Tamamlanan"/"Sonuçlar" sekmeleri). */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const surveyId = req.nextUrl.searchParams.get("surveyId") ?? undefined;
  try {
    const actor = await actorFromCaller(caller);
    const items = await listDispatches(actor, firestoreSurveyDispatchRepo, { surveyId });
    return NextResponse.json({ items });
  } catch (e) {
    return apiError(e, "flexos/survey-dispatches GET");
  }
});
