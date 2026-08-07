import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreSurveyDispatchRepo } from "@/app/lib/server/survey-dispatch-repo.firestore";
import { firestoreSurveyResponseRepo } from "@/app/lib/server/survey-response-repo.firestore";
import { getDispatchResults } from "@/app/lib/domain/services/survey-dispatch-service";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/survey-dispatches/[dispatchId]/results — sonuç/analiz detayı. */
export const GET = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ dispatchId: string }> }) => {
  const { dispatchId } = await ctx.params;
  if (!dispatchId) return NextResponse.json({ error: "dispatchId eksik." }, { status: 400 });

  try {
    const actor = await actorFromCaller(caller);
    const results = await getDispatchResults(actor, dispatchId, {
      dispatches: firestoreSurveyDispatchRepo,
      responses: firestoreSurveyResponseRepo,
    });
    return NextResponse.json(results);
  } catch (e) {
    return apiError(e, "flexos/survey-dispatches/[dispatchId]/results GET");
  }
});
