/**
 * Google Drive — Server-side upload utility
 *
 * OAuth2 Refresh Token kullanır (senin kişisel Drive'ına yükler).
 * Service account değil — kota senin 200GB hesabından düşer.
 *
 * Env vars:
 *   GOOGLE_CLIENT_ID       — OAuth2 Client ID
 *   GOOGLE_CLIENT_SECRET   — OAuth2 Client Secret
 *   GOOGLE_REFRESH_TOKEN   — Bir kere alınan refresh token (süresi dolmaz)
 *   GOOGLE_DRIVE_FOLDER_ID — Hedef klasör ID
 */

import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from "@/app/types/storage";

// ─── Yardımcı ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function getFolderId(): string {
  const raw = process.env.GOOGLE_DRIVE_FOLDER_ID ?? "";
  const id  = raw.replace(/^["']|["']$/g, "").trim();
  if (!id) throw driveError("UPLOAD_FAILED", "GOOGLE_DRIVE_FOLDER_ID env var eksik.");
  return id;
}

// ─── Tipler ──────────────────────────────────────────────────────────────────

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface DriveError {
  code: "FILE_TOO_LARGE" | "INVALID_TYPE" | "AUTH_FAILED" | "UPLOAD_FAILED" | "PERMISSION_FAILED";
  message: string;
}

function driveError(code: DriveError["code"], message: string): DriveError {
  return { code, message };
}

export function isDriveError(err: unknown): err is DriveError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    "message" in err &&
    typeof (err as DriveError).code === "string"
  );
}

// ─── OAuth2 Access Token ──────────────────────────────────────────────────────

/**
 * Refresh token kullanarak kısa ömürlü access token alır.
 * Her upload isteğinde çağrılır (token 1 saat geçerli).
 */
export async function getAccessToken(): Promise<string> {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw driveError(
      "AUTH_FAILED",
      "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET veya GOOGLE_REFRESH_TOKEN eksik."
    );
  }



  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw driveError("AUTH_FAILED", `Google token alınamadı: ${err}`);
  }

  const data = await res.json() as { access_token?: string; error?: string };

  if (!data.access_token) {
    throw driveError("AUTH_FAILED", `Token yanıtı geçersiz: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

// ─── Unique Filename ─────────────────────────────────────────────────────────

/** Sıra numaralı dosya adı üretir: 01-dosya.pdf, 02-dosya.jpg */
export function generateActualFileName(sequence: number, originalFileName: string): string {
  return `${String(sequence).padStart(2, "0")}-${originalFileName}`;
}

/** actualFileName'den orijinal dosya adını çıkarır: "01-dosya.pdf" → "dosya.pdf" */
export function extractOriginalFileName(actualFileName: string): string {
  const idx = actualFileName.indexOf("-");
  return idx >= 0 ? actualFileName.slice(idx + 1) : actualFileName;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function validateDriveFile(mimeType: string, size: number): DriveError | null {
  if (size > MAX_FILE_SIZE_BYTES) {
    return driveError(
      "FILE_TOO_LARGE",
      `Dosya boyutu ${MAX_FILE_SIZE_LABEL} sınırını aşıyor. Yüklenen: ${(size / 1024 / 1024).toFixed(1)} MB`
    );
  }

  const allowed = ALLOWED_MIME_TYPES as readonly string[];
  if (!allowed.includes(mimeType)) {
    return driveError(
      "INVALID_TYPE",
      `İzin verilmeyen dosya türü: ${mimeType}. İzin verilenler: PDF, görsel, Office belgesi, ZIP`
    );
  }

  return null;
}

// ─── Upload ──────────────────────────────────────────────────────────────────

/**
 * Dosyayı senin Google Drive klasörüne yükler.
 * Kota senin hesabından (200GB) düşer.
 */
export async function uploadToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<DriveUploadResult> {
  // 1. Validation
  const valErr = validateDriveFile(mimeType, buffer.length);
  if (valErr) throw valErr;

  // 2. Token + klasör
  const token = await getAccessToken();

  const rawFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? "";
  const folderId = rawFolderId.replace(/^["']|["']$/g, "").trim();

  if (!folderId) {
    throw driveError("UPLOAD_FAILED", "GOOGLE_DRIVE_FOLDER_ID env var eksik.");
  }

  // 3. Multipart body
  const boundary = "flex_drive_boundary_9xKp";

  const fileMetadata = { name: fileName, parents: [folderId] };
  const metaJson = JSON.stringify(fileMetadata);

  const metaPart = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n`,
    "utf-8"
  );
  const filePart = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`, "utf-8"),
    buffer,
    Buffer.from(`\r\n--${boundary}--`, "utf-8"),
  ]);
  const body = Buffer.concat([metaPart, filePart]);

  // 4. Upload
  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files" +
    "?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    console.error("[gdrive] Upload hatası:", errText);
    throw driveError("UPLOAD_FAILED", `Drive upload başarısız (${uploadRes.status}): ${errText}`);
  }

  const uploaded = await uploadRes.json() as { id: string; webViewLink: string };
  const fileId = uploaded.id;
  const webViewLink = uploaded.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;

  // 5. "Link ile görüntüle" iznini aç
  const permRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }
  );

  if (!permRes.ok) {
    console.warn("[gdrive] İzin ayarlanamadı:", await permRes.text());
  }

  return {
    fileId,
    webViewLink,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
    fileName,
    fileSize: buffer.length,
    mimeType,
  };
}

// ─── Resumable Upload ─────────────────────────────────────────────────────────

/**
 * Google Drive'da resumable upload oturumu başlatır.
 * Dönen sessionUri'yi browser direkt chunk upload için kullanır.
 * Vercel'in 4.5 MB sınırını atlatır — dosya Vercel'den geçmez.
 */
export async function initResumableSession(
  actualFileName:  string,
  fileSize:        number,
  mimeType:        string,
  targetFolderId?: string,
): Promise<string> {
  const token    = await getAccessToken();
  const folderId = targetFolderId ?? getFolderId();

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers: {
        Authorization:             `Bearer ${token}`,
        "Content-Type":            "application/json; charset=UTF-8",
        "X-Upload-Content-Type":   mimeType,
        "X-Upload-Content-Length": String(fileSize),
      },
      body: JSON.stringify({ name: actualFileName, parents: [folderId] }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw driveError("UPLOAD_FAILED", `Resumable session başlatılamadı (${res.status}): ${errText}`);
  }

  const sessionUri = res.headers.get("Location");
  if (!sessionUri) throw driveError("UPLOAD_FAILED", "Google Drive'dan sessionUri alınamadı.");

  return sessionUri;
}

// ─── Public Permission ────────────────────────────────────────────────────────

/**
 * Drive dosyasını herkese açık (link ile görüntüle) yapar.
 * complete-upload sonrası çağrılır.
 */
export async function setPublicReadPermission(fileId: string): Promise<void> {
  const token = await getAccessToken();

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    },
  );

  if (!res.ok) {
    console.warn(`[gdrive] setPublicReadPermission başarısız (${res.status}):`, await res.text());
  }
}

// ─── Fallback: Find File By Name ──────────────────────────────────────────────

const FALLBACK_DELAYS = [0, 100, 300];

async function searchByName(
  actualFileName:  string,
  token:           string,
  parentFolderId?: string,
): Promise<{ id: string; createdTime: string }[]> {
  const parts = [
    `name = '${actualFileName.replace(/'/g, "\\'")}'`,
    ...(parentFolderId ? [`'${parentFolderId}' in parents`] : []),
    `trashed = false`,
  ];
  const q   = encodeURIComponent(parts.join(" and "));
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,createdTime)&orderBy=createdTime%20desc`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];

  const data = await res.json() as { files?: { id: string; createdTime: string }[] };
  return data.files ?? [];
}

/**
 * actualFileName'e göre Drive'da dosya arar (retry: 0ms, 100ms, 300ms).
 * driveFileId browser'dan alınamadığında kullanılır.
 * Unique filename (UUID prefix) garantisi nedeniyle collision imkânsız.
 */
export async function findFileByActualName(
  actualFileName:  string,
  parentFolderId?: string,
): Promise<{
  id:      string;
  source:  "fallback_single" | "fallback_latest";
  retries: number;
}> {
  const token = await getAccessToken();

  let files: { id: string; createdTime: string }[] = [];
  let attempts = 0;

  for (const delay of FALLBACK_DELAYS) {
    if (delay > 0) await sleep(delay);
    files = await searchByName(actualFileName, token, parentFolderId);
    attempts++;
    if (files.length > 0) break;
  }

  if (files.length === 0) {
    throw driveError(
      "UPLOAD_FAILED",
      `Dosya ${attempts} denemede bulunamadı: ${actualFileName}`,
    );
  }

  // Unique filename'e rağmen birden fazla sonuç (edge case)
  if (files.length > 1) {
    const times = files.map(f => new Date(f.createdTime).getTime());
    const diff  = Math.max(...times) - Math.min(...times);
    if (diff < 2000) {
      throw driveError(
        "UPLOAD_FAILED",
        `Belirsiz dosya: ${files.length} kayıt <2s farkla bulundu — ${actualFileName}`,
      );
    }
    files.sort((a, b) =>
      new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime(),
    );
    return { id: files[0].id, source: "fallback_latest", retries: attempts };
  }

  return { id: files[0].id, source: "fallback_single", retries: attempts };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Drive'dan dosyayı kalıcı olarak siler.
 * 404 → zaten silinmiş, hata fırlatma.
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  const token = await getAccessToken();

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    throw driveError("UPLOAD_FAILED", `Drive dosyası silinemedi (${res.status}): ${errText}`);
  }
}
