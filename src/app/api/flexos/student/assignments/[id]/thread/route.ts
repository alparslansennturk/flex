import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import { firestoreAssignmentRepo } from "@/app/lib/server/assignment-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestoreCommentRepo } from "@/app/lib/server/comment-repo.firestore";
import { firestoreChatRepo } from "@/app/lib/server/chat-repo.firestore";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import { notifyUser } from "@/app/lib/server/flexos-notify";
import { listThreadCommentsForStudent, postThreadCommentAsStudent } from "@/app/lib/domain/services/comment-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

const deps = {
  assignments: firestoreAssignmentRepo,
  groups: firestoreGroupRepo,
  persons: firestorePersonRepo,
  enrollments: firestoreEnrollmentRepo,
  comments: firestoreCommentRepo,
  chats: firestoreChatRepo,
  trainers: firestoreTrainerRepo,
  notify: notifyUser,
};

/** GET /api/flexos/student/assignments/[id]/thread?personId=... — kendi 1:1 thread'i. */
export const GET = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const personId = req.nextUrl.searchParams.get("personId");
  if (!personId) return NextResponse.json({ error: "personId zorunlu." }, { status: 400 });

  try {
    const items = await listThreadCommentsForStudent(caller.uid, DEFAULT_TENANT, personId, id, deps);
    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/student/assignments/[id]/thread GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** POST /api/flexos/student/assignments/[id]/thread — kendi 1:1 thread'ine yaz. */
export const POST = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  let body: { personId: string; text: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const comment = await postThreadCommentAsStudent(caller.uid, DEFAULT_TENANT, body.personId, id, body.text, deps);
    return NextResponse.json({ id: comment.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/student/assignments/[id]/thread POST] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
