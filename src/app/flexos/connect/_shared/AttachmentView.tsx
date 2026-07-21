"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import type { ConnectAttachment } from "./connectClient";

/**
 * Görsel eklerde önizleme, diğer türlerde genel dosya kartı.
 * ESKİ (Drive tabanlı, `driveFileId` dolu) ekler Drive'ın thumbnail servisini
 * kullanır (`sz=w500`, sadece public-read dosyalarda çalışır). YENİ (Cloud
 * Storage, `storagePath` dolu, 2026-07-21) ekler `webViewLink`'i (GCS public
 * URL) doğrudan `<img>` kaynağı olarak kullanır — GCS'in ayrı bir thumbnail
 * servisi yok, tam görsel `objectFit:"cover"` ile küçültülüyor.
 */
export function AttachmentView({
  attachment: a,
  fmtFileSize,
  marginTop,
  compact = false,
  dark = false,
}: {
  attachment: ConnectAttachment;
  fmtFileSize: (bytes: number) => string;
  marginTop: number;
  compact?: boolean;
  /** Mobil koyu tema (2026-07-20) — masaüstü her zaman açık tema, varsayılan false. */
  dark?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const isImage = a.mimeType.startsWith("image/") && !imgError;

  if (isImage) {
    return (
      <a
        href={a.webViewLink}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "block", marginTop, borderRadius: compact ? 9 : 10, overflow: "hidden", border: `1px solid ${dark ? "#33405A" : "#E4E6EB"}`, maxWidth: compact ? 200 : 260 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.storagePath ? a.webViewLink : `https://drive.google.com/thumbnail?id=${a.driveFileId}&sz=w500`}
          alt={a.fileName}
          onError={() => setImgError(true)}
          style={{ display: "block", width: "100%", maxHeight: compact ? 180 : 220, objectFit: "cover" }}
        />
      </a>
    );
  }

  return (
    <a
      href={a.webViewLink}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 cursor-pointer transition-colors"
      style={{ marginTop, padding: compact ? "6px 8px" : "8px 10px", borderRadius: compact ? 9 : 10, border: `1px solid ${dark ? "#33405A" : "#E4E6EB"}`, background: dark ? "#233150" : "#FBFCFD", textDecoration: "none" }}
    >
      <FileText size={compact ? 15 : 18} color={dark ? "#7FA9EC" : "#2867bd"} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ fontSize: compact ? 11.5 : 12.5, fontWeight: 700, color: dark ? "#E7EAEF" : "#1B1F26" }}>{a.fileName}</div>
        <div style={{ fontSize: compact ? 10 : 11, color: dark ? "#8B95A7" : "#8A909B" }}>{fmtFileSize(a.fileSize)}</div>
      </div>
    </a>
  );
}
