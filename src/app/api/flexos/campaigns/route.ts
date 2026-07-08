import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreCampaignRepo } from "@/app/lib/server/campaign-repo.firestore";
import { createCampaign, type CreateCampaignInput } from "@/app/lib/domain/services/campaign-service";
import { can } from "@/app/lib/domain/access/can";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

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
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/campaigns POST]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
