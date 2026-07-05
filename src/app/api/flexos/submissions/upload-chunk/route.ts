import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { DEFAULT_TENANT } from "@/app/lib/server/auth-actor";
import { firestoreUploadSessionRepo } from "@/app/lib/server/upload-session-repo.firestore";
import { getSessionForChunk } from "@/app/lib/domain/services/submission-service";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * POST /api/flexos/submissions/upload-chunk — sadece proxy: doğrulanan `sessionUri`'ye
 * chunk'ı Drive'a iletir, Firestore'a bu adımda YAZMAZ (canlıdaki desenle aynı).
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
    const driveRes = await fetch(session.sessionUri, {
      method: "PUT",
      headers: {
        "Content-Range": contentRange,
        "Content-Length": String(chunk.byteLength),
      },
      body: chunk,
    });

    if (driveRes.status === 308) {
      const range = driveRes.headers.get("range"); // "bytes=0-262143"
      const uploadedBytes = range ? Number(range.split("-")[1]) + 1 : 0;
      return NextResponse.json({ status: "incomplete", uploadedBytes });
    }

    if (driveRes.status === 200 || driveRes.status === 201) {
      const data = (await driveRes.json()) as { id: string };
      return NextResponse.json({ status: "complete", driveFileId: data.id });
    }

    return NextResponse.json({ error: "Drive chunk yükleme hatası." }, { status: 502 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[flexos/submissions/upload-chunk] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
