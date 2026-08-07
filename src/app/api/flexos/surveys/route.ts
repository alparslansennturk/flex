import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreSurveyRepo } from "@/app/lib/server/survey-repo.firestore";
import { createSurvey, listSurveys, type CreateSurveyInput } from "@/app/lib/domain/services/survey-service";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/surveys — anket kütüphanesi listesi (self-scope aktör sadece kendi anketlerini görür). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  try {
    const actor = await actorFromCaller(caller);
    const items = await listSurveys(actor, firestoreSurveyRepo);
    return NextResponse.json({ items });
  } catch (e) {
    return apiError(e, "flexos/surveys GET");
  }
});

/** POST /api/flexos/surveys — yeni anket oluştur (gated `survey.manage`). */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateSurveyInput;
  try {
    body = (await req.json()) as CreateSurveyInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const actor = await actorFromCaller(caller);
    const survey = await createSurvey(actor, body, firestoreSurveyRepo);
    return NextResponse.json({ id: survey.id }, { status: 201 });
  } catch (e) {
    return apiError(e, "flexos/surveys POST");
  }
});
