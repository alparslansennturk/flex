import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreCampaignRepo } from "@/app/lib/server/campaign-repo.firestore";
import {
  updateCampaign,
  deleteCampaign,
  type UpdateCampaignInput,
} from "@/app/lib/domain/services/campaign-service";
import { apiError } from "@/app/lib/server/api-error";

/** PATCH /api/flexos/campaigns/[id] — kampanya güncelle. */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  let body: UpdateCampaignInput;
  try {
    body = (await req.json()) as UpdateCampaignInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const campaign = await updateCampaign((await actorFromCaller(caller)), id, body, firestoreCampaignRepo);
    return NextResponse.json({ id: campaign.id });
  } catch (e) {
    return apiError(e, "flexos/campaigns/[id]");
  }
});

/** DELETE /api/flexos/campaigns/[id] — kampanya sil. */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id eksik." }, { status: 400 });

  try {
    await deleteCampaign((await actorFromCaller(caller)), id, firestoreCampaignRepo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "flexos/campaigns/[id]");
  }
});
