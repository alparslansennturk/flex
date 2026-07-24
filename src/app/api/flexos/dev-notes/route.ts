import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreDevNoteRepo } from "@/app/lib/server/dev-note-repo.firestore";
import { listDevNotes, createDevNote } from "@/app/lib/domain/services/dev-note-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import type { DevNotePriority } from "@/app/lib/domain/core/dev-note";

/** GET /api/flexos/dev-notes — liste (SADECE owner, view.toggle gated). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  try {
    const items = await listDevNotes(actor, firestoreDevNoteRepo);
    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    console.error("[flexos/dev-notes GET]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** POST /api/flexos/dev-notes — yeni not oluştur. */
export const POST = withAuth(async (req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  let body: { title?: string; description?: string; module?: string; priority?: DevNotePriority };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const note = await createDevNote(
      actor,
      {
        title: body.title ?? "",
        description: body.description ?? "",
        module: body.module ?? "",
        priority: body.priority ?? "orta",
      },
      firestoreDevNoteRepo,
    );
    return NextResponse.json(note, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/dev-notes POST]", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
