import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreTrackRepo } from "@/app/lib/server/catalog-repo.firestore";
import { createTrack, type CreateTrackInput } from "@/app/lib/domain/services/catalog-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/** POST /api/flexos/tracks — track oluştur (gated `track.create`). */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateTrackInput;
  try { body = (await req.json()) as CreateTrackInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }
  try {
    const track = await createTrack(actorFromCaller(caller), body, firestoreTrackRepo);
    return NextResponse.json({ id: track.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/tracks]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** GET /api/flexos/tracks?educationId=... — track listesi. */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);
  const educationId = req.nextUrl.searchParams.get("educationId") ?? undefined;
  const items = await firestoreTrackRepo.list(actor.tenantId, educationId);
  return NextResponse.json({ items });
});
