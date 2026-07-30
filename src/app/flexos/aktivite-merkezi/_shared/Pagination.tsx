"use client";

import { S } from "./ui";

interface PaginationProps {
  total: number;
  safePage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

/** Aktivite Merkezi tablo altındaki sayfalama şeridi. */
export function Pagination({ total, safePage, totalPages, onPageChange }: PaginationProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "15px 22px", borderTop: "1px solid #EEF0F3", background: "#F7F8FA" }}>
      <div style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>
        Toplam <strong style={{ color: "#1E222B", fontWeight: 700 }}>{total}</strong> aktivite
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <button className="am-pag-btn" onClick={() => onPageChange(Math.max(1, safePage - 1))} disabled={safePage <= 1}
          style={{ ...S.pagBtn, cursor: safePage <= 1 ? "not-allowed" : "pointer", opacity: safePage <= 1 ? 0.4 : 1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <button key={p} className="am-pag-btn" onClick={() => onPageChange(p)}
            style={{ ...S.pagBtn, border: p === safePage ? "1px solid #2867bd" : "1px solid #E2E5EA", background: p === safePage ? "#2867bd" : "#fff", color: p === safePage ? "#fff" : "#414B59", fontWeight: p === safePage ? 700 : 600 }}>
            {p}
          </button>
        ))}
        <button className="am-pag-btn" onClick={() => onPageChange(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}
          style={{ ...S.pagBtn, cursor: safePage >= totalPages ? "not-allowed" : "pointer", opacity: safePage >= totalPages ? 0.4 : 1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  );
}
