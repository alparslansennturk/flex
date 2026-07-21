"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, X, Download } from "lucide-react";
import dynamic from "next/dynamic";
import type { ConnectAttachment } from "./connectClient";

const PdfViewer = dynamic(() => import("@/app/components/shared/PdfViewer"), { ssr: false });
const ExcelViewer = dynamic(() => import("@/app/components/shared/ExcelViewer"), { ssr: false });

const EXCEL_MIME_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/**
 * Görsel eklerde önizleme, PDF/Excel'de kendi içimizde modal önizleme
 * (Faz 4/4, 2026-07-21 — `PdfViewer`/`ExcelViewer` Faz 2'de yazılmıştı,
 * burada bağlandı), diğer türlerde genel dosya kartı.
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const isImage = a.mimeType.startsWith("image/") && !imgError;
  const isPdf = a.mimeType === "application/pdf";
  const isExcel = EXCEL_MIME_TYPES.includes(a.mimeType);
  // ESKİ (Drive tabanlı) ekler: webViewLink bir Drive "view" sayfası, react-pdf/xlsx'in
  // beklediği ham dosya baytları değil — modal önizleme SADECE yeni GCS ekleri için.
  const isPreviewable = (isPdf || isExcel) && !!a.storagePath;

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

  const card = (
    <div
      className="flex items-center gap-2 cursor-pointer transition-colors"
      style={{ marginTop, padding: compact ? "6px 8px" : "8px 10px", borderRadius: compact ? 9 : 10, border: `1px solid ${dark ? "#33405A" : "#E4E6EB"}`, background: dark ? "#233150" : "#FBFCFD" }}
    >
      <FileText size={compact ? 15 : 18} color={dark ? "#7FA9EC" : "#2867bd"} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ fontSize: compact ? 11.5 : 12.5, fontWeight: 700, color: dark ? "#E7EAEF" : "#1B1F26" }}>{a.fileName}</div>
        <div style={{ fontSize: compact ? 10 : 11, color: dark ? "#8B95A7" : "#8A909B" }}>{fmtFileSize(a.fileSize)}</div>
      </div>
    </div>
  );

  return (
    <>
      {isPreviewable ? (
        <button type="button" onClick={() => setPreviewOpen(true)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0 }}>
          {card}
        </button>
      ) : (
        <a href={a.webViewLink} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none" }}>
          {card}
        </a>
      )}

      <AnimatePresence>
        {previewOpen && (
          <motion.div
            className="fixed inset-0 z-[300] flex items-center justify-center p-6"
            style={{ background: "rgba(18,35,59,.42)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={() => setPreviewOpen(false)}
          >
            <motion.div
              className="bg-white flex flex-col"
              style={{ width: "100%", maxWidth: 760, maxHeight: "calc(100vh - 48px)", borderRadius: 20, boxShadow: "0 30px 80px -20px rgba(18,35,59,.5)", overflow: "hidden" }}
              initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3.5" style={{ padding: "16px 20px", borderBottom: "1px solid #EEF0F3" }}>
                <div className="min-w-0">
                  <div className="truncate" style={{ fontSize: 14.5, fontWeight: 800, color: "#1B1F26" }}>{a.fileName}</div>
                  <div style={{ fontSize: 11.5, color: "#8A909B" }}>{fmtFileSize(a.fileSize)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={a.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="İndir"
                    className="flex items-center justify-center cursor-pointer"
                    style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E4E6EB", color: "#4A515C" }}
                  >
                    <Download size={16} />
                  </a>
                  <button onClick={() => setPreviewOpen(false)} className="flex items-center justify-center cursor-pointer" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E4E6EB", color: "#6B717C" }}>
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div style={{ padding: 18, overflow: "auto" }}>
                {isPdf && <PdfViewer url={a.webViewLink} />}
                {isExcel && <ExcelViewer url={a.webViewLink} />}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
