// ─── Upload Sonucu ───────────────────────────────────────────────────────────

/** Google Drive upload sonucu */
export interface UploadResult {
  url: string;       // Google Drive public view link (webViewLink)
  fileId: string;    // Google Drive dosya ID'si
  fileName: string;  // Orijinal dosya adı
  fileSize: number;  // Byte cinsinden
  mimeType: string;
}

/** Firebase Storage upload sonucu (storage.ts) */
export interface StorageUploadResult {
  url: string;       // Signed URL
  filePath: string;  // Storage'daki tam yol
  fileName: string;  // Orijinal dosya adı
  fileSize: number;  // Byte cinsinden
  mimeType: string;
}

// ─── Hata Kodları ────────────────────────────────────────────────────────────

export type UploadErrorCode =
  | 'FILE_TOO_LARGE'    // 50MB sınırı aşıldı
  | 'INVALID_TYPE'      // İzin verilmeyen MIME türü
  | 'AUTH_FAILED'       // Google OAuth/Token hatası
  | 'UPLOAD_FAILED'     // Google Drive yazma hatası
  | 'URL_FAILED'        // Dosya yüklendi ancak URL alınamadı
  | 'UNKNOWN';          // Beklenmeyen hata

export interface UploadError {
  code: UploadErrorCode;
  message: string;
}

// ─── Dosya Kısıtlamaları ─────────────────────────────────────────────────────

/** İzin verilen MIME türleri */
export const ALLOWED_MIME_TYPES = [
  // Belgeler
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  // .docx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',         // .xlsx
  // Görseller
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Arşiv
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream', // Bazı özel tasarım dosyaları için gerekebilir
] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

/** Maksimum dosya boyutu: 50 MB (eski /api/submit endpoint'i) */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = '50 MB';

/** Maksimum dosya boyutu: 100 MB (resumable upload endpoint'i) */
export const MAX_RESUMABLE_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const MAX_RESUMABLE_FILE_SIZE_LABEL = '100 MB';

/** MIME türünden uzantı tahmin et */
export function mimeToExtension(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
  };
  return map[mime] ?? 'bin';
}