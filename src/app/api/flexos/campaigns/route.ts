import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreCampaignRepo } from "@/app/lib/server/campaign-repo.firestore";
import { createCampaign, type CreateCampaignInput } from "@/app/lib/domain/services/campaign-service";
import { can } from "@/app/lib/domain/access/can";
import { apiError } from "@/app/lib/server/api-error";

/** GET /api/flexos/campaigns — kampanya listesi. */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  if (!can(actor, "campaign.read")) return NextResponse.json({ error: "Yetersiz yetki." }, { status: 403 });
  const items = await firestoreCampaignRepo.list(actor.tenantId);
  return NextResponse.json({ items });
});

/** POST /api/flexos/campaigns — kampanya oluştur. */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateCampaignInput;
  try {
    body = (await req.json()) as CreateCampaignInput;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const campaign = await createCampaign((await actorFromCaller(caller)), body, firestoreCampaignRepo);
    return NextResponse.json({ id: campaign.id }, { status: 201 });
  } catch (e) {
    return apiError(e, "flexos/campaigns");
  }
});
