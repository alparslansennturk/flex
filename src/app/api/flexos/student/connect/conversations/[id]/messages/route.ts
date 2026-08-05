import { NextRequest, NextResponse, after } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { studentPrincipalFromRequest } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { buildMessageViews } from "@/app/lib/server/connect-view";
import { listMessages, listMembers, sendMessage } from "@/app/lib/domain/services/connect-service";
import { notifyNewMessage } from "@/app/lib/domain/services/connect-push-service";
import { firestoreConnectPushRepo } from "@/app/lib/server/connect-push-repo.firestore";
import { makeObjectPublic, publicUrl } from "@/app/lib/googlestorage";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

export const GET = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await studentPrincipalFromRequest(req, caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  try {
    const messages = await listMessages(principal, id, connectDeps, 60);
    const members = await listMembers(principal, id, connectDeps);
    const otherMembers = members.filter((m) => m.uid !== principal.uid);
    const otherReadAts = otherMembers.map((m) => m.lastReadAt).filter((t): t is string => !!t);
    const otherDeliveredAts = otherMembers.map((m) => m.lastDeliveredAt).filter((t): t is string => !!t);
    const views = await buildMessageViews(messages, principal.uid, principal.tenantId, otherReadAts, otherDeliveredAts, true);
    return NextResponse.json({ items: views });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error("[flexos/student/connect/conversations/:id/messages GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await studentPrincipalFromRequest(req, caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  let body: {
    text?: string;
    replyTo?: { messageId: string; authorUid: string; authorName: string; textSnippet: string };
    attachment?: { storagePath: string; fileName: string; fileSize: number; mimeType: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    let attachments;
    if (body.attachment) {
      const { storagePath, fileName, fileSize, mimeType } = body.attachment;
      await makeObjectPublic(storagePath);
      attachments = [{ storagePath, webViewLink: publicUrl(storagePath), fileName, fileSize, mimeType }];
    }
    // writePolicy servis katmanında uygulanır — öğrenci sadece üye olduğu group/dm'e
    // yazabilir; audience kanalları (writePolicy:"admins") ASLA yazamaz (sadece okur).
    const message = await sendMessage(principal, id, body.text ?? "", connectDeps, attachments, body.replyTo);
    // Bildirim gönderimini yanıttan sonraya ertele — bkz. staff route'undaki AYNI
    // yorum (2026-08-05, k6 bulgusu). `notifyNewMessage` kendi içinde try/catch'li.
    after(() => notifyNewMessage(id, message, principal.uid, principal.tenantId, connectDeps, firestoreConnectPushRepo));
    return NextResponse.json({ id: message.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/student/connect/conversations/:id/messages POST] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
