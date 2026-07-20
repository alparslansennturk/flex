import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { buildMessageViews } from "@/app/lib/server/connect-view";
import { listMessages, listMembers, sendMessage } from "@/app/lib/domain/services/connect-service";
import { notifyNewMessage } from "@/app/lib/domain/services/connect-push-service";
import { firestoreConnectPushRepo } from "@/app/lib/server/connect-push-repo.firestore";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * GET /api/flexos/connect/conversations/[id]/messages — mesaj geçmişi (isim/renk çözülmüş).
 * POST /api/flexos/connect/conversations/[id]/messages — mesaj gönder (writePolicy uygulanır).
 * Gerçek-zamanlılık client'ta doğrudan Firestore `onSnapshot` ile (bkz. FLEX_CONNECT.md §5) —
 * bu route'lar ilk yükleme/fallback + gönderme içindir.
 */
export const GET = withAuth(async (_req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  try {
    const messages = await listMessages(principal, id, connectDeps, 60);
    // Okundu-tikleri (Faz 2 madde 3) — DİĞER üyelerin `lastReadAt`'i, var olan
    // veriden türetilir, yeni bir "okundu" kaydı YOK.
    const members = await listMembers(principal, id, connectDeps);
    const otherReadAts = members.filter((m) => m.uid !== principal.uid).map((m) => m.lastReadAt).filter((t): t is string => !!t);
    const views = await buildMessageViews(messages, principal.uid, principal.tenantId, otherReadAts);
    return NextResponse.json({ items: views });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error("[flexos/connect/conversations/:id/messages GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  let body: { text?: string; replyTo?: { messageId: string; authorUid: string; authorName: string; textSnippet: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const message = await sendMessage(principal, id, body.text ?? "", connectDeps, undefined, body.replyTo);
    await notifyNewMessage(id, message, principal.uid, principal.tenantId, connectDeps, firestoreConnectPushRepo);
    return NextResponse.json({ id: message.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/connect/conversations/:id/messages POST] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
