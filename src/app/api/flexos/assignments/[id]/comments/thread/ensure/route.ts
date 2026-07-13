import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreChatRepo } from "@/app/lib/server/chat-repo.firestore";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import { ensureThreadChatForStaff } from "@/app/lib/domain/services/comment-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

const deps = {
  assignments: firestoreAssignmentRepo,
  groups: firestoreGroupRepo,
  persons: firestorePersonRepo,
  chats: firestoreChatRepo,
  trainers: firestoreTrainerRepo,
};

/**
 * POST /api/flexos/assignments/[id]/comments/thread/ensure?personId=... — sayfa mount
 * olduğunda (ilk mesajdan ÖNCE) `chats/{chatId}` dokümanını garanti eder — client
 * `onSnapshot` ile boş bir thread'i bile dinleyebilsin diye (bkz. comment-service.ts).
 */
export const POST = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const personId = req.nextUrl.searchParams.get("personId");
  if (!personId) return NextResponse.json({ error: "personId zorunlu." }, { status: 400 });

  const actor = await actorFromCaller(caller);
  try {
    await ensureThreadChatForStaff(actor, id, personId, deps);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/assignments/[id]/comments/thread/ensure POST] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
