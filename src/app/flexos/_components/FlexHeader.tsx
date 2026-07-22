"use client";

/**
 * FlexOS · Paylaşımlı üst başlık (header).
 * Tek kaynak — tüm FlexOS sayfaları bunu kullanır (FlexSidebar ile aynı desen).
 * Bir yerde değişince (stil/isim kaynağı/bildirim davranışı) her yerde değişir.
 */

import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/app/lib/firebase";
import NotificationBell from "@/app/components/notifications/NotificationBell";
import ConnectWidget from "./ConnectWidget";
import { useCapabilities } from "./useCapabilities";

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
  subtitle?: string;
  /** Sağ üstte, isim altında (ör. "Eğitim Op. - Şirinevler"). Verilmezse gerçek aktör
   * verisinden (`useCapabilities`, `/api/flexos/me::roleLabel`) otomatik hesaplanır —
   * 2026-07-22 kararı öncesi HER sayfa burada elle sabit bir string yazıyordu (gerçek
   * role/şubeye hiç bağlı değildi). Öğrenci sayfası gibi kendi gerçek verisinden özel bir
   * etiket üreten çağıranlar bu prop'u YİNE de açıkça verebilir (override kalır). */
  roleLabel?: string;
  maxWidth?: number;
  /** Verilirse `maxWidth` sayısal değeri yok sayılır, bunun yerine bu Tailwind sınıfı (ör.
   *  responsive `max-w-[...]`) içerik genişliğini belirler — canlıdaki dashboard genişliğine
   *  uyan sayfalar için (bkz. `FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS`). */
  maxWidthClassName?: string;
  /** Verilirse sol taraf (icon/title/subtitle) TAMAMEN bununla değişir — breadcrumb/geri
   *  butonu gibi özel sol içeriği olan sayfalar için (bildirim+avatar bloğu hep aynı kalır). */
  left?: React.ReactNode;
  /** Verilirse iç `users/{uid}` Firestore fetch'i hiç ÇALIŞMAZ, doğrudan bu isim kullanılır —
   *  ismi zaten kendi API'sinden (ör. Person.firstName/lastName) bilen çağıranlar için
   *  (öğrenci sayfası: `users/{uid}` legacy dokümanı FlexOS-only hesaplarda hiç yok). */
  displayNameOverride?: string;
  /** Flex Connect widget'ı yaygınlaştırma (2026-07-18, kalan son madde) — FlexHeader
   * kullanan HER sayfa artık otomatik widget alır (tek noktadan, ~35 sayfa). Öğrenci
   * sayfaları bu prop'u vererek `/api/flexos/student/connect/*` route ailesine
   * yönlendirir; personel sayfaları vermez (varsayılan `/api/flexos/connect/*`).
   * SADECE Connect'in kendi tam-sayfaları FlexHeader'ı hiç KULLANMAZ (bkz. oradaki
   * yorum) — bu yüzden ayrı bir "gizle" prop'una gerek yok. */
  connectPersonId?: string;
}

// Diğer FlexOS sayfalarının (Eğitim Yönetimi, Sınıflar, Eğitmenler, Satış Yap…) standart
// içerik genişliği — büyük ekranda tutarlı kalması için sabit px, sayfa içeriğiyle AYNI
// değer kullanılmalı (bu bileşenin varsayılanı ve dashboard'un içerik grid'i de 1920).
export const FLEX_CONTENT_MAX_WIDTH = 1920;

// Canlı `dashboard/page.tsx` ile AYNI responsive genişlik (2026-07-06) — büyük ekranda
// 1920'nin çok fazla yayıldığı sayfalar için (ör. Eğitmen Ana Sayfa) bu daha dar sınıf kullanılır.
// `w-[94%]` dahil: canlıda bu genişlik yatay padding'siz kullanılıyor (boşluk padding'den değil
// bu %94'ten geliyor) — FlexHeader bu sınıf verilince kendi 36px yatay padding'ini de sıfırlar.
export const FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS = "w-[94%] max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px]";

// `Footer`'ın `containerClassName`'i için hazır sınıf — sayfa başına elle birleştirmek yerine
// tek kaynaktan (aşağıdaki `FlexPageContent` ile AYNI genişlik/ortalama mantığı).
export const FLEX_PAGE_FOOTER_CLASS = `${FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS} mx-auto`;

/**
 * Paylaşımlı sayfa içerik wrapper'ı — `FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS`'ı DOĞRU
 * ortalamak için TEK kaynak (2026-07-08 kararı). Satış Dashboard + Sertifika Notu'na ayrı
 * ayrı elle `mx-auto w-full ${FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}` eklenmişti — `w-full`
 * compact class'ın kendi `w-[94%]`'ünü eziyordu (aynı hata iki sayfada ayrı ayrı çıktı,
 * "sıfıra yapışma" bug'ı). Doğrusu: className'de SADECE compact class, ortalama inline
 * `margin:"0 auto"` ile (`w-full`/`mx-auto` class'ı EKLEME — width çakışması yaratır).
 * Bu bileşen o deseni tek yerde kilitler; sayfa kendi grid/flex düzenini `style`/`className`
 * ile üstüne ekler (`children` her zaman bu kurallara uyar).
 */
export function FlexPageContent({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className ? `${FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS} ${className}` : FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
      style={{ margin: "0 auto", boxSizing: "border-box", flex: 1, ...style }}
    >
      {children}
    </div>
  );
}

export default function FlexHeader({ icon, greeting, title, subtitle, roleLabel, maxWidth = FLEX_CONTENT_MAX_WIDTH, maxWidthClassName, left, displayNameOverride, connectPersonId }: FlexHeaderProps) {
  const [displayName, setDisplayName] = useState(displayNameOverride ?? nameCache ?? "");
  const { roleLabel: computedRoleLabel } = useCapabilities();
  const effectiveRoleLabel = roleLabel ?? computedRoleLabel ?? "Yönetici";

  useEffect(() => {
    if (displayNameOverride) setDisplayName(displayNameOverride);
  }, [displayNameOverride]);

  useEffect(() => {
    if (displayNameOverride || nameCache) return;
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
    <>
    <ConnectWidget personId={connectPersonId} />
    <header style={{ position: "sticky", top: 0, zIndex: 30, background: "#fff", borderBottom: "1px solid #E2E5EA", boxShadow: "0 2px 6px rgba(15,31,61,.04)" }}>
      <div
        style={{ maxWidth: maxWidthClassName ? undefined : maxWidth, margin: "0 auto", width: maxWidthClassName ? undefined : "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: maxWidthClassName ? "20px 0" : "20px 36px" }}
        className={maxWidthClassName}
      >
        {left ?? (
          <div style={{ display: "flex", alignItems: "center", gap: icon ? 15 : 0 }}>
            {icon && (
              <div style={{ width: 44, height: 44, borderRadius: 13, background: "linear-gradient(135deg,#3A7BD5,#205297)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                {icon}
              </div>
            )}
            <div>
              <h1 style={{ margin: 0, fontSize: 20.5, fontWeight: 630, letterSpacing: "-0.022em", color: "#1E222B" }}>
                {greeting ? `Hoş Geldin${firstName ? `, ${firstName}` : ""} 😊` : title}
              </h1>
              {subtitle && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>{subtitle}</p>}
            </div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
            <NotificationBell />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 18, borderLeft: "1px solid #E2E5EA" }}>
            <div style={{ textAlign: "right" as const, lineHeight: 1.3 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1E222B" }}>{displayName || "…"}</div>
              <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500 }}>{effectiveRoleLabel}</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#FF8D28,#D66500)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(214,101,0,.5)" }}>
              {initials(displayName || "?")}
            </div>
          </div>
        </div>
      </div>
    </header>
    </>
  );
}
