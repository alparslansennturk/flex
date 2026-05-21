/**
 * POST /api/admin/drive-cleanup
 *
 * Drive klasör yapısındaki yanlış/gereksiz klasörleri temizler:
 *   - Root'ta "gruplar" (küçük harf) — yanlış path, silinmeli
 *   - Root'ta "odevler"              — eski AssignActivateModal hatası
 *   - Root'ta "Ödev Şablonları"      — (yeni yer, tutulsun)
 *
 * Body: { dryRun?: boolean }  — true ise sil değil sadece listele
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/app/lib/googledrive";

interface DriveFile {
  id:       string;
  name:     string;
  mimeType: string;
  size?:    string;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

function getRootId(): string {
  return (process.env.GOOGLE_DRIVE_FOLDER_ID ?? "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

async function listChildren(parentId: string, token: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and trashed = false`,
  );
  const res  = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size)&pageSize=100`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json() as { files?: DriveFile[] };
  return data.files ?? [];
}

async function trashFolder(fileId: string, token: string): Promise<void> {
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export async function POST(req: NextRequest) {
  // Basit secret koruması
  const secret = req.headers.get("x-admin-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { dryRun?: boolean };
  const dryRun = body.dryRun !== false; // default: dryRun=true (güvenli)

  try {
    const token  = await getAccessToken();
    const rootId = getRootId();

    // Root altındaki tüm klasörleri listele
    const rootChildren = await listChildren(rootId, token);

    // Silinmesi gereken klasör isimleri (case-sensitive)
    const TARGET_NAMES = new Set(["gruplar", "odevler"]);

    const toDelete: DriveFile[] = [];
    const toKeep:   DriveFile[] = [];

    for (const item of rootChildren) {
      if (TARGET_NAMES.has(item.name)) {
        toDelete.push(item);
      } else {
        toKeep.push(item);
      }
    }

    // Her silinecek klasörün içini say
    const deleteDetails: { name: string; id: string; childCount: number }[] = [];
    for (const folder of toDelete) {
      if (folder.mimeType === FOLDER_MIME) {
        const children = await listChildren(folder.id, token);
        deleteDetails.push({ name: folder.name, id: folder.id, childCount: children.length });
      } else {
        deleteDetails.push({ name: folder.name, id: folder.id, childCount: 0 });
      }
    }

    if (!dryRun) {
      for (const folder of toDelete) {
        await trashFolder(folder.id, token);
      }
    }

    return NextResponse.json({
      dryRun,
      deleted:   dryRun ? [] : deleteDetails.map(d => d.name),
      wouldDelete: deleteDetails,
      kept:      toKeep.map(f => f.name),
    });

  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[drive-cleanup]", detail);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
