"use client";

/**
 * Kendi içimizde Excel önizleme (2026-07-21) — PdfViewer.tsx ile AYNI gerekçe:
 * dosya hiçbir dış servise (Google/Microsoft viewer) gitmiyor, SheetJS (`xlsx`)
 * ile tamamen tarayıcıda ayrıştırılıp bir HTML tabloya render ediliyor.
 *
 * Excel'in birebir görsel biçimlendirmesini (renkli hücreler, birleştirilmiş
 * hücreler) KOPYALAMAZ — sadece hücre verisini düzgün bir tabloda gösterir,
 * bir dosyayı incelemek/gözden geçirmek için bu yeterli (kullanıcı kararı,
 * 2026-07-21).
 */

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Loader2, AlertTriangle } from "lucide-react";

interface ExcelViewerProps {
  url: string;
  className?: string;
}

export default function ExcelViewer({ url, className }: ExcelViewerProps) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Dosya indirilemedi (${res.status})`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        if (cancelled) return;
        const wb = XLSX.read(buf, { type: "array" });
        setWorkbook(wb);
        setActiveSheet(0);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Excel dosyası okunamadı."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return <div style={{ padding: 60, display: "flex", justifyContent: "center" }}><Loader2 size={22} className="animate-spin" style={{ color: "#8E95A3" }} /></div>;
  }
  if (error || !workbook) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "50px 20px", color: "#D93636" }}>
        <AlertTriangle size={28} />
        <span style={{ fontSize: 13.5, fontWeight: 600, textAlign: "center" }}>{error ?? "Excel dosyası okunamadı."}</span>
      </div>
    );
  }

  const sheetName = workbook.SheetNames[activeSheet];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, blankrows: false });

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      {workbook.SheetNames.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {workbook.SheetNames.map((name, i) => (
            <button
              key={name}
              onClick={() => setActiveSheet(i)}
              style={{
                padding: "6px 12px", borderRadius: 8, border: `1px solid ${i === activeSheet ? "#2867bd" : "#E2E5EA"}`,
                background: i === activeSheet ? "#EAF1FB" : "#fff", color: i === activeSheet ? "#205297" : "#414B59",
                fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div style={{ border: "1px solid #E2E5EA", borderRadius: 12, overflow: "auto", maxHeight: 560, width: "100%" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12.5, width: "100%" }}>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri === 0 ? "#F7F8FA" : "#fff" }}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      border: "1px solid #EEF0F3", padding: "6px 10px", whiteSpace: "nowrap",
                      fontWeight: ri === 0 ? 700 : 500, color: "#1E222B",
                    }}
                  >
                    {cell === undefined || cell === null ? "" : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td style={{ padding: 30, textAlign: "center", color: "#8E95A3", fontSize: 13 }}>Bu sayfada veri yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
