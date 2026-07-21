import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { studentPrincipalFromRequest } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { editMessage, deleteMessageForEveryone, deleteMessageForMe } from "@/app/lib/domain/services/connect-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { deleteFromDrive } from "@/app/lib/googledrive";
import { deleteObject } from "@/app/lib/googlestorage";

export const PATCH = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string; messageId: string }> }) => {
  const { id, messageId } = await ctx.params;
  const principal = await studentPrincipalFromRequest(req, caller);
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
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[student/connect/.../messages/:messageId PATCH] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string; messageId: string }> }) => {
  const { id, messageId } = await ctx.params;
  const principal = await studentPrincipalFromRequest(req, caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  const scope = req.nextUrl.searchParams.get("scope") === "everyone" ? "everyone" : "me";

  try {
    if (scope === "everyone") {
      const deleted = await deleteMessageForEveryone(principal, id, messageId, connectDeps);
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
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[student/connect/.../messages/:messageId DELETE] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
