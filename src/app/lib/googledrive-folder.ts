// FILE: lib/googledrive-folder.ts
// PURPOSE: Google Drive klasör hiyerarşisi yönetimi
// STRUCTURE: /Gruplar/{grupAdı}/Öğrenciler|Eğitmen/{adSoyad}/

import { getAccessToken } from "@/app/lib/googledrive";

export interface FolderStructureResult {
  folderId:   string;
  folderPath: string;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function ensureFolderExists(
  folderName:     string,
  parentFolderId: string,
  token:          string,
): Promise<string> {
  const q = encodeURIComponent(
    `name = '${folderName.replace(/'/g, "\\'")}' and ` +
    `'${parentFolderId}' in parents and ` +
    `mimeType = 'application/vnd.google-apps.folder' and ` +
    `trashed = false`,
  );

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (searchRes.ok) {
    const data = await searchRes.json() as { files?: { id: string }[] };
    if (data.files && data.files.length > 0) return data.files[0].id;
  }

  // Bulunamadı — oluştur
  const createRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name:     folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents:  [parentFolderId],
      }),
    },
  );

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Klasör oluşturulamadı "${folderName}": ${errText}`);
  }

  const created = await createRes.json() as { id?: string };
  if (!created.id) throw new Error(`Klasör ID alınamadı: ${folderName}`);
  return created.id;
}

// ─── Public ───────────────────────────────────────────────────────────────────

/**
 * Lazy klasör oluşturma — okunabilir isimler kullanır:
 *   /Gruplar/{groupName}/Öğrenciler/{userName}/
 *   /Gruplar/{groupName}/Eğitmen/{userName}/
 *
 * Her seviye: var mı kontrol → yoksa oluştur.
 */
export async function createFolderStructure(
  groupName: string,              // "Grup Test-01"
  userName:  string,              // "Ahmet Yılmaz"
  userRole:  "student" | "instructor",
  taskName?: string,              // "Kolaj Bahçesi" — opsiyonel 5. seviye
): Promise<FolderStructureResult> {
  const rawRoot = (process.env.GOOGLE_DRIVE_FOLDER_ID ?? "")
    .replace(/^["']|["']$/g, "")
    .trim();

  if (!rawRoot) throw new Error("GOOGLE_DRIVE_FOLDER_ID env var eksik.");

  const token = await getAccessToken();

  // 1. /Gruplar
  const groupsFolderId = await ensureFolderExists("Gruplar", rawRoot, token);

  // 2. /Gruplar/{groupName}
  const groupFolderId = await ensureFolderExists(groupName, groupsFolderId, token);

  // 3. /Gruplar/{groupName}/Öğrenciler|Eğitmen
  const roleFolder   = userRole === "student" ? "Öğrenciler" : "Eğitmen";
  const roleFolderId = await ensureFolderExists(roleFolder, groupFolderId, token);

  // 4. /Gruplar/{groupName}/Öğrenciler/{userName}
  const userFolderId = await ensureFolderExists(userName, roleFolderId, token);

  // 5. (opsiyonel) /Gruplar/{groupName}/Öğrenciler/{userName}/{taskName}
  if (taskName?.trim()) {
    const safeTask     = taskName.trim();
    const taskFolderId = await ensureFolderExists(safeTask, userFolderId, token);
    return {
      folderId:   taskFolderId,
      folderPath: `/Gruplar/${groupName}/${roleFolder}/${userName}/${safeTask}`,
    };
  }

  return {
    folderId:   userFolderId,
    folderPath: `/Gruplar/${groupName}/${roleFolder}/${userName}`,
  };
}

// ─── Archive / Restore ────────────────────────────────────────────────────────

/**
 * Grubun Drive klasörünü arşive taşır veya geri alır.
 *   archive: Gruplar/{groupName}  →  Arşiv/{groupName}
 *   restore: Arşiv/{groupName}    →  Gruplar/{groupName}
 */
export async function moveGroupFolder(
  groupName: string,
  action: "archive" | "restore",
): Promise<void> {
  const rawRoot = (process.env.GOOGLE_DRIVE_FOLDER_ID ?? "")
    .replace(/^["']|["']$/g, "")
    .trim();
  if (!rawRoot) throw new Error("GOOGLE_DRIVE_FOLDER_ID env var eksik.");

  const token = await getAccessToken();

  const srcParentName = action === "archive" ? "Gruplar" : "Arşiv";
  const dstParentName = action === "archive" ? "Arşiv"   : "Gruplar";

  // Kaynak üst klasörü bul
  const srcParentId = await findFolder(srcParentName, rawRoot, token);
  if (!srcParentId) return; // kaynak yoksa işlem yok

  // Grup klasörünü kaynak içinde bul
  const groupFolderId = await findFolder(groupName, srcParentId, token);
  if (!groupFolderId) return; // grup klasörü yoksa işlem yok

  // Hedef üst klasörünü oluştur / bul
  const dstParentId = await ensureFolderExists(dstParentName, rawRoot, token);

  // Taşı: addParents + removeParents
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${groupFolderId}` +
    `?addParents=${dstParentId}&removeParents=${srcParentId}&fields=id`,
    { method: "PATCH", headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Klasör taşınamadı (${res.status}): ${errText}`);
  }
}

async function findFolder(
  folderName:     string,
  parentFolderId: string,
  token:          string,
): Promise<string | null> {
  const q = encodeURIComponent(
    `name = '${folderName.replace(/'/g, "\\'")}' and ` +
    `'${parentFolderId}' in parents and ` +
    `mimeType = 'application/vnd.google-apps.folder' and ` +
    `trashed = false`,
  );
  const res  = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json() as { files?: { id: string }[] };
  return data.files?.[0]?.id ?? null;
}
