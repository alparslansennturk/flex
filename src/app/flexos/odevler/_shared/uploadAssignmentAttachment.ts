/**
 * Ödev eki yükleme — TEK paylaşımlı fonksiyon (2026-07-08). Hem "Ödevi Düzenle"
 * (`EditAssignmentModal`) hem "Ödev Oluştur" (`OdevOlusturModal`, ödev kaydedildikten
 * HEMEN sonra) buradan çağırır — chunk'lama mantığı iki yerde ayrı ayrı yazılmasın diye
 * tek kaynağa çıkarıldı. Öğrenci teslimiyle AYNI resumable-upload deseni (`upload-chunk`
 * proxy'si reuse edilir), farklı uç noktalar (`init/complete-attachment-upload`).
 */
import { auth } from "@/app/lib/firebase";
import type { EditableAttachment } from "./EditAssignmentModal";

const CHUNK_SIZE = 256 * 1024;
export const ATTACHMENT_MAX_MB = 50;

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

export async function uploadAssignmentAttachment(
  assignmentId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<EditableAttachment> {
  if (file.size > ATTACHMENT_MAX_MB * 1024 * 1024) {
    throw new Error(`Dosya ${ATTACHMENT_MAX_MB}MB sınırını aşıyor.`);
  }
  const headers = await authHeaders();
  const initRes = await fetch(`/api/flexos/assignments/${assignmentId}/init-attachment-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type || "application/octet-stream" }),
  });
  if (!initRes.ok) {
    const json = await initRes.json().catch(() => ({})) as { error?: string };
    throw new Error(json.error ?? "Yükleme başlatılamadı.");
  }
  const { uploadId } = await initRes.json() as { uploadId: string };

  let uploadedBytes = 0;
  const totalBytes = file.size;
  const mimeType = file.type || "application/octet-stream";

  while (uploadedBytes < totalBytes) {
    const start = uploadedBytes;
    const end = Math.min(start + CHUNK_SIZE, totalBytes);
    const chunk = file.slice(start, end);
    const chunkRes = await fetch("/api/flexos/submissions/upload-chunk", {
      method: "POST",
      headers: { ...headers, "x-upload-id": uploadId, "content-range": `bytes ${start}-${end - 1}/${totalBytes}`, "x-file-type": mimeType },
      body: chunk,
    });
    if (!chunkRes.ok) {
      const json = await chunkRes.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error ?? `Chunk yükleme başarısız (${chunkRes.status})`);
    }
    const result = await chunkRes.json() as { status: string; uploadedBytes?: number };
    if (result.status === "complete") uploadedBytes = totalBytes;
    else uploadedBytes = result.uploadedBytes ?? end;
    onProgress?.(Math.round((uploadedBytes / totalBytes) * 100));
  }

  const completeRes = await fetch("/api/flexos/assignments/complete-attachment-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ uploadId }),
  });
  if (!completeRes.ok) {
    const json = await completeRes.json().catch(() => ({})) as { error?: string };
    throw new Error(json.error ?? "Yükleme tamamlanamadı.");
  }
  const { attachment } = await completeRes.json() as { attachment: EditableAttachment };
  return attachment;
}
