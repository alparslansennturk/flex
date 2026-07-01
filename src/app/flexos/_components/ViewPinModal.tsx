"use client";

/**
 * Admin Kişisel Görünüm Anahtarı — Core→Full geçiş PIN modalı.
 * Gizli kısayolla (FlexSidebar) tetiklenir. Full→Core yönünde bu modal hiç açılmaz.
 */

import React, { CSSProperties, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/app/lib/firebase";

interface ViewPinModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export default function ViewPinModal({ open, onClose, onVerified }: ViewPinModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPin("");
    setError(null);
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (pin.length !== 4 || busy) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch("/api/flexos/view-access/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pin }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && json.ok) {
          onVerified();
          return;
        }
        setError(json.reason === "no_pin" ? "Henüz PIN belirlenmemiş. Kullanıcılar sayfasından oluşturun." : "Yanlış PIN.");
        setPin("");
        inputRef.current?.focus();
      } catch {
        if (!cancelled) setError("Sunucu hatası.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          style={S.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => !busy && onClose()}
        >
          <motion.div
            style={S.card}
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 15.5, fontWeight: 800, color: "#0f1f3d", textAlign: "center" }}>Yönetici Görünümü</div>
            <div style={{ fontSize: 12.5, color: "#64748b", textAlign: "center", marginTop: 4 }}>Devam etmek için PIN girin</div>
            <input
              ref={inputRef}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              disabled={busy}
              inputMode="numeric"
              autoComplete="off"
              type="password"
              maxLength={4}
              placeholder="••••"
              style={S.input}
            />
            {error && <div style={S.error}>{error}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const S: Record<string, CSSProperties> = {
  backdrop: { position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,23,42,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 300, background: "#fff", borderRadius: 18, padding: "28px 26px", boxShadow: "0 30px 60px -20px rgba(15,31,61,.45)", fontFamily: "'Inter', system-ui, sans-serif" },
  input: {
    display: "block", width: "100%", marginTop: 18, padding: "12px 14px", borderRadius: 12,
    border: "1px solid #E2E5EA", fontSize: 24, letterSpacing: "10px", textAlign: "center",
    fontFamily: "inherit", outline: "none", color: "#1E222B",
  },
  error: { marginTop: 12, fontSize: 12.5, color: "#DC2626", textAlign: "center", fontWeight: 600 },
};
