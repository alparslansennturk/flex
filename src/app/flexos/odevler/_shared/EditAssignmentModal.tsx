"use client";

/**
 * FlexOS · Ödevi Düzenle — paylaşımlı modal (2026-07-08). Önceden sadece Ödev
 * Yönetimi'nin kendi içinde (inline state) vardı; Eğitmen Ana Sayfa'daki Ödev
 * Parkuru kartının "Ödevi Düzenle" menüsü de aynı akışı kullanabilsin diye buraya
 * çıkarıldı — tek kaynak, iki giriş noktası. `PATCH /api/flexos/assignments/[id]`
 * (zaten var olan endpoint) — title/description/dueDate/status.
 *
 * **"Ödev Dosyası Yükle" BİTTİ (2026-07-08, aynı gün):** eskiden bilerek placeholder'dı
 * ("Ödev Oluştur" modalında hâlâ öyle — YENİ ödev henüz kaydedilmeden dosya eklenemez,
 * `assignmentId` gerekiyor). Burada (mevcut/kaydedilmiş ödev) sürükle-bırak gerçek
 * çalışıyor — öğrenci teslimiyle AYNI resumable-upload deseni (`CHUNK_SIZE` chunk'lama,
 * `/api/flexos/submissions/upload-chunk` proxy'si REUSE edilir, kind'a bakmaz) ama farklı
 * uç noktalar (`init/complete-attachment-upload`) ve farklı hedef: `Submission` değil
 * doğrudan `Assignment.attachments`. Klasör: `{eğitmenAdı}/{branş}/{grupKodu}/{ödevAdı}/
 * Eğitmen` (`resolveAssignmentFolderSegments`, `submission-service.ts`).
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { X, Loader2, UploadCloud, FileText, ExternalLink } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import { uploadAssignmentAttachment, ATTACHMENT_MAX_MB } from "./uploadAssignmentAttachment";

export type AssignmentStatus = "draft" | "published" | "closed" | "archived";

export interface EditableAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  webViewLink: string;
}

export interface EditableAssignment {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  status: AssignmentStatus;
  attachments?: EditableAttachment[];
}

interface UploadJob { fileName: string; progress: number; status: "uploading" | "success" | "error"; error?: string }

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

interface Props {
  /** null ise modal kapalı — açmak için bir `EditableAssignment` ver. */
  assignment: EditableAssignment | null;
  onClose: () => void;
  /** Kaydedince güncellenmiş alanlarla çağrılır — çağıran kendi listesini/kartını
   * yerelde günceller (koca reload yok, bkz. proje kuralı). */
  onSaved: (updated: EditableAssignment) => void;
}

export default function EditAssignmentModal({ assignment, onClose, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<AssignmentStatus>("draft");
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<EditableAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  useEffect(() => {
    if (!assignment) return;
    setTitle(assignment.title);
    setDescription(assignment.description);
    setDueDate(assignment.dueDate ? assignment.dueDate.slice(0, 10) : "");
    setStatus(assignment.status);
    setAttachments(assignment.attachments ?? []);
    setJobs([]);
  }, [assignment]);

  if (!assignment) return null;
  const assignmentId = assignment.id;

  async function handleSave() {
    if (!assignment) return;
    const t = title.trim();
    const d = description.trim();
    if (!t || !d) { toast.error("Başlık ve açıklama zorunlu."); return; }
    setSaving(true);
    try {
      const isoDue = dueDate ? new Date(dueDate).toISOString() : undefined;
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ title: t, description: d, dueDate: isoDue, status }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast.error(json.error ?? "Kaydedilemedi.");
        return;
      }
      toast.success("Ödev güncellendi.");
      onSaved({ id: assignment.id, title: t, description: d, dueDate: isoDue, status, attachments });
    } finally {
      setSaving(false);
    }
  }

  async function uploadOne(file: File) {
    const jobIndex = jobs.length;
    setJobs((prev) => [...prev, { fileName: file.name, progress: 0, status: "uploading" }]);
    const patchJob = (patch: Partial<UploadJob>) =>
      setJobs((prev) => prev.map((j, i) => (i === jobIndex ? { ...j, ...patch } : j)));

    try {
      const attachment = await uploadAssignmentAttachment(assignmentId, file, (pct) => patchJob({ progress: pct }));
      setAttachments((prev) => [...prev, attachment]);
      patchJob({ status: "success", progress: 100 });
    } catch (err: unknown) {
      patchJob({ status: "error", error: err instanceof Error ? err.message : "Bilinmeyen hata." });
    }
  }

  function pickFiles(incoming: FileList | File[]) {
    Array.from(incoming).forEach((f) => { void uploadOne(f); });
  }

  // 2026-07-11 kullanıcı isteği: modal sert bir "pop" ile açılıyordu, framer-motion
  // giriş animasyonu istendi (backdrop fade + diyalog scale/slide-in) — ViewPinModal'daki
  // AYNI desen.
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      onClick={() => !saving && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-base-primary-900">Ödevi Düzenle</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-100 text-surface-400 cursor-pointer"><X size={16} /></button>
        </div>

        <div>
          <label className="text-[12px] font-semibold text-surface-500 mb-1 block">Başlık</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-surface-200 text-[14px] outline-none focus:border-base-primary-400 transition-colors"
            placeholder="Ödev başlığı"
          />
        </div>

        <div>
          <label className="text-[12px] font-semibold text-surface-500 mb-1 block">Açıklama</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2.5 rounded-xl border border-surface-200 text-[14px] outline-none focus:border-base-primary-400 transition-colors resize-none"
            placeholder="Ödev açıklaması / talimatları"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-[12px] font-semibold text-surface-500 mb-1 block">Son Teslim Tarihi</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-surface-200 text-[14px] outline-none focus:border-base-primary-400 transition-colors"
            />
          </div>
          <div className="flex-1">
            <label className="text-[12px] font-semibold text-surface-500 mb-1 block">Durum</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AssignmentStatus)}
              className="w-full px-3 py-2.5 rounded-xl border border-surface-200 text-[14px] outline-none focus:border-base-primary-400 transition-colors bg-white"
            >
              <option value="draft">Taslak</option>
              <option value="published">Yayında</option>
              <option value="closed">Kapalı</option>
              <option value="archived">Arşivde</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[12px] font-semibold text-surface-500 mb-1 block">Ödev Dosyaları</label>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFiles(e.dataTransfer.files); }}
            className={`flex items-center gap-2 justify-center px-4 py-4 rounded-xl border-2 border-dashed text-[12.5px] font-semibold cursor-pointer transition-colors ${dragOver ? "border-base-primary-400 bg-base-primary-50 text-base-primary-700" : "border-surface-200 text-surface-500 hover:bg-surface-50"}`}
          >
            <UploadCloud size={16} className="shrink-0" />
            Sürükle-bırak ya da tıkla ({ATTACHMENT_MAX_MB}MB'a kadar)
            <input type="file" multiple className="hidden" onChange={(e) => e.target.files && pickFiles(e.target.files)} />
          </label>

          {(attachments.length > 0 || jobs.length > 0) && (
            <div className="mt-2 space-y-1.5">
              {attachments.map((a) => (
                <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-50 border border-surface-100 text-[12px]">
                  <FileText size={14} className="text-surface-400 shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-text-primary font-medium">{a.fileName}</span>
                  <a href={a.webViewLink} target="_blank" rel="noopener noreferrer" className="text-surface-400 hover:text-base-primary-600 shrink-0">
                    <ExternalLink size={13} />
                  </a>
                </div>
              ))}
              {jobs.filter((j) => j.status !== "success").map((j, i) => (
                <div key={`job-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-50 border border-surface-100 text-[12px]">
                  {j.status === "uploading" ? <Loader2 size={14} className="animate-spin text-base-primary-500 shrink-0" /> : <FileText size={14} className="text-status-danger-500 shrink-0" />}
                  <span className="flex-1 min-w-0 truncate text-text-primary font-medium">{j.fileName}</span>
                  <span className={j.status === "error" ? "text-status-danger-500" : "text-surface-400"}>
                    {j.status === "error" ? (j.error ?? "Hata") : `%${j.progress}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-xl text-[14px] font-semibold text-surface-500 border border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer disabled:opacity-50">
            İptal
          </button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl text-[14px] font-semibold text-white bg-base-primary-600 hover:bg-base-primary-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />} Kaydet
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
