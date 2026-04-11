/**
 * Firebase Storage — Server-side utility (Admin SDK)
 *
 * Tüm işlemler Next.js API route'larından çağrılır.
 * Client-side import YAPMA — admin SDK sadece sunucuda çalışır.
 */

import { adminStorage } from "./firebase-admin";
import {
  UploadResult,
  UploadError,
  UploadErrorCode,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_LABEL,
  mimeToExtension,
} from "@/app/types/storage";

// ─── Yardımcı ────────────────────────────────────────────────────────────────

function uploadError(code: UploadErrorCode, message: string): UploadError {
  return { code, message };
}

function getBucket() {
  return adminStorage.bucket();
}

/**
 * Güvenli, tekil dosya adı üretir.
 * Orijinal adı korur ama çakışmayı önlemek için timestamp prefix ekler.
 */
function buildStoragePath(studentId: string, taskId: string, originalName: string): string {
  const timestamp = Date.now();
  // Dosya adındaki boşluk ve özel karakterleri temizle
  const safeName = originalName
    .replace(/[^a-zA-Z0-9._\-öçşğüıÖÇŞĞÜİ]/g, "_")
    .replace(/_{2,}/g, "_");
  return `submissions/${studentId}/${taskId}/${timestamp}_${safeName}`;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function validateFile(
  mimeType: string,
  fileSize: number
): UploadError | null {
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return uploadError(
      "FILE_TOO_LARGE",
      `Dosya boyutu ${MAX_FILE_SIZE_LABEL} sınırını aşıyor. Yüklenen: ${(fileSize / 1024 / 1024).toFixed(1)} MB`
    );
  }

  const allowed = ALLOWED_MIME_TYPES as readonly string[];
  if (!allowed.includes(mimeType)) {
    return uploadError(
      "INVALID_TYPE",
      `İzin verilmeyen dosya türü: ${mimeType}. İzin verilenler: PDF, görsel (JPG/PNG/GIF/WEBP), Office belgesi (DOCX/PPTX/XLSX), ZIP`
    );
  }

  return null;
}

// ─── Upload ──────────────────────────────────────────────────────────────────

/**
 * Öğrenci ödev dosyasını Firebase Storage'a yükler.
 *
 * @param buffer   - Dosya içeriği (Buffer)
 * @param mimeType - Dosyanın MIME türü (örn: "application/pdf")
 * @param fileName - Orijinal dosya adı (örn: "kolaj-odev.pdf")
 * @param studentId - Öğrenci ID (Storage path için)
 * @param taskId   - Ödev ID (Storage path için)
 * @returns UploadResult veya UploadError fırlatır
 */
export async function uploadSubmission(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  studentId: string,
  taskId: string
): Promise<UploadResult> {
  // 1. Validation
  const validationError = validateFile(mimeType, buffer.length);
  if (validationError) {
    throw validationError;
  }

  // 2. Storage path
  const filePath = buildStoragePath(studentId, taskId, fileName);
  const bucket = getBucket();
  const fileRef = bucket.file(filePath);

  // 3. Upload
  try {
    await fileRef.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          studentId,
          taskId,
          originalName: fileName,
          uploadedAt: new Date().toISOString(),
        },
      },
    });
  } catch (err) {
    console.error("[storage] Upload hatası:", err);
    throw uploadError("UPLOAD_FAILED", "Dosya yükleme başarısız oldu. Lütfen tekrar deneyin.");
  }

  // 4. Public download URL al
  let url: string;
  try {
    const [signedUrl] = await fileRef.getSignedUrl({
      action: "read",
      expires: "01-01-2100", // Uzun vadeli URL (pratik olarak kalıcı)
    });
    url = signedUrl;
  } catch (err) {
    // URL alınamazsa dosyayı sil (tutarsız durum bırakma)
    console.error("[storage] URL alma hatası:", err);
    await fileRef.delete().catch(() => {});
    throw uploadError("URL_FAILED", "Dosya yüklendi ancak URL alınamadı.");
  }

  return {
    url,
    filePath,
    fileName,
    fileSize: buffer.length,
    mimeType,
  };
}

// ─── Download URL ─────────────────────────────────────────────────────────────

/**
 * Mevcut bir dosya için yeni download URL üretir.
 * URL süresi dolmuşsa veya yenilenmesi gerekiyorsa kullanılır.
 */
export async function getDownloadUrl(filePath: string): Promise<string> {
  const bucket = getBucket();
  const fileRef = bucket.file(filePath);

  const [exists] = await fileRef.exists();
  if (!exists) {
    throw uploadError("UPLOAD_FAILED", `Dosya bulunamadı: ${filePath}`);
  }

  const [signedUrl] = await fileRef.getSignedUrl({
    action: "read",
    expires: "01-01-2100",
  });

  return signedUrl;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Submission dosyasını Storage'dan siler.
 * Firestore doc'unu SİLMEZ — submissions.ts'teki deleteSubmission() bunu yapar.
 *
 * @param filePath - Storage'daki tam yol (Submission.filePath)
 */
export async function deleteStorageFile(filePath: string): Promise<void> {
  const bucket = getBucket();
  const fileRef = bucket.file(filePath);

  const [exists] = await fileRef.exists();
  if (!exists) {
    // Zaten yok — idempotent davran, hata fırlatma
    console.warn("[storage] Silinecek dosya bulunamadı:", filePath);
    return;
  }

  try {
    await fileRef.delete();
  } catch (err) {
    console.error("[storage] Silme hatası:", err);
    throw uploadError("UPLOAD_FAILED", `Dosya silinemedi: ${filePath}`);
  }
}

// ─── Re-export ────────────────────────────────────────────────────────────────

export { mimeToExtension, validateFile as isValidFile };
export type { UploadResult, UploadError };
