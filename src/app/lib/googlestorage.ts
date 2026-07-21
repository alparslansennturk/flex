/**
 * Google Cloud Storage — server-side upload utility (2026-07-21).
 *
 * `googledrive.ts`'in GCS karşılığı — AYNI dış arayüz şekli (çağıran kodun
 * zihinsel modeli değişmesin diye), ama artık kişisel bir Drive hesabına değil,
 * projenin KENDİ Firebase Storage bucket'ına yazıyor (`adminStorage`, zaten
 * `firebase-admin.ts`'de bağlı — AYRI bir `@google-cloud/storage` paketi/kimlik
 * bilgisi kurmaya gerek yok).
 *
 * Güvenlik modeli Drive'daki "anyone with link" ile PARİTE: `predefinedAcl:
 * "publicRead"` — daha kısıtlı erişim istenirse ileride signed URL'e
 * geçilebilir (bkz. `StorageUploadResult` yorum notu), şimdilik davranış
 * değişmesin diye public tutuluyor.
 *
 * Eski Drive dosyalarına DOKUNULMAZ — bu dosya SADECE yeni yüklemeler için.
 */

import { adminStorage } from "./firebase-admin";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from "@/app/types/storage";
import type { StorageUploadResult, UploadError } from "@/app/types/storage";

function storageError(code: UploadError["code"], message: string): UploadError {
  return { code, message };
}

export function isStorageError(err: unknown): err is UploadError {
  return typeof err === "object" && err !== null && "code" in err && "message" in err && typeof (err as UploadError).code === "string";
}

export function validateStorageFile(mimeType: string, size: number): UploadError | null {
  if (size > MAX_FILE_SIZE_BYTES) {
    return storageError("FILE_TOO_LARGE", `Dosya boyutu ${MAX_FILE_SIZE_LABEL} sınırını aşıyor. Yüklenen: ${(size / 1024 / 1024).toFixed(1)} MB`);
  }
  const allowed = ALLOWED_MIME_TYPES as readonly string[];
  if (!allowed.includes(mimeType)) {
    return storageError("INVALID_TYPE", `İzin verilmeyen dosya türü: ${mimeType}. İzin verilenler: PDF, görsel, Office belgesi, ZIP`);
  }
  return null;
}

/**
 * Drive'ın `ensureFolderPath` string-segment API'siyle AYNI çağrı şekli, ama
 * GCS'te gerçek "klasör arama/oluşturma" yok — segment'ler `/` ile birleşip
 * tek bir object path olur ("klasör" GCS'te sadece isimdeki bir `/`'dir).
 * İsim uyumluluğu için korunuyor, çağıran kod aynı kalabiliyor.
 */
export function buildObjectPath(pathSegments: string[], fileName: string): string {
  const clean = (raw: string) => raw.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "Genel";
  return [...pathSegments.map(clean), fileName].join("/");
}

export function publicUrl(objectPath: string): string {
  return `https://storage.googleapis.com/${adminStorage.bucket().name}/${objectPath}`;
}

/** Buffer'ı doğrudan yükler (küçük/tek istekli dosyalar — Connect ekleri gibi). */
export async function uploadBufferToPath(
  buffer: Buffer,
  objectPath: string,
  mimeType: string,
): Promise<StorageUploadResult> {
  const valErr = validateStorageFile(mimeType, buffer.length);
  if (valErr) throw valErr;

  try {
    const file = adminStorage.bucket().file(objectPath);
    await file.save(buffer, { contentType: mimeType, predefinedAcl: "publicRead" });
    return {
      url: publicUrl(objectPath),
      filePath: objectPath,
      fileName: objectPath.split("/").pop() ?? objectPath,
      fileSize: buffer.length,
      mimeType,
    };
  } catch (e) {
    console.error("[gcs] uploadBufferToPath hatası:", e);
    throw storageError("UPLOAD_FAILED", `GCS upload başarısız: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Resumable upload oturumu başlatır — Drive'daki `initResumableSession` ile
 * AYNI amaç: büyük dosyalarda client'ın (mevcut proxy route üzerinden) chunk
 * chunk yükleyebileceği bir `sessionUri` döner. GCS'in resumable protokolü
 * Drive'ınkiyle BİREBİR aynı HTTP akışını (Content-Range, 308/200) kullanıyor
 * — çağıran proxy route'ta sadece tamamlanma yanıtının alan adı değişir
 * (Drive `{id}`, GCS `{name}`).
 */
export async function initResumableUploadSession(
  objectPath: string,
  mimeType: string,
): Promise<string> {
  const file = adminStorage.bucket().file(objectPath);
  const [uri] = await file.createResumableUpload({
    metadata: { contentType: mimeType },
    predefinedAcl: "publicRead",
  });
  return uri;
}

/** 404 → zaten yok, sessizce geç (Drive'daki AYNI tolerans). */
export async function deleteObject(objectPath: string): Promise<void> {
  try {
    await adminStorage.bucket().file(objectPath).delete({ ignoreNotFound: true });
  } catch (e) {
    console.error(`[gcs] deleteObject hatası (${objectPath}):`, e);
  }
}
