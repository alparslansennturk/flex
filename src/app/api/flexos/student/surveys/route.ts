import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import { firestoreSurveyDispatchRepo } from "@/app/lib/server/survey-dispatch-repo.firestore";
import { firestoreSurveyResponseRepo } from "@/app/lib/server/survey-response-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { listSurveysForStudent } from "@/app/lib/domain/services/survey-response-service";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/student/surveys?personId=... — öğrencinin bekleyen+geçmiş anketleri. */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const personId = req.nextUrl.searchParams.get("personId");
  if (!personId) return NextResponse.json({ error: "personId zorunlu." }, { status: 400 });

  try {
    const items = await listSurveysForStudent(caller.uid, DEFAULT_TENANT, personId, {
      dispatches: firestoreSurveyDispatchRepo,
      responses: firestoreSurveyResponseRepo,
      persons: firestorePersonRepo,
    });
    return NextResponse.json({ items });
  } catch (e) {
    return apiError(e, "flexos/student/surveys GET");
  }
});
