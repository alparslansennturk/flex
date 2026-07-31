import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { editMessage, deleteMessageForEveryone, deleteMessageForMe } from "@/app/lib/domain/services/connect-service";
import { deleteFromDrive } from "@/app/lib/googledrive";
import { deleteObject } from "@/app/lib/googlestorage";
import { apiError } from "@/app/lib/server/api-error";

/**
 * PATCH — mesajı düzenle (SADECE yazar, WhatsApp — 2026-07-18).
 * DELETE?scope=everyone|me — "herkes için sil" (SADECE yazar) / "benim için sil" (herkes).
 */
export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string; messageId: string }> }) => {
  const { id, messageId } = await ctx.params;
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const message = await editMessage(principal, id, messageId, body.text ?? "", connectDeps);
    return NextResponse.json({ id: message.id });
  } catch (e) {
    return apiError(e, "flexos/connect/conversations/[id]/messages/[messageId]");
  }
});

export const DELETE = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string; messageId: string }> }) => {
  const { id, messageId } = await ctx.params;
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  const scope = req.nextUrl.searchParams.get("scope") === "everyone" ? "everyone" : "me";

  try {
    if (scope === "everyone") {
      const deleted = await deleteMessageForEveryone(principal, id, messageId, connectDeps);
      // Gerçek dosya da silinir (2026-07-18 kullanıcı bulgusu — best-effort, hata
      // "silme" işlemini geri almaz, sadece loglanır). 2026-07-21: storagePath'i
      // olan (GCS) ekler googlestorage'dan, driveFileId'si olan (eski) Drive'dan silinir.
      if (deleted.attachments?.length) {
        const results = await Promise.allSettled(
          deleted.attachments.map((a) => (a.storagePath ? deleteObject(a.storagePath) : a.driveFileId ? deleteFromDrive(a.driveFileId) : Promise.resolve())),
        );
        results.forEach((r) => { if (r.status === "rejected") console.error("[connect attachment] dosya silme hatası:", r.reason); });
      }
    } else {
      await deleteMessageForMe(principal, id, messageId, connectDeps);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "flexos/connect/conversations/[id]/messages/[messageId]");
  }
});
