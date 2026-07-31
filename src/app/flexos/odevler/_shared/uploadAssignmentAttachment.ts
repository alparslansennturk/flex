/**
 * Ödev eki yükleme — TEK paylaşımlı fonksiyon (2026-07-08). Hem "Ödevi Düzenle"
 * (`EditAssignmentModal`) hem "Ödev Oluştur" (`OdevOlusturModal`, ödev kaydedildikten
 * HEMEN sonra) buradan çağırır. 2026-07-29: signed-URL akışına taşındı (tarayıcı
 * dosyayı DOĞRUDAN GCS'e PUT eder, Vercel'e hiç uğramaz) — dosya boyutu sınırı
 * BİLEREK KALDIRILDI (kullanıcı kararı: eğitmen kendi ders materyalini yüklerken
 * öğrenci teslimindeki 250MB'a benzer bir tavana çarpmamalı).
 */
import { authHeaders } from "@/app/lib/client/auth-headers";
import type { EditableAttachment } from "./EditAssignmentModal";

export async function uploadAssignmentAttachment(
  assignmentId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<EditableAttachment> {
  const headers = await authHeaders();
  const mimeType = file.type || "application/octet-stream";
  const initRes = await fetch(`/api/flexos/assignments/${assignmentId}/init-attachment-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType }),
  });
  if (!initRes.ok) {
    const json = await initRes.json().catch(() => ({})) as { error?: string };
    throw new Error(json.error ?? "Yükleme başlatılamadı.");
  }
  const { uploadId, uploadUrl } = await initRes.json() as { uploadId: string; uploadUrl: string };

  // Doğrudan GCS'e PUT (bkz. dosya başı yorumu) — `XMLHttpRequest` KASITLI
  // (fetch upload ilerlemesi vermiyor).
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Depolamaya yükleme başarısız (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Ağ hatası — yükleme başarısız."));
    xhr.send(file);
  });

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
