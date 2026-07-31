import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreEducationRepo } from "@/app/lib/server/catalog-repo.firestore";
import { createEducation, type CreateEducationInput } from "@/app/lib/domain/services/catalog-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { apiError } from "@/app/lib/server/api-error";

/** POST /api/flexos/educations — eğitim oluştur (gated `education.create`). */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateEducationInput;
  try { body = (await req.json()) as CreateEducationInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }
  try {
    const actor = await actorFromCaller(caller);
    const education = await createEducation(actor, body, firestoreEducationRepo);
    broadcast(actor.tenantId, { type: "educations.changed", id: education.id });
    return NextResponse.json({ id: education.id }, { status: 201 });
  } catch (e) {
    return apiError(e, "flexos/educations");
  }
});

/** GET /api/flexos/educations?branchId=...&onSale=true — eğitim listesi. */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  const branchId = req.nextUrl.searchParams.get("branchId") ?? undefined;
  const onSaleParam = req.nextUrl.searchParams.get("onSale");
  let items = await firestoreEducationRepo.list(actor.tenantId, branchId);
  if (onSaleParam === "true") items = items.filter((e) => e.onSale === true);
  return NextResponse.json({ items });
});
