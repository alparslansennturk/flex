import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import { firestoreCommentRepo } from "@/app/lib/server/comment-repo.firestore";
import { editOwnComment, deleteOwnComment } from "@/app/lib/domain/services/comment-service";
import { apiError } from "@/app/lib/server/api-error";

/** PATCH /api/flexos/comments/[id] — kendi yorumunu düzenle (rol farketmez, sadece `authorUid` sahipliği). */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  let body: { text: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const comment = await editOwnComment(caller.uid, DEFAULT_TENANT, id, body.text, { comments: firestoreCommentRepo });
    return NextResponse.json({ id: comment.id, text: comment.text });
  } catch (e) {
    return apiError(e, "flexos/comments/[id]");
  }
});

/** DELETE /api/flexos/comments/[id] — kendi yorumunu sil (rol farketmez, sadece `authorUid` sahipliği). */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  try {
    await deleteOwnComment(caller.uid, DEFAULT_TENANT, id, { comments: firestoreCommentRepo });
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e, "flexos/comments/[id]");
  }
});
