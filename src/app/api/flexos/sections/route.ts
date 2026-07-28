import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreEducationRepo, firestoreSectionRepo } from "@/app/lib/server/catalog-repo.firestore";
import { createSection, type CreateSectionInput } from "@/app/lib/domain/services/catalog-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { apiError } from "@/app/lib/server/api-error";

/** POST /api/flexos/sections — bölüm oluştur (gated `section.create`). */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateSectionInput;
  try { body = (await req.json()) as CreateSectionInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }
  try {
    const actor = await actorFromCaller(caller);
    const section = await createSection(actor, body, { sections: firestoreSectionRepo, educations: firestoreEducationRepo });
    broadcast(actor.tenantId, { type: "educations.changed", id: section.id });
    return NextResponse.json({ id: section.id }, { status: 201 });
  } catch (e) {
    return apiError(e, "flexos/sections");
  }
});

/** GET /api/flexos/sections?educationId=... — bölüm listesi. */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  const educationId = req.nextUrl.searchParams.get("educationId") ?? undefined;
  const items = await firestoreSectionRepo.list(actor.tenantId, educationId);
  return NextResponse.json({ items });
});
