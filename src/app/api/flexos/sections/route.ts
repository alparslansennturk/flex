import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreEducationRepo, firestoreSectionRepo } from "@/app/lib/server/catalog-repo.firestore";
import { createSection, type CreateSectionInput } from "@/app/lib/domain/services/catalog-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/** POST /api/flexos/sections — bölüm oluştur (gated `section.create`). */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateSectionInput;
  try { body = (await req.json()) as CreateSectionInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }
  try {
    const section = await createSection(actorFromCaller(caller), body, { sections: firestoreSectionRepo, educations: firestoreEducationRepo });
    return NextResponse.json({ id: section.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/sections]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** GET /api/flexos/sections?educationId=... — bölüm listesi. */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);
  const educationId = req.nextUrl.searchParams.get("educationId") ?? undefined;
  const items = await firestoreSectionRepo.list(actor.tenantId, educationId);
  return NextResponse.json({ items });
});
