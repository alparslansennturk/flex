import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreSurveyRepo } from "@/app/lib/server/survey-repo.firestore";
import { getSurvey, updateSurvey, deleteSurvey, type UpdateSurveyInput } from "@/app/lib/domain/services/survey-service";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/surveys/[id] — tek anket detay (düzenleme formu için). */
export const GET = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    const survey = await getSurvey(await actorFromCaller(caller), id, firestoreSurveyRepo);
    return NextResponse.json({ survey });
  } catch (e) {
    return apiError(e, "flexos/surveys/[id] GET");
  }
});

/** PATCH /api/flexos/surveys/[id] — anket güncelle (gated `survey.manage`, sahiplik kontrolü). */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: UpdateSurveyInput;
  try {
    body = (await req.json()) as UpdateSurveyInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const survey = await updateSurvey(await actorFromCaller(caller), id, body, firestoreSurveyRepo);
    return NextResponse.json({ id: survey.id });
  } catch (e) {
    return apiError(e, "flexos/surveys/[id] PATCH");
  }
});

/** DELETE /api/flexos/surveys/[id] — anket sil (gated `survey.manage`, sahiplik kontrolü). */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    await deleteSurvey(await actorFromCaller(caller), id, firestoreSurveyRepo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "flexos/surveys/[id] DELETE");
  }
});
