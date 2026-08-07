import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import { firestoreSurveyDispatchRepo } from "@/app/lib/server/survey-dispatch-repo.firestore";
import { firestoreSurveyResponseRepo } from "@/app/lib/server/survey-response-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { submitSurveyResponse } from "@/app/lib/domain/services/survey-response-service";
import type { SurveyAnswer } from "@/app/lib/domain/core/survey-response";
import { apiError } from "@/app/lib/server/api-error";

/** POST /api/flexos/student/surveys/[dispatchId]/respond — cevap gönder. Tekrar doldurma engellenir. */
export const POST = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ dispatchId: string }> }) => {
  const { dispatchId } = await ctx.params;

  let body: { personId: string; answers: SurveyAnswer[] };
  try {
    body = (await req.json()) as { personId: string; answers: SurveyAnswer[] };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  if (!body.personId) return NextResponse.json({ error: "personId zorunlu." }, { status: 400 });

  try {
    const response = await submitSurveyResponse(caller.uid, DEFAULT_TENANT, body.personId, dispatchId, body.answers ?? [], {
      dispatches: firestoreSurveyDispatchRepo,
      responses: firestoreSurveyResponseRepo,
      persons: firestorePersonRepo,
    });
    return NextResponse.json({ id: response.id }, { status: 201 });
  } catch (e) {
    return apiError(e, "flexos/student/surveys/[dispatchId]/respond POST");
  }
});
