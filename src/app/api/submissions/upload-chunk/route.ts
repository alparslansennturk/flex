import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { verifyRequestToken } from "@/app/lib/submission-validation";

// 256KB chunk << Vercel 4.5MB limit — SAFE
// sessionUri browser'a gönderilmez: güvenlik + CORS sorunu yok

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const caller = await verifyRequestToken(req);
    if (!caller) {
      return NextResponse.json({ error: "Kimlik doğrulaması gerekli." }, { status: 401 });
    }

    // 2. Header'lar
    const uploadId     = req.headers.get("x-upload-id");
    const contentRange = req.headers.get("content-range"); // "bytes 0-262143/10485760"
    const contentType  = req.headers.get("x-file-type") ?? "application/octet-stream";

    if (!uploadId) {
      return NextResponse.json({ error: "x-upload-id header zorunludur." }, { status: 400 });
    }
    if (!contentRange) {
      return NextResponse.json({ error: "content-range header zorunludur." }, { status: 400 });
    }

    // 3. Upload session al
    const sessionDoc = await adminDb.collection("upload_sessions").doc(uploadId).get();
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Upload session bulunamadı." }, { status: 404 });
    }

    const session = sessionDoc.data()!;

    // 4. Session doğrulama
    if (session.status === "completed") {
      return NextResponse.json({ error: "Bu upload zaten tamamlandı." }, { status: 409 });
    }
    if (session.userId !== caller.uid) {
      return NextResponse.json({ error: "Bu session'a erişim yetkiniz yok." }, { status: 403 });
    }

    const expiresAt = session.expiresAt instanceof Timestamp
      ? session.expiresAt.toDate()
      : new Date(session.expiresAt as string);
    if (new Date() > expiresAt) {
      return NextResponse.json({ error: "Upload session süresi dolmuş." }, { status: 410 });
    }

    // 5. Raw chunk body'yi al
    const chunkBuffer = await req.arrayBuffer();
    if (chunkBuffer.byteLength === 0) {
      return NextResponse.json({ error: "Boş chunk gönderilemez." }, { status: 400 });
    }

    // 6. Chunk'ı Google Drive sessionUri'ye ilet (server-side — CORS yok)
    // Content-Length: undici body'den otomatik hesaplar, manuel set edilmez
    const driveRes = await fetch(session.sessionUri as string, {
      method:  "PUT",
      headers: {
        "Content-Range": contentRange,
        "Content-Type":  contentType,
      },
      body: new Uint8Array(chunkBuffer), // ArrayBuffer → Uint8Array (undici uyumluluğu)
    });

    // 7. Drive response'unu işle
    if (driveRes.status === 308) {
      // Resume Incomplete — sonraki chunk bekliyor
      const range = driveRes.headers.get("Range");
      let uploadedBytes = 0;
      if (range) {
        const m = range.match(/bytes=0-(\d+)/);
        if (m) uploadedBytes = parseInt(m[1]) + 1;
      }
      return NextResponse.json({ status: "incomplete", uploadedBytes });
    }

    if (driveRes.status === 200 || driveRes.status === 201) {
      // Son chunk — upload tamamlandı
      const data = await driveRes.json().catch(() => ({})) as { id?: string };
      return NextResponse.json({ status: "complete", driveFileId: data.id ?? null });
    }

    // Drive hatası
    const errText = await driveRes.text().catch(() => "");
    console.error("[upload-chunk] Drive hata:", driveRes.status, errText.slice(0, 300));
    return NextResponse.json(
      { error: `Drive chunk hatası (${driveRes.status}): ${errText.slice(0, 150)}` },
      { status: 502 },
    );

  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[upload-chunk] Beklenmeyen hata:", err);
    return NextResponse.json({ error: "Sunucu hatası.", detail }, { status: 500 });
  }
}
