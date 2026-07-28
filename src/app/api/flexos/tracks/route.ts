import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreSectionRepo, firestoreTrackRepo } from "@/app/lib/server/catalog-repo.firestore";
import { createTrack, type CreateTrackInput } from "@/app/lib/domain/services/catalog-service";
import { broadcast } from "@/app/lib/server/realtime-hub";
import { apiError } from "@/app/lib/server/api-error";

/** POST /api/flexos/tracks — track oluştur (gated `track.create`). */
export const POST = withAuth(async (req: NextRequest, caller) => {
  let body: CreateTrackInput;
  try { body = (await req.json()) as CreateTrackInput; }
  catch { return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 }); }
  try {
    const actor = await actorFromCaller(caller);
    const track = await createTrack(actor, body, { tracks: firestoreTrackRepo, sections: firestoreSectionRepo });
    broadcast(actor.tenantId, { type: "educations.changed", id: track.id });
    return NextResponse.json({ id: track.id }, { status: 201 });
  } catch (e) {
    return apiError(e, "flexos/tracks");
  }
});

/** GET /api/flexos/tracks?educationId=... — track listesi. */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  const educationId = req.nextUrl.searchParams.get("educationId") ?? undefined;
  const items = await firestoreTrackRepo.list(actor.tenantId, educationId);
  return NextResponse.json({ items });
});
