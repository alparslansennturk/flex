import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import { firestoreUploadSessionRepo } from "@/app/lib/server/upload-session-repo.firestore";
import { getSessionForChunk } from "@/app/lib/domain/services/submission-service";
import { apiError } from "@/app/lib/server/api-error";

/**
 * POST /api/flexos/submissions/upload-chunk — sadece proxy: doğrulanan `sessionUri`'ye
 * chunk'ı GCS'e iletir, Firestore'a bu adımda YAZMAZ (canlıdaki desenle aynı). GCS'in
 * resumable protokolü (Content-Range, 308/200) Drive'ınkiyle aynı akışı kullanıyor, sadece
 * tamamlanma yanıtının dosya-kimliği alanı farklı: Drive `id`, GCS `name` (object path).
 * Header'lar: `x-upload-id`, `content-range` ("bytes 0-262143/10485760").
 */
export const POST = withAuth(async (req: NextRequest, caller) => {
  const uploadId = req.headers.get("x-upload-id");
  const contentRange = req.headers.get("content-range");
  if (!uploadId || !contentRange) {
    return NextResponse.json({ error: "x-upload-id / content-range header'ları zorunlu." }, { status: 400 });
  }

  try {
    const session = await getSessionForChunk(
      { requesterUid: caller.uid, tenantId: DEFAULT_TENANT, uploadId },
      { uploadSessions: firestoreUploadSessionRepo },
    );

    const chunk = await req.arrayBuffer();
    const uploadRes = await fetch(session.sessionUri, {
      method: "PUT",
      headers: {
        "Content-Range": contentRange,
        "Content-Length": String(chunk.byteLength),
      },
      body: chunk,
    });

    if (uploadRes.status === 308) {
      const range = uploadRes.headers.get("range"); // "bytes=0-262143"
      const uploadedBytes = range ? Number(range.split("-")[1]) + 1 : 0;
      return NextResponse.json({ status: "incomplete", uploadedBytes });
    }

    if (uploadRes.status === 200 || uploadRes.status === 201) {
      const data = (await uploadRes.json()) as { name: string };
      return NextResponse.json({ status: "complete", objectPath: data.name });
    }

    return NextResponse.json({ error: "Depolama chunk yükleme hatası." }, { status: 502 });
  } catch (e) {
    return apiError(e, "flexos/submissions/upload-chunk");
  }
});
