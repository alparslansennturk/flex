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
async function getAccessToken(): Promise<string> {
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
