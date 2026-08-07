import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreSurveyRepo } from "@/app/lib/server/survey-repo.firestore";
import { firestoreSurveyDispatchRepo } from "@/app/lib/server/survey-dispatch-repo.firestore";
import { firestoreSurveyResponseRepo } from "@/app/lib/server/survey-response-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { listCandidateStudents } from "@/app/lib/domain/services/survey-dispatch-service";
import { apiError } from "@/app/lib/server/api-error";

/**
 * GET /api/flexos/surveys/[id]/candidate-students?q=... — "Tek Öğrenci" gönderim modu:
 * anketin uygun sınıflarındaki (Klasik→eğitim sonu, Hızlı→aktif) öğrencilerde isim arar.
 */
export const GET = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });
  const q = req.nextUrl.searchParams.get("q") ?? "";

  try {
    const actor = await actorFromCaller(caller);
    const items = await listCandidateStudents(actor, id, q, {
      surveys: firestoreSurveyRepo,
      dispatches: firestoreSurveyDispatchRepo,
      responses: firestoreSurveyResponseRepo,
      groups: firestoreGroupRepo,
      enrollments: firestoreEnrollmentRepo,
      persons: firestorePersonRepo,
    });
    return NextResponse.json({ items });
  } catch (e) {
    return apiError(e, "flexos/surveys/[id]/candidate-students GET");
  }
});
