import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreDevNoteRepo } from "@/app/lib/server/dev-note-repo.firestore";
import { listDevNotes, createDevNote } from "@/app/lib/domain/services/dev-note-service";
import { apiError } from "@/app/lib/server/api-error";
import type { DevNotePriority } from "@/app/lib/domain/core/dev-note";

/** GET /api/flexos/dev-notes — liste (SADECE owner, view.toggle gated). */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  try {
    const items = await listDevNotes(actor, firestoreDevNoteRepo);
    return NextResponse.json({ items });
  } catch (e) {
    return apiError(e, "flexos/dev-notes GET");
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
    return apiError(e, "flexos/dev-notes POST");
  }
});
