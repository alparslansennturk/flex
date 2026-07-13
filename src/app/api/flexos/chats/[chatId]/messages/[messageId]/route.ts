import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { firestoreChatRepo } from "@/app/lib/server/chat-repo.firestore";
import { editChatMessage, deleteChatMessage } from "@/app/lib/domain/services/comment-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

const deps = { chats: firestoreChatRepo };

/** PATCH /api/flexos/chats/[chatId]/messages/[messageId] — kendi chat mesajını düzenle (rol farketmez, sadece sahiplik). */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ chatId: string; messageId: string }> }) => {
  const { chatId, messageId } = await ctx.params;
  let body: { text: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    await editChatMessage(caller.uid, chatId, messageId, body.text, deps);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/chats/[chatId]/messages/[messageId] PATCH] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

/** DELETE /api/flexos/chats/[chatId]/messages/[messageId] — kendi chat mesajını sil (rol farketmez, sadece sahiplik). */
export const DELETE = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ chatId: string; messageId: string }> }) => {
  const { chatId, messageId } = await ctx.params;
  try {
    await deleteChatMessage(caller.uid, chatId, messageId, deps);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/chats/[chatId]/messages/[messageId] DELETE] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
