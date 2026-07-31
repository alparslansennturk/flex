import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { studentPrincipalFromRequest } from "@/app/lib/server/connect-principal";
import { buildObjectPath, createSignedUploadUrl } from "@/app/lib/googlestorage";
import { ALLOWED_MIME_TYPES, MAX_RESUMABLE_FILE_SIZE_BYTES, MAX_RESUMABLE_FILE_SIZE_LABEL } from "@/app/types/storage";
import { apiError } from "@/app/lib/server/api-error";

/** bkz. mobildeki AYNI (personel) route'un gerekçesi — 2026-07-29. */
export const POST = withAuth(async (req: NextRequest, caller, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const principal = await studentPrincipalFromRequest(req, caller);
  if (!principal) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });

  let body: { fileName?: string; fileSize?: number; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  const { fileName, fileSize, mimeType } = body;
  if (!fileName || !fileSize || !mimeType) {
    return NextResponse.json({ error: "fileName/fileSize/mimeType zorunlu." }, { status: 400 });
  }
  if (fileSize > MAX_RESUMABLE_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: `Dosya çok büyük (maks ${MAX_RESUMABLE_FILE_SIZE_LABEL}).` }, { status: 400 });
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return NextResponse.json({ error: `İzin verilmeyen dosya türü: ${mimeType}` }, { status: 400 });
  }

  try {
    const objectPath = buildObjectPath(["Flex Connect", id], fileName);
    const uploadUrl = await createSignedUploadUrl(objectPath, mimeType);
    return NextResponse.json({ uploadUrl, objectPath });
  } catch (e) {
    return apiError(e, "flexos/student/connect/conversations/[id]/messages/attachment/sign");
  }
});
