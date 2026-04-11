/**
 * POST /api/upload
 *
 * Genel amaçlı Drive yükleme endpoint'i.
 * Firestore submission kaydı oluşturmaz — saf Drive upload.
 * Ödev teslimi için /api/submit kullan (o Firestore'a da yazar).
 *
 * FormData alanları:
 *   file        File     (zorunlu)  — yüklenecek dosya
 *   fileName    string   (opsiyonel) — Drive'daki dosya adını override et
 *
 * Başarılı yanıt:
 *   { fileId, webViewLink, downloadUrl, fileName, fileSize, mimeType }
 *
 * Hata yanıtları:
 *   400  — eksik/hatalı alan
 *   413  — dosya boyutu aşıldı (50 MB)
 *   422  — izin verilmeyen dosya türü
 *   500  — Drive auth veya upload hatası
 */

import { NextRequest, NextResponse } from "next/server";
import { uploadToDrive, validateDriveFile, isDriveError } from "@/app/lib/googledrive";

export async function POST(req: NextRequest) {
  // ── 1. FormData parse ──────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "multipart/form-data bekleniyor." },
      { status: 400 }
    );
  }

  // ── 2. Alan doğrulama ──────────────────────────────────────────────────────
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "file alanı zorunludur." },
      { status: 400 }
    );
  }

  // Opsiyonel özel dosya adı; yoksa orijinal adı kullan
  const fileNameOverride = formData.get("fileName");
  const fileName =
    typeof fileNameOverride === "string" && fileNameOverride.trim()
      ? fileNameOverride.trim()
      : file.name;

  const mimeType = file.type || "application/octet-stream";

  // ── 3. Dosya kısıtı kontrolü ───────────────────────────────────────────────
  const valErr = validateDriveFile(mimeType, file.size);
  if (valErr) {
    const status = valErr.code === "FILE_TOO_LARGE" ? 413 : 422;
    return NextResponse.json({ error: valErr.message }, { status });
  }

  // ── 4. Google Drive'a yükle ────────────────────────────────────────────────
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadToDrive(buffer, fileName, mimeType);

    return NextResponse.json({
      fileId:      result.fileId,
      webViewLink: result.webViewLink,
      downloadUrl: result.downloadUrl,
      fileName:    result.fileName,
      fileSize:    result.fileSize,
      mimeType:    result.mimeType,
    });
  } catch (err: unknown) {
    if (isDriveError(err)) {
      const status =
        err.code === "FILE_TOO_LARGE" ? 413 :
        err.code === "INVALID_TYPE"   ? 422 :
        err.code === "AUTH_FAILED"    ? 500 :
                                        500;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("[upload] Beklenmeyen hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
