"use client";

import { AnimatePresence, motion } from "framer-motion";
import { T } from "./theme";
import { fmtDateTr, groupProgramDates, monthsFromToday } from "./mockEngine";

export interface CardDetail { group: string; instructor: string; students: string; timeText: string; labName: string }

interface CardDetailModalProps {
  detail: CardDetail | null;
  onClose: () => void;
}

/** Zaman çizelgesindeki bir ders bloğuna tıklayınca açılan küçük detay modalı (mock grup program tarihleri dahil). */
export function CardDetailModal({ detail, onClose }: CardDetailModalProps) {
  return (
    <AnimatePresence>
      {detail && (() => {
        const { start, end } = groupProgramDates(detail.group);
        return (
          <motion.div
            key="card-detail-ov"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(10,20,35,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          >
            <motion.div
              key="card-detail-panel"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              style={{ width: "100%", maxWidth: 480, background: T.panel, borderRadius: 20, boxShadow: "0 30px 80px -20px rgba(10,20,35,.6)", border: "1px solid " + T.border, overflow: "hidden" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "20px 24px", borderBottom: "1px solid " + T.border }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail.group}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.mutedC, marginTop: 3 }}>{detail.labName} · {detail.timeText}</div>
                </div>
                <button type="button" onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid " + T.border, background: T.panel, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text2, flex: "0 0 auto" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18" /><path d="M6 6l12 12" /></svg>
                </button>
              </div>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: T.mutedC, fontWeight: 600 }}>Eğitmen</span>
                  <span style={{ color: T.text, fontWeight: 700 }}>{detail.instructor}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: T.mutedC, fontWeight: 600 }}>Öğrenci</span>
                  <span style={{ color: T.text, fontWeight: 700 }}>{detail.students}</span>
                </div>
                <div style={{ height: 1, background: T.border2, margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: T.mutedC, fontWeight: 600 }}>Grup Başlangıç Tarihi</span>
                  <span style={{ color: T.text, fontWeight: 700 }}>{fmtDateTr(start)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: T.mutedC, fontWeight: 600 }}>Grup Bitiş Tarihi</span>
                  <span style={{ color: T.text, fontWeight: 700 }}>{fmtDateTr(end)}</span>
                </div>
                <div style={{ marginTop: 4, padding: "13px 16px", borderRadius: 13, background: T.brandBg, border: "1px solid " + T.brandBorder }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.brand }}>Müsait Olunacak Tarih</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginTop: 4 }}>
                    {fmtDateTr(end)} <span style={{ fontWeight: 600, color: T.mutedC, fontSize: 13.5 }}>(~{monthsFromToday(end)} ay sonra)</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        );
      })()}
    </AnimatePresence>
  );
}
