import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { staffPrincipalFromCaller } from "@/app/lib/server/connect-principal";
import { connectDeps } from "@/app/lib/server/connect-deps";
import { sendMessage } from "@/app/lib/domain/services/connect-service";
import { notifyNewMessage } from "@/app/lib/domain/services/connect-push-service";
import { firestoreConnectPushRepo } from "@/app/lib/server/connect-push-repo.firestore";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";
import { ensureFolderPath, uploadBufferToFolder, setPublicReadPermission } from "@/app/lib/googledrive";
import { ALLOWED_MIME_TYPES } from "@/app/types/storage";

/** Tek seferlik (resumable/chunk YOK) — Vercel'in 4.5MB istek gövdesi sınırının
 * altında kalınır, ödev eklerindeki gibi karmaşık bir chunk-proxy'ye gerek yok
 * (Faz 2 madde 5, 2026-07-18). */
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

/** POST — dosya eki + opsiyonel metin (WhatsApp gibi metin BOŞ olabilir). Drive'a
 * yüklenir (`Flex Connect/{conversationId}` klasörü), herkese link ile görünür yapılır. */
export const POST = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await staffPrincipalFromCaller(caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  const file = form.get("file");
  const text = (form.get("text") as string) ?? "";
  if (!(file instanceof File)) return NextResponse.json({ error: "Dosya gerekli." }, { status: 400 });
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: `Dosya çok büyük (maks ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB).` }, { status: 400 });
  }
  const mimeType = file.type || "application/octet-stream";
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return NextResponse.json({ error: `İzin verilmeyen dosya türü: ${mimeType}` }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const folderId = await ensureFolderPath(["Flex Connect", id]);
    const { fileId, webViewLink } = await uploadBufferToFolder(buffer, file.name, mimeType, folderId);
    await setPublicReadPermission(fileId);

    const message = await sendMessage(principal, id, text, connectDeps, [
      { driveFileId: fileId, webViewLink, fileName: file.name, fileSize: file.size, mimeType },
    ]);
    await notifyNewMessage(id, message, principal.uid, principal.tenantId, connectDeps, firestoreConnectPushRepo);
    return NextResponse.json({ id: message.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/connect/.../messages/attachment POST] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
