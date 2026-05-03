"use client";

import { useRef, useState, useCallback } from "react";
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  RefreshCw,
  Trash2,
  FileText,
  Image,
  Archive,
  Video,
} from "lucide-react";
import { useUploadQueue } from "@/app/hooks/useUploadQueue";
import { ALLOWED_MIME_TYPES, MAX_RESUMABLE_FILE_SIZE_BYTES, MAX_RESUMABLE_FILE_SIZE_LABEL } from "@/app/types/storage";
import type { UploadJob } from "@/app/types/upload";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/"))  return <Image  size={14} className="shrink-0" />;
  if (mimeType.startsWith("video/"))  return <Video  size={14} className="shrink-0" />;
  if (mimeType.includes("zip") || mimeType.includes("rar")) return <Archive size={14} className="shrink-0" />;
  return <FileText size={14} className="shrink-0" />;
}

function StatusBadge({ status }: { status: UploadJob["status"] }) {
  const map: Record<UploadJob["status"], { label: string; cls: string; icon?: React.ReactNode }> = {
    pending:      { label: "Sırada",       cls: "bg-surface-100 text-surface-500" },
    initializing: { label: "Başlatılıyor", cls: "bg-blue-50 text-blue-600",   icon: <Loader2 size={10} className="animate-spin" /> },
    uploading:    { label: "Yükleniyor",   cls: "bg-blue-50 text-blue-600",   icon: <Loader2 size={10} className="animate-spin" /> },
    completing:   { label: "Tamamlanıyor", cls: "bg-blue-50 text-blue-600",   icon: <Loader2 size={10} className="animate-spin" /> },
    success:      { label: "Tamamlandı",   cls: "bg-status-success-50 text-status-success-500", icon: <CheckCircle2 size={10} /> },
    error:        { label: "Hata",         cls: "bg-status-danger-50 text-status-danger-500",   icon: <AlertCircle  size={10} /> },
    cancelled:    { label: "İptal",        cls: "bg-surface-100 text-surface-400" },
  };

  const { label, cls, icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${cls}`}>
      {icon}
      {label}
    </span>
  );
}

// ── JobItem ───────────────────────────────────────────────────────────────────

interface JobItemProps {
  job:      UploadJob;
  onCancel: () => void;
  onRemove: () => void;
  onRetry:  () => void;
}

function JobItem({ job, onCancel, onRemove, onRetry }: JobItemProps) {
  const isActive = ["initializing", "uploading", "completing"].includes(job.status);
  const isDone   = ["success", "error", "cancelled"].includes(job.status);

  return (
    <div className="flex flex-col gap-2 px-4 py-3 rounded-xl border border-surface-100 bg-white">
      {/* Top row */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-surface-400">
          <FileIcon mimeType={job.file.type} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-base-primary-900 truncate leading-tight">{job.fileName}</p>
          <p className="text-[11px] text-surface-400">{formatBytes(job.fileSize)}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {/* Progress bar (active only) */}
      {isActive && (
        <div className="space-y-1">
          <div className="w-full h-1.5 bg-surface-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-base-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-surface-400">
            <span>{job.progress}%</span>
            <span>{formatBytes(job.uploadedBytes)} / {formatBytes(job.fileSize)}</span>
          </div>
        </div>
      )}

      {/* Error message */}
      {job.status === "error" && job.error && (
        <p className="text-[11px] text-status-danger-500 leading-snug">{job.error}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-1.5 justify-end">
        {isActive && (
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-surface-200 text-surface-500 hover:border-status-danger-300 hover:text-status-danger-500 transition-colors cursor-pointer"
          >
            <X size={11} /> İptal
          </button>
        )}
        {job.status === "error" && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-surface-200 text-surface-500 hover:border-base-primary-300 hover:text-base-primary-600 transition-colors cursor-pointer"
          >
            <RefreshCw size={11} /> Tekrar
          </button>
        )}
        {isDone && (
          <button
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-surface-200 text-surface-400 hover:border-surface-400 hover:text-surface-600 transition-colors cursor-pointer"
          >
            <Trash2 size={11} /> Kaldır
          </button>
        )}
      </div>
    </div>
  );
}

// ── UploadQueueUI ─────────────────────────────────────────────────────────────

export interface UploadQueueUIProps {
  studentId: string;
  taskId:    string;
  groupId:   string;
  note?:     string;
}

export function UploadQueueUI({ studentId, taskId, groupId, note }: UploadQueueUIProps) {
  const {
    jobs,
    addFiles,
    cancelJob,
    removeJob,
    retryJob,
    clearCompleted,
    activeCount,
    totalSize,
    uploadedSize,
  } = useUploadQueue({ studentId, taskId, groupId, note });

  const inputRef  = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const allowedAccept = (ALLOWED_MIME_TYPES as readonly string[]).join(",");

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const valid: File[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_RESUMABLE_FILE_SIZE_BYTES) continue; // skip over-limit silently
      valid.push(file);
    }
    if (valid.length > 0) addFiles(valid);
  }, [addFiles]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const totalProgress = totalSize > 0 ? Math.round((uploadedSize / totalSize) * 100) : 0;
  const hasCompleted  = jobs.some(j => ["success", "error", "cancelled"].includes(j.status));
  const pendingCount  = jobs.filter(j => j.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        className={`w-full flex flex-col items-center justify-center gap-2.5 px-6 py-7 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
          dragging
            ? "border-base-primary-400 bg-base-primary-50"
            : "border-surface-200 hover:border-base-primary-300 hover:bg-surface-50"
        }`}
      >
        <div className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center">
          <Upload size={17} className="text-surface-500" />
        </div>
        <div className="text-center">
          <p className="text-[13px] font-bold text-base-primary-900">Dosyaları seç veya sürükle bırak</p>
          <p className="text-[11px] text-surface-400 mt-0.5">
            PDF, Görsel, Office, ZIP, Video · Maks {MAX_RESUMABLE_FILE_SIZE_LABEL} · En fazla 5 dosya aynı anda
          </p>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={allowedAccept}
        onChange={onInputChange}
        className="hidden"
      />

      {/* Overall progress (only shown when something is active/queued) */}
      {jobs.length > 0 && (
        <div className="px-4 py-3 rounded-xl bg-surface-50 border border-surface-100 space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-bold text-base-primary-900">
              {jobs.length} dosya
            </span>
            <div className="flex items-center gap-3 text-surface-500">
              {activeCount > 0 && (
                <span className="flex items-center gap-1">
                  <Loader2 size={11} className="animate-spin" />
                  {activeCount} yükleniyor
                </span>
              )}
              {pendingCount > 0 && (
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {pendingCount} sırada
                </span>
              )}
              <span className="font-bold text-base-primary-700">{totalProgress}%</span>
            </div>
          </div>
          <div className="w-full h-1.5 bg-surface-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-base-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Job list */}
      {jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map(job => (
            <JobItem
              key={job.id}
              job={job}
              onCancel={() => cancelJob(job.id)}
              onRemove={() => removeJob(job.id)}
              onRetry={() => retryJob(job.id)}
            />
          ))}
        </div>
      )}

      {/* Clear completed */}
      {hasCompleted && (
        <button
          onClick={clearCompleted}
          className="text-[12px] font-medium text-surface-500 hover:text-base-primary-700 transition-colors cursor-pointer"
        >
          Tamamlananları temizle
        </button>
      )}
    </div>
  );
}
