/**
 * GET /api/admin/drive-list?path=Gruplar/598
 * Drive klasör içeriğini listeler (admin debug için)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/app/lib/googledrive";

const FOLDER_MIME = "application/vnd.google-apps.folder";

function getRootId(): string {
  return (process.env.GOOGLE_DRIVE_FOLDER_ID ?? "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

async function findFolder(name: string, parentId: string, token: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
  );
  const res  = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json() as { files?: { id: string; name: string }[] };
  return data.files?.[0]?.id ?? null;
}

async function listChildren(parentId: string, token: string) {
  const q = encodeURIComponent(`'${parentId}' in parents and trashed = false`);
  const res  = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size)&pageSize=200`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json() as { files?: { id: string; name: string; mimeType: string; size?: string }[] };
  return (data.files ?? []).map(f => ({
    name: f.name,
    type: f.mimeType === FOLDER_MIME ? "folder" : "file",
    id:   f.id,
    size: f.size ? `${(parseInt(f.size) / 1024).toFixed(0)} KB` : undefined,
  }));
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const pathParam = req.nextUrl.searchParams.get("path") ?? "";
  const segments  = pathParam.split("/").filter(Boolean);

  try {
    const token = await getAccessToken();
    let currentId = getRootId();
    const traversed: string[] = ["(root)"];

    for (const seg of segments) {
      const found = await findFolder(seg, currentId, token);
      if (!found) {
        return NextResponse.json({ error: `Klasör bulunamadı: "${seg}"`, traversed });
      }
      currentId = found;
      traversed.push(seg);
    }

    const children = await listChildren(currentId, token);
    return NextResponse.json({ path: traversed.join(" / "), folderId: currentId, children });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
