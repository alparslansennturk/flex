"use client";

import { Download, ExternalLink, FileText, Image as ImageIcon, File } from "lucide-react";

interface FileVersion {
  id: string;
  versionNo: number;
  fileName: string;
  fileUrl: string;
  driveViewLink?: string;
  fileSize: number;
  uploadedAt: Date;
  isLatest: boolean;
}

interface Props {
  versions: FileVersion[];
  currentVersionId?: string;
  onVersionChange?: (versionId: string) => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
}

function getFileType(fileName: string): "pdf" | "image" | "other" {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
  return "other";
}

function FileIcon({ name }: { name: string }) {
  const type = getFileType(name);
  if (type === "pdf") return <FileText size={20} className="text-red-500" />;
  if (type === "image") return <ImageIcon size={20} className="text-blue-500" />;
  return <File size={20} className="text-surface-400" />;
}

export default function FilePreview({ versions, currentVersionId, onVersionChange }: Props) {
  const activeVersion = versions.find(v => v.id === currentVersionId) ?? versions.find(v => v.isLatest) ?? versions[versions.length - 1];

  if (!activeVersion) return (
    <div className="flex items-center justify-center h-32 text-surface-400 text-[13px] border border-dashed border-surface-200 rounded-2xl">
      Dosya bulunamadı
    </div>
  );

  const fileType = getFileType(activeVersion.fileName);

  return (
    <div className="space-y-3">
      {/* Versiyon seçici */}
      {versions.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-bold text-surface-500">Versiyon:</span>
          {versions.map(v => (
            <button
              key={v.id}
              onClick={() => onVersionChange?.(v.id)}
              className={`px-3 py-1 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                v.id === activeVersion.id
                  ? "bg-base-primary-600 text-white"
                  : "bg-surface-100 text-surface-600 hover:bg-surface-200"
              }`}
            >
              v{v.versionNo}{v.isLatest ? " (Son)" : ""}
            </button>
          ))}
        </div>
      )}

      {/* Preview alanı */}
      <div className="border border-surface-200 rounded-2xl overflow-hidden bg-surface-50">
        {fileType === "pdf" && activeVersion.driveViewLink && (
          <iframe
            src={`${activeVersion.driveViewLink}&rm=minimal`}
            className="w-full h-[480px]"
            title={activeVersion.fileName}
          />
        )}
        {fileType === "image" && (
          <div className="flex items-center justify-center p-4 min-h-[240px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeVersion.fileUrl}
              alt={activeVersion.fileName}
              className="max-w-full max-h-[400px] rounded-xl object-contain shadow"
            />
          </div>
        )}
        {fileType === "other" && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center">
              <FileIcon name={activeVersion.fileName} />
            </div>
            <p className="text-[14px] font-bold text-text-primary">{activeVersion.fileName}</p>
            <p className="text-[12px] text-surface-400">{formatBytes(activeVersion.fileSize)}</p>
          </div>
        )}
      </div>

      {/* Footer: dosya bilgisi + butonlar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon name={activeVersion.fileName} />
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-text-primary truncate">{activeVersion.fileName}</p>
            <p className="text-[11px] text-surface-400">
              {formatBytes(activeVersion.fileSize)} · {formatDate(activeVersion.uploadedAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activeVersion.driveViewLink && (
            <a
              href={activeVersion.driveViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-200 text-[12px] font-bold text-surface-600 hover:bg-surface-50 transition-colors"
            >
              <ExternalLink size={13} /> Drive
            </a>
          )}
          <a
            href={activeVersion.fileUrl}
            download={activeVersion.fileName}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-base-primary-600 text-white text-[12px] font-bold hover:bg-base-primary-700 transition-colors"
          >
            <Download size={13} /> İndir
          </a>
        </div>
      </div>
    </div>
  );
}
