"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, FileText, Image, Archive } from "lucide-react";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from "@/app/types/storage";

interface FileUploaderProps {
  value:    File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  /** Kabul edilen MIME türleri. Default: tüm ALLOWED_MIME_TYPES */
  accept?:  string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image size={18} />;
  if (mimeType.includes("zip"))       return <Archive size={18} />;
  return <FileText size={18} />;
}

function validate(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES)
    return `Dosya boyutu ${MAX_FILE_SIZE_LABEL} sınırını aşıyor (${formatBytes(file.size)}).`;
  const allowed = ALLOWED_MIME_TYPES as readonly string[];
  if (!allowed.includes(file.type))
    return `Bu dosya türü desteklenmiyor: ${file.type || "bilinmiyor"}`;
  return null;
}

export default function FileUploader({ value, onChange, disabled, accept }: FileUploaderProps) {
  const inputRef      = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    const err = validate(file);
    if (err) { setError(err); return; }
    setError(null);
    onChange(file);
  }, [onChange]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const defaultAccept = (ALLOWED_MIME_TYPES as readonly string[]).join(",");

  return (
    <div className="space-y-2">
      {value ? (
        // Seçili dosya önizlemesi
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-base-primary-200 bg-base-primary-50">
          <span className="text-base-primary-500">{fileIcon(value.type)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-base-primary-900 truncate">{value.name}</p>
            <p className="text-[11px] text-surface-400">{formatBytes(value.size)}</p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => { onChange(null); setError(null); }}
              className="text-surface-400 hover:text-status-danger-500 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        // Drag & drop alanı
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`w-full flex flex-col items-center justify-center gap-2 px-6 py-8 rounded-xl border-2 border-dashed transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            dragging
              ? "border-base-primary-400 bg-base-primary-50"
              : "border-surface-200 hover:border-base-primary-300 hover:bg-surface-50"
          }`}
        >
          <Upload size={22} className="text-surface-400" />
          <div className="text-center">
            <p className="text-[13px] font-bold text-base-primary-900">
              Dosya seç veya sürükle bırak
            </p>
            <p className="text-[11px] text-surface-400 mt-0.5">
              PDF, Görsel, Office, ZIP · Maks {MAX_FILE_SIZE_LABEL}
            </p>
          </div>
        </button>
      )}

      {error && (
        <p className="text-[12px] font-medium text-status-danger-500">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept ?? defaultAccept}
        onChange={onInputChange}
        className="hidden"
      />
    </div>
  );
}
