import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreEducationRepo } from "@/app/lib/server/catalog-repo.firestore";
import { createEducation, type CreateEducationInput } from "@/app/lib/domain/services/catalog-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/** POST /api/flexos/educations — eğitim oluştur (gated `education.create`). */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateEducationInput;
  try { body = (await req.json()) as CreateEducationInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }
  try {
    const education = await createEducation(actorFromCaller(caller), body, firestoreEducationRepo);
    return NextResponse.json({ id: education.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/educations]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** GET /api/flexos/educations?branchId=... — eğitim listesi. */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);
  const branchId = req.nextUrl.searchParams.get("branchId") ?? undefined;
  const items = await firestoreEducationRepo.list(actor.tenantId, branchId);
  return NextResponse.json({ items });
});
