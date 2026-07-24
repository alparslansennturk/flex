import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreDevNoteRepo } from "@/app/lib/server/dev-note-repo.firestore";
import { updateDevNote, deleteDevNote } from "@/app/lib/domain/services/dev-note-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import type { DevNotePriority, DevNoteStatus } from "@/app/lib/domain/core/dev-note";

/** PATCH /api/flexos/dev-notes/[id] — kısmi güncelleme (başlık/açıklama/modül/öncelik/durum). */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const actor = await actorFromCaller(caller);
  let body: { title?: string; description?: string; module?: string; priority?: DevNotePriority; status?: DevNoteStatus };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    await updateDevNote(actor, id, body, firestoreDevNoteRepo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/dev-notes/:id PATCH]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** DELETE /api/flexos/dev-notes/[id] */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const actor = await actorFromCaller(caller);
  try {
    await deleteDevNote(actor, id, firestoreDevNoteRepo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    console.error("[flexos/dev-notes/:id DELETE]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
