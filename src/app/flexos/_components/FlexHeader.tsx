"use client";

/**
 * FlexOS · Paylaşımlı üst başlık (header).
 * Tek kaynak — tüm FlexOS sayfaları bunu kullanır (FlexSidebar ile aynı desen).
 * Bir yerde değişince (stil/isim kaynağı/bildirim davranışı) her yerde değişir.
 */

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/app/lib/firebase";

// Sayfa değişince FlexHeader yeniden mount olur (paylaşımlı layout yok) — FlexSidebar'daki
// capsCache deseniyle aynı: isim bir kez çekilir, sonraki mount'larda cache'ten okunur.
let nameCache: string | null = null;

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toLocaleUpperCase("tr");
}

interface FlexHeaderProps {
  /** Sol üstte ikon kutusu (yoksa büyük başlık ikon kutusuz render edilir). */
  icon?: React.ReactNode;
  /** true ise başlık "Hoş Geldin, {isim} 😊" olarak render edilir (title yok sayılır). */
  greeting?: boolean;
  title?: string;
  subtitle: string;
  /** Sağ üstte, isim altında (ör. "Yönetici · Satış"). */
  roleLabel?: string;
  maxWidth?: number;
}

// Diğer FlexOS sayfalarının (Eğitim Yönetimi, Sınıflar, Eğitmenler, Satış Yap…) standart
// içerik genişliği — büyük ekranda tutarlı kalması için sabit px, sayfa içeriğiyle AYNI
// değer kullanılmalı (bu bileşenin varsayılanı ve dashboard'un içerik grid'i de 1920).
export const FLEX_CONTENT_MAX_WIDTH = 1920;

export default function FlexHeader({ icon, greeting, title, subtitle, roleLabel = "Yönetici", maxWidth = FLEX_CONTENT_MAX_WIDTH }: FlexHeaderProps) {
  const [displayName, setDisplayName] = useState(nameCache ?? "");

  useEffect(() => {
    if (nameCache) return;
    let cancelled = false;
    (async () => {
      await auth.authStateReady();
      const u = auth.currentUser;
      if (!u) return;
      let full = "";
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const data = snap.exists() ? (snap.data() as { name?: string; surname?: string }) : null;
        full = [data?.name, data?.surname].filter(Boolean).join(" ").trim();
      } catch { /* devamında displayName/email'e düşülür */ }
      const resolved = full || u.displayName || u.email || "";
      nameCache = resolved;
      if (!cancelled) setDisplayName(resolved);
    })();
    return () => { cancelled = true; };
  }, []);

  // Selamlamada SADECE ilk isim — canlıdaki `user?.name?.split(' ')[0]` ile aynı (Header.tsx).
  const firstName = displayName.split(" ")[0] || "";

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, background: "#fff", borderBottom: "1px solid #E2E5EA", boxShadow: "0 2px 6px rgba(15,31,61,.04)" }}>
      <div style={{ maxWidth, margin: "0 auto", width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px 36px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: icon ? 15 : 0 }}>
          {icon && (
            <div style={{ width: 44, height: 44, borderRadius: 13, background: "linear-gradient(135deg,#3A7BD5,#205297)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
              {icon}
            </div>
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 630, letterSpacing: "-0.022em", color: "#1E222B" }}>
              {greeting ? `Hoş Geldin${firstName ? `, ${firstName}` : ""} 😊` : title}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>{subtitle}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <button
            style={{ position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569" }}
            onClick={() => toast.info("Bu özellik yakında.")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            <span style={{ position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" }} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 18, borderLeft: "1px solid #E2E5EA" }}>
            <div style={{ textAlign: "right" as const, lineHeight: 1.3 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B" }}>{displayName || "…"}</div>
              <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500 }}>{roleLabel}</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#FF8D28,#D66500)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(214,101,0,.5)" }}>
              {initials(displayName || "?")}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
