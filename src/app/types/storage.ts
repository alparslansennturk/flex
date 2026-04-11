// ─── Upload Sonucu ───────────────────────────────────────────────────────────

export interface UploadResult {
  url: string;       // Google Drive public view link (webViewLink)
  fileId: string;    // Google Drive dosya ID'si
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

/** Maksimum dosya boyutu: 50 MB */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** İnsan okunabilir boyut etiketi */
export const MAX_FILE_SIZE_LABEL = '50 MB';

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