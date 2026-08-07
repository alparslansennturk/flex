import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreSurveyRepo } from "@/app/lib/server/survey-repo.firestore";
import { firestoreSurveyDispatchRepo } from "@/app/lib/server/survey-dispatch-repo.firestore";
import { firestoreSurveyResponseRepo } from "@/app/lib/server/survey-response-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { notifyUser } from "@/app/lib/server/flexos-notify";
import { dispatchSurvey, type DispatchSurveyInput } from "@/app/lib/domain/services/survey-dispatch-service";
import { apiError } from "@/app/lib/server/api-error";

/**
 * POST /api/flexos/surveys/[id]/dispatch — "Anket Yap": seçilen sınıf(lar)a anket gönder.
 * Her `groupId` için ayrı bir `SurveyDispatch` açılır — aynı anket farklı zamanlarda/sınıflara
 * tekrar tekrar gönderilebilir (2026-08-07 kararı). Gönderim sonrası roster'daki her öğrenciye
 * (Firebase hesabı varsa) bildirim düşer, non-fatal.
 */
export const POST = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: { groupIds: string[]; onlyPersonIds?: Record<string, string[]> };
  try {
    body = (await req.json()) as { groupIds: string[]; onlyPersonIds?: Record<string, string[]> };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const actor = await actorFromCaller(caller);
    const input: DispatchSurveyInput = { surveyId: id, groupIds: body.groupIds ?? [], onlyPersonIds: body.onlyPersonIds };
    const dispatches = await dispatchSurvey(actor, input, {
      surveys: firestoreSurveyRepo,
      dispatches: firestoreSurveyDispatchRepo,
      responses: firestoreSurveyResponseRepo,
      groups: firestoreGroupRepo,
      enrollments: firestoreEnrollmentRepo,
      persons: firestorePersonRepo,
      notify: notifyUser,
    });
    return NextResponse.json({ items: dispatches.map((d) => ({ id: d.id, groupId: d.groupId })) }, { status: 201 });
  } catch (e) {
    return apiError(e, "flexos/surveys/[id]/dispatch POST");
  }
});
