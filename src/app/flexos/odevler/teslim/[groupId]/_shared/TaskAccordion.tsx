"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ClipboardList, ChevronDown, Smile, Meh, RefreshCw, ArrowRight, FileText, ExternalLink, MoreHorizontal, Plus, Upload, X,
} from "lucide-react";
import { authHeaders } from "@/app/lib/client/auth-headers";
import { uploadAssignmentAttachment } from "../../../_shared/uploadAssignmentAttachment";
import type { AssignmentStatus } from "../../../_shared/EditAssignmentModal";
import type { AssignmentAttachment, AssignmentItem, SubmissionRow } from "./types";
import { fmtEndDate, fmtCreatedAt } from "./format";

export function TaskAccordion({ assignment, submissions, totalStudents, groupId, isActiveSection, initialOpen, onEdit, onAttachmentsChanged, onStatusChanged }: {
  assignment: AssignmentItem; submissions: SubmissionRow[]; totalStudents: number; groupId: string; isActiveSection: boolean; initialOpen?: boolean; onEdit: (a: AssignmentItem) => void; onAttachmentsChanged: (assignmentId: string, attachments: AssignmentAttachment[]) => void; onStatusChanged: (assignmentId: string, status: AssignmentStatus) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!initialOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // "Arşivle" (2026-07-29) — kullanıcı isteği: notlama akışından BAĞIMSIZ, trainer'ın
  // kendi kararıyla bir ödevi ileride silmek üzere arşive taşıyabilmesi lazım. "Notları
  // Kaydet" artık ASLA arşivlemiyor (bkz. `gradeBatch` — "closed" kullanıyor), arşivleme
  // SADECE bu bilinçli aksiyonla olur.
  async function handleArchive() {
    if (!window.confirm(`"${assignment.title}" ödevini arşive taşımak istediğine emin misin? Arşivden istersen geri alabilir ya da kalıcı silebilirsin.`)) return;
    setArchiving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) { toast.error("Arşivlenemedi."); return; }
      toast.success("Ödev arşive taşındı.");
      onStatusChanged(assignment.id, "archived");
    } finally {
      setArchiving(false);
      setMenuOpen(false);
    }
  }

  // Dosya Yükle — canlıdaki AttachmentManager portu (bkz. dosya başı yorumu).
  const [expanding, setExpanding] = useState(false);
  const [driveMode, setDriveMode] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [driveLink, setDriveLink] = useState("");
  const [driveName, setDriveName] = useState("");
  const [attachError, setAttachError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function saveAttachments(next: AssignmentAttachment[]) {
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/assignments/${assignment.id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ attachments: next }),
    });
    if (!res.ok) throw new Error("Kaydedilemedi.");
    onAttachmentsChanged(assignment.id, next);
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (!files.length) return;
    setUploading(true);
    setAttachError("");
    try {
      const uploaded: AssignmentAttachment[] = [];
      // Sıralı yükleme — canlıdaki gibi (klasör oluşturma thread-safe değil).
      for (const file of files) {
        const attachment = await uploadAssignmentAttachment(assignment.id, file, (pct) => setUploadProgress(Math.round(pct * 0.9)));
        uploaded.push(attachment);
      }
      setUploadProgress(95);
      await saveAttachments([...assignment.attachments, ...uploaded]);
      setUploadProgress(100);
      setExpanding(false);
      setDriveMode(false);
    } catch (err: unknown) {
      setAttachError(err instanceof Error ? err.message : "Yükleme başarısız.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleDriveSave() {
    const url = driveLink.trim();
    if (!url) return;
    // Google Drive "modu" canlıda da gerçek bir picker değil — sadece link yapıştırma.
    // driveFileId/fileSize/mimeType yok (gerçek yükleme değil, referans link).
    const newAttachment: AssignmentAttachment = {
      id: `drive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fileName: driveName.trim() || "Google Drive Dosyası",
      fileSize: 0,
      mimeType: "application/vnd.google-apps.drive-link",
      webViewLink: url,
    };
    try {
      await saveAttachments([...assignment.attachments, newAttachment]);
      setExpanding(false);
      setDriveMode(false);
      setDriveLink("");
      setDriveName("");
    } catch {
      toast.error("Kaydedilemedi.");
    }
  }

  async function handleRemoveAttachment(attachmentId: string) {
    try {
      await saveAttachments(assignment.attachments.filter((a) => a.id !== attachmentId));
    } catch {
      toast.error("Silinemedi.");
    }
  }

  function toggleExpand() {
    const next = !expanding;
    setExpanding(next);
    if (!next) { setDriveMode(false); setAttachError(""); }
  }

  const hasFiles = assignment.attachments.length > 0;

  // Kartın TÜMÜNE sürükle-bırak — canlıdaki davranış: panel açıkken (expanding=true,
  // "uploadActive") kartın HERHANGİ bir noktasına dosya sürüklenince mavi glow border
  // çıkar, bırakınca otomatik yüklenir. 2026-07-11 DÜZELTME: ilk denemede canlıdaki gibi
  // imperatif DOM stiliyle (ref.current.style.x=...) yazılmıştı ama ÇALIŞMADI (kullanıcı
  // testinde hiç border çıkmadı) — modal'daki (ÇALIŞAN, kanıtlı) `useState` deseniyle
  // değiştirildi, daha güvenilir.
  const [isDragOver, setIsDragOver] = useState(false);
  useEffect(() => { if (!expanding) setIsDragOver(false); }, [expanding]);

  // Belirli bir ödevden geri dönülünce (bkz. OdevTeslimiGroupPage focusAssignmentId)
  // sadece açık gelmesi yetmez, görünür alana da kaydırılmalı — sayfada çok ödev varsa
  // açık kart ekran dışında kalabilir.
  useEffect(() => {
    if (initialOpen) rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const teslimEdenler = submissions.filter((s) => s.status !== "revision" && s.status !== "retracted").length;
  const revize = submissions.filter((s) => s.status === "revision").length;
  const bekleyenler = Math.max(0, totalStudents - submissions.filter((s) => s.status !== "retracted").length);

  return (
    <div
      ref={rootRef}
      className="rounded-2xl transition-shadow duration-150"
      style={isDragOver ? { boxShadow: "0 0 0 3px #6366f1, 0 0 0 6px rgba(99,102,241,0.15)" } : undefined}
      // 2026-07-11 (2. düzeltme): "+" ile paneli önce açmak ZORUNLU değilmiş — kullanıcı
      // canlıda paneli hiç açmadan, kapalı/dinlenme durumundaki karta bile dosya
      // sürükleyince mavi hale çıkıp otomatik yüklendiğini belirtti. `expanding` şartı
      // kaldırıldı — kart HER ZAMAN geçerli bir drop hedefi, drop anında panel de
      // (ilerleme çubuğu görünsün diye) otomatik açılıyor.
      onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragOver={(e) => { e.preventDefault(); }}
      onDragLeave={(e) => {
        if (e.clientX === 0 && e.clientY === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const inside = e.clientX > rect.left && e.clientX < rect.right && e.clientY > rect.top && e.clientY < rect.bottom;
        if (!inside) setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        // Akordiyon kapalıyken sürüklenip bırakılırsa da AÇILIR — aksi halde ilerleme
        // çubuğu görünmez, kullanıcı yüklemenin gerçekten başladığını göremez.
        if (e.dataTransfer.files.length) { setOpen(true); setExpanding(true); void handleFiles(e.dataTransfer.files); }
      }}
    >
    {/* 2026-07-29 fix: `overflow-hidden` BURADAN kaldırıldı — ⋮ menüsündeki dropdown
        `absolute` konumlanıyor, bu kırpma yüzünden görünmüyordu ("içerde sıkışıyor"
        kullanıcı bulgusu, madde sayısı 2'ye çıkınca daha da belirginleşti). Köşe
        yuvarlaklığı zaten `rounded-2xl`'in kendi arka planı/border'ı için yeterli —
        overflow-hidden sadece çocukların köşeden taşmasını engellemek içindi, burada
        taşan bir görsel/renk yok (hover arka planı en fazla birkaç piksel taşabilir,
        gözle fark edilmez). */}
    <div className={`bg-white border rounded-2xl transition-colors duration-150 ${isDragOver ? "border-[#6366f1]" : "border-surface-200"}`}>
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer select-none hover:bg-surface-50/60 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isActiveSection ? "bg-designstudio-primary-500" : "bg-designstudio-secondary-500"}`}>
            <ClipboardList size={18} className="text-white" />
          </div>
          <span className="text-[16px] font-semibold text-text-primary truncate">{assignment.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {assignment.dueDate && <span className="text-[13px] text-surface-500">Teslim: {fmtEndDate(assignment.dueDate)}</span>}
          {/* 3-nokta menü → Ödevi Düzenle (başlık/açıklama/tarih/durum). Dosya yükleme
              BURADA DEĞİL — aşağıdaki açık gövdede, canlıdaki AttachmentManager gibi. */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-100 text-surface-400 hover:text-text-primary transition-all cursor-pointer"
            >
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-50 bg-white border border-surface-200 rounded-2xl shadow-xl overflow-hidden min-w-[150px]" onClick={(e) => e.stopPropagation()}>
                {/* "Ödevi Düzenle" SADECE Aktif bölümünde (2026-07-29 kullanıcı isteği) —
                    Tamamlanan bir ödevi düzenlemenin anlamı yok. */}
                {isActiveSection && (
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(assignment); }}
                    className="w-full px-4 py-2.5 text-left text-[13px] font-bold text-text-primary hover:bg-surface-50 transition-colors cursor-pointer"
                  >
                    Ödevi Düzenle
                  </button>
                )}
                <button
                  onClick={handleArchive}
                  disabled={archiving}
                  className="w-full px-4 py-2.5 text-left text-[13px] font-bold text-surface-500 hover:bg-surface-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {archiving ? "Arşivleniyor…" : "Arşivle"}
                </button>
              </div>
            )}
          </div>
          <ChevronDown size={15} className={`text-surface-500 transition-transform duration-[320ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${open ? "rotate-180" : ""}`} />
        </div>
      </div>

      {open && (
        <>
          <div className="h-px bg-surface-100" />
          <div className="p-6">
            {assignment.createdAt && (
              <p className="text-[13px] text-surface-500 mb-4">
                Eklenme Tarihi:&nbsp;<span className="font-semibold text-text-secondary">{fmtCreatedAt(assignment.createdAt)}</span>
              </p>
            )}

            <div className="flex items-start gap-10 mb-5">
              <div className="w-[60%] shrink-0 min-w-0">
                <p className="text-[14px] lg:text-[15px] xl:text-[16px] font-normal text-text-primary leading-relaxed whitespace-pre-line">
                  {assignment.description}
                </p>
              </div>
              <div className="flex-1 flex items-center justify-center gap-10">
                <StatBlock icon={<Smile size={32} strokeWidth={1.5} className="text-emerald-500" />} label="Teslim Edenler" count={teslimEdenler} />
                <StatBlock icon={<Meh size={32} strokeWidth={1.5} className="text-surface-500" />} label="Bekleyenler" count={bekleyenler} />
                <StatBlock icon={<RefreshCw size={32} strokeWidth={1.5} className="text-designstudio-primary-500" />} label="Revize İstenenler" count={revize} />
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3 mt-5">
              {/* Dosya yönetimi — canlıdaki AttachmentManager BİREBİR portu. */}
              <div className="flex items-center flex-wrap gap-2">
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { const files = e.target.files; if (files) void handleFiles(files); e.target.value = ""; }} />

                <button
                  onClick={toggleExpand}
                  disabled={uploading}
                  style={hasFiles ? {
                    height: 44, width: 44, flexShrink: 0, borderRadius: 12,
                    border: `1px solid ${expanding ? "#6366f1" : "#a5b4fc"}`,
                    backgroundColor: expanding ? "#6366f1" : "#eef2ff",
                    color: expanding ? "#ffffff" : "#4f46e5",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background-color 150ms, border-color 150ms, color 150ms",
                    cursor: "pointer",
                  } : { height: 44, flexShrink: 0 }}
                  className={`transition-colors duration-150 cursor-pointer disabled:opacity-50 ${!hasFiles
                    ? `flex items-center gap-2 px-4 rounded-xl border border-dashed ${expanding ? "border-base-primary-400 bg-base-primary-50 text-base-primary-600" : "border-surface-300 bg-white text-surface-400 hover:border-base-primary-300 hover:text-base-primary-500"}`
                    : ""}`}
                >
                  <motion.span animate={{ rotate: expanding ? 45 : 0 }} transition={{ type: "tween", duration: 0.18, ease: "easeInOut" }} className="flex items-center justify-center">
                    <Plus size={14} strokeWidth={2.5} />
                  </motion.span>
                  {!hasFiles && <span className="text-[13px] font-semibold leading-none">Dosya Yükle</span>}
                </button>

                <AnimatePresence>
                  {expanding && (
                    <motion.div
                      key="upload-panel"
                      initial={{ width: 0, opacity: 0 }} animate={{ width: 290, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                      transition={{ type: "tween", duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                      style={{ height: 44, overflow: "hidden", flexShrink: 0 }}
                    >
                      {uploading ? (
                        <div style={{ height: 44, minWidth: 180 }} className="flex flex-col justify-center px-4 border border-surface-200 rounded-xl bg-white whitespace-nowrap">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[11px] font-semibold text-surface-400">{uploadProgress < 90 ? "Yükleniyor" : uploadProgress < 100 ? "Tamamlanıyor" : "Bitti"}</span>
                            <span className="text-[11px] font-bold text-surface-600">{uploadProgress}%</span>
                          </div>
                          <div className="h-[3px] rounded-full bg-surface-100 overflow-hidden">
                            <div className="h-full rounded-full bg-base-primary-500 transition-[width] duration-300" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        </div>
                      ) : driveMode ? (
                        <div style={{ height: 44 }} className="flex items-center gap-2 w-full">
                          <input
                            value={driveLink}
                            onChange={(e) => setDriveLink(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") void handleDriveSave(); }}
                            placeholder="Google Drive linki..."
                            autoFocus
                            style={{ height: 44 }}
                            className="flex-1 min-w-0 px-3 rounded-xl border border-surface-200 text-[12px] outline-none focus:border-base-primary-400 transition-colors bg-white"
                          />
                          <button onClick={() => void handleDriveSave()} disabled={!driveLink.trim()} style={{ height: 44, flexShrink: 0 }} className="px-3 bg-base-primary-700 text-white text-[12px] font-bold rounded-xl disabled:opacity-40 cursor-pointer hover:bg-base-primary-800 transition-colors whitespace-nowrap">
                            Ekle
                          </button>
                          <button onClick={() => { setDriveMode(false); setDriveLink(""); setDriveName(""); }} style={{ height: 44, width: 44, flexShrink: 0 }} className="flex items-center justify-center bg-surface-100 text-surface-500 rounded-xl cursor-pointer hover:bg-surface-200 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
                          onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFiles(e.dataTransfer.files); }}
                          style={{ height: 44 }}
                          className={`w-full flex items-center gap-1 px-2 border border-dashed rounded-xl transition-colors whitespace-nowrap ${dragOver ? "border-base-primary-400 bg-base-primary-50" : "border-surface-300 bg-white"}`}
                        >
                          <button onClick={() => fileInputRef.current?.click()} className="h-full flex items-center gap-2 px-3 rounded-lg text-[12px] font-semibold text-text-secondary hover:bg-surface-100 transition-colors cursor-pointer">
                            <Upload size={13} className="text-surface-400 shrink-0" />
                            {dragOver ? "Bırakın..." : "Bilgisayardan Yükle"}
                          </button>
                          <div className="w-px h-5 bg-surface-200 shrink-0" />
                          <button onClick={() => setDriveMode(true)} className="h-full flex items-center gap-2 px-3 rounded-lg text-[12px] font-semibold text-text-secondary hover:bg-surface-100 transition-colors cursor-pointer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/icons/google-drive.svg" width={13} height={13} alt="" className="shrink-0" />
                            Google Drive
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {assignment.attachments.map((a) => (
                  <div key={a.id} style={{ height: 44 }} className="flex items-center gap-2 bg-white border border-surface-200 rounded-xl px-3 max-w-[240px]">
                    {a.mimeType === "application/vnd.google-apps.drive-link"
                      /* eslint-disable-next-line @next/next/no-img-element */
                      ? <img src="/icons/google-drive.svg" width={13} height={13} alt="" className="shrink-0" />
                      : <FileText size={13} className="text-surface-400 shrink-0" />}
                    <span className="text-[12px] font-semibold text-text-primary truncate">{a.fileName}</span>
                    <a href={a.webViewLink} target="_blank" rel="noopener noreferrer" className="p-0.5 text-surface-300 hover:text-base-primary-600 transition-colors shrink-0 ml-auto">
                      <ExternalLink size={12} />
                    </a>
                    <button onClick={() => void handleRemoveAttachment(a.id)} className="p-0.5 text-surface-300 hover:text-status-danger-500 transition-colors cursor-pointer shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                ))}

                {attachError && <span className="text-[11px] font-semibold text-status-danger-500">{attachError}</span>}
              </div>

              <button
                onClick={() => router.push(`/flexos/odevler/teslim/${groupId}/${assignment.id}`)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold text-white cursor-pointer transition-colors shrink-0"
                style={{ backgroundColor: "#5E63C2" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4D52A6")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5E63C2")}
              >
                Teslim Durumu
                <ArrowRight size={15} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
    </div>
  );
}

function StatBlock({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex flex-col items-center">
      {icon}
      <p className="mt-1 text-[14px] font-medium text-text-primary text-center leading-tight">{label}</p>
      <p className="mt-2 text-[32px] font-bold text-text-secondary leading-none">{count}</p>
    </div>
  );
}
