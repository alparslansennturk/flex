"use client";

/**
 * FlexOS · Paylaşımlı onay modalı (framer-motion).
 * Kaydet / Satışa Başlat / Satışı Kapat gibi aksiyonlarda onay sorar.
 * NOT: Görsel sonra Claude Design'da elden geçirilebilir.
 */

import React, { CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ModalTone = "primary" | "publish" | "danger";

interface FlexModalProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ModalTone;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TONE: Record<ModalTone, { bg: string; color: string; ring: string }> = {
  primary: { bg: "#0f1f3d", color: "#fff", ring: "rgba(15,31,61,.4)" },
  publish: { bg: "linear-gradient(135deg,#fb923c,#ea580c)", color: "#fff", ring: "rgba(234,88,12,.45)" },
  danger: { bg: "#dc2626", color: "#fff", ring: "rgba(220,38,38,.4)" },
};

export default function FlexModal({ open, title, message, confirmLabel, cancelLabel = "Vazgeç", tone = "primary", busy = false, onConfirm, onCancel }: FlexModalProps) {
  const t = TONE[tone];
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          style={S.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => !busy && onCancel()}
        >
          <motion.div
            style={S.card}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f1f3d", marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, marginBottom: 22 }}>{message}</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={onCancel} disabled={busy} style={S.cancel}>{cancelLabel}</button>
              <button
                onClick={onConfirm}
                disabled={busy}
                style={{ ...S.confirm, background: t.bg, color: t.color, boxShadow: `0 8px 18px -8px ${t.ring}`, opacity: busy ? 0.7 : 1, cursor: busy ? "wait" : "pointer" }}
              >
                {busy ? "İşleniyor…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const S: Record<string, CSSProperties> = {
  backdrop: { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 440, background: "#fff", borderRadius: 18, padding: "26px 26px 22px", boxShadow: "0 30px 60px -20px rgba(15,31,61,.4)", fontFamily: "'Inter', system-ui, sans-serif" },
  cancel: { padding: "11px 18px", borderRadius: 11, border: "1px solid #e3e8f0", background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  confirm: { padding: "11px 20px", borderRadius: 11, border: "none", fontSize: 14, fontWeight: 700, fontFamily: "inherit" },
};
