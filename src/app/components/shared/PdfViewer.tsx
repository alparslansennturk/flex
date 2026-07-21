"use client";

/**
 * Kendi içimizde PDF önizleme (2026-07-21) — Google Docs Viewer/Adobe/Office
 * Viewer gibi üçüncü parti bir servise dosya göndermiyor, tamamen tarayıcıda
 * (Mozilla'nın PDF.js motoru, `react-pdf` sarmalayıcısıyla) render ediyor —
 * KVKK açısından öğrenci/kurum dosyaları hiçbir dış servise gitmiyor.
 *
 * Herhangi bir public URL'den çalışır (Drive VEYA GCS, fark etmez) — bu
 * bileşen GCS geçişinden BAĞIMSIZ, mevcut Drive tabanlı dosyalarda da
 * kullanılabilir.
 */

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, AlertTriangle } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfViewerProps {
  url: string;
  className?: string;
}

const iconBtnStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: "1px solid #E2E5EA", background: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59",
};

export default function PdfViewer({ url, className }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setPageNumber((p) => Math.max(1, p - 1))} disabled={pageNumber <= 1} style={{ ...iconBtnStyle, opacity: pageNumber <= 1 ? 0.4 : 1 }}>
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#414B59", minWidth: 60, textAlign: "center" }}>
            {pageNumber} / {numPages ?? "…"}
          </span>
          <button onClick={() => setPageNumber((p) => Math.min(numPages ?? p, p + 1))} disabled={!numPages || pageNumber >= numPages} style={{ ...iconBtnStyle, opacity: !numPages || pageNumber >= numPages ? 0.4 : 1 }}>
            <ChevronRight size={15} />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)))} style={iconBtnStyle}><ZoomOut size={14} /></button>
          <span style={{ fontSize: 12, color: "#8E95A3", minWidth: 38, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((s) => Math.min(2.5, +(s + 0.2).toFixed(1)))} style={iconBtnStyle}><ZoomIn size={14} /></button>
        </div>
      </div>

      <div style={{ border: "1px solid #E2E5EA", borderRadius: 12, overflow: "auto", maxHeight: 560, width: "100%", background: "#F7F8FA", display: "flex", justifyContent: "center", padding: 12 }}>
        {error ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "50px 20px", color: "#D93636" }}>
            <AlertTriangle size={28} />
            <span style={{ fontSize: 13.5, fontWeight: 600, textAlign: "center" }}>{error}</span>
          </div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={(e) => setError(`PDF yüklenemedi: ${e.message}`)}
            loading={<div style={{ padding: 60, display: "flex", justifyContent: "center" }}><Loader2 size={22} className="animate-spin" style={{ color: "#8E95A3" }} /></div>}
          >
            <Page pageNumber={pageNumber} scale={scale} renderTextLayer renderAnnotationLayer />
          </Document>
        )}
      </div>
    </div>
  );
}
