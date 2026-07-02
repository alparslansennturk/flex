"use client";

/**
 * FlexOS · Paylaşımlı sol menü (sidebar).
 * Tek kaynak — tüm FlexOS sayfaları bunu kullanır. Alt menü destekli:
 * "Eğitim Yönetimi" ana başlık → "Eğitimler" + "Eğitim Ayarları" alt başlıkları.
 *
 * NOT: Görsel sonra Claude Design'da elden geçirilecek; şimdilik işlevsel/sade.
 */

import React, { CSSProperties, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/app/lib/firebase";
import { getViewMode, setViewMode, type ViewMode } from "./viewMode";
import ViewPinModal from "./ViewPinModal";

// Sayfa değişince FlexSidebar yeniden mount olur (paylaşımlı layout yok) — capability
// listesini modül-seviyesinde önbelleğe alarak her navigasyonda "menü boşal-dolsun"
// yanıp sönmesini (flaş) önler. İlk yüklemede bir kez fetch edilir, sonrasında cache'ten okunur.
let capsCache: Set<string> | null = null;

export type FlexNavKey =
  | "ana"
  | "egitimler"
  | "ayarlar"
  | "satis-yap"
  | "satis-liste"
  | "paket-yonetimi"
  | "kampanya-yonetimi"
  | "ogrenci-havuzu"
  | "siniflar"
  | "egitmenler"
  | "kullanicilar"
  | "aktivite-merkezi"   // eskiyle uyum (aktiviteler ile aynı davranır)
  | "aktiviteler"
  | "randevu-takvimi"
  | "yoklamalar"
  | "yoklama-al"
  | "yoklama-detay"
  | "yoklama-raporu"
  | "sertifikasyon";

export default function FlexSidebar({ active }: { active?: FlexNavKey }) {
  const router = useRouter();
  const soon = () => toast.info("Bu özellik yakında.");
  const go = (to: string | null) => () => (to ? router.push(to) : soon());

  const eduActive = active === "egitimler" || active === "ayarlar";
  const [eduOpen, setEduOpen] = useState(eduActive); // aktif alt sayfadaysak başta açık

  const salesActive = active === "satis-yap" || active === "satis-liste" || active === "paket-yonetimi" || active === "kampanya-yonetimi";
  const [salesOpen, setSalesOpen] = useState(salesActive);

  const aktiviteActive = active === "aktivite-merkezi" || active === "aktiviteler" || active === "randevu-takvimi";
  const [aktiviteOpen, setAktiviteOpen] = useState(aktiviteActive);

  const yoklamaActive = active === "yoklamalar" || active === "yoklama-al" || active === "yoklama-detay" || active === "yoklama-raporu";
  const [yoklamaOpen, setYoklamaOpen] = useState(yoklamaActive);

  // ── Menü kuralı: öğe görünür ⟺ can(actor,yetki) VE (core-grubu VEYA view=Full) ──
  // Capability listesi yüklenene kadar boş küme = kapılı öğeler geçici gizli (kozmetik flaş yok).
  const [uid, setUid] = useState<string | null>(null);
  const [caps, setCaps] = useState<Set<string>>(() => capsCache ?? new Set());
  const [mode, setMode] = useState<ViewMode>("full");
  const [pinOpen, setPinOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user || cancelled) return;
      setUid(user.uid);
      setMode(getViewMode(user.uid));
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/flexos/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (res.ok && !cancelled) {
          const json = await res.json();
          const next = new Set<string>(json.capabilities ?? []);
          capsCache = next;
          setCaps(next);
        }
      } catch {
        // sessiz — menüde kapılı öğeler gizli kalır, sayfa fonksiyonelliğini etkilemez
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const canToggleView = caps.has("view.toggle");

  // Sunucudaki gerçek yetkiyi de (admin↔eğitmen) mod'a göre değiştirir — sadece
  // görünüm anahtarı sahibinde etkili (bkz. auth-actor.ts VIEW_TOGGLE_OWNER_EMAIL).
  // Kaydettikten sonra ilgili modun kendi ana sayfasına GİDER (reload değil) —
  // aksi halde admin-only bir sayfadayken (ör. Kullanıcılar) eğitmene düşünce o
  // sayfa 403 verip çirkin bir hata gösteriyordu. Yeni URL'e gitmek ayrıca her
  // önceki cache sorununu da kökten bypass eder (hiç istenmemiş taze bir istek).
  const persistModeAndReload = async (next: "core" | "full") => {
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : "";
      await fetch("/api/flexos/view-access/mode", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
    } catch {
      // sessiz — en kötü ihtimalle bir sonraki istekte kendini düzeltir
    } finally {
      window.location.href = next === "core" ? "/flexos/egitmen-anasayfa" : "/flexos/anasayfa";
    }
  };

  // Gizli kısayol — Ctrl/Cmd+Shift+K. Owner değilse tamamen no-op (sıfır iz).
  // NOT: Ctrl/Cmd+Shift+M, Chrome'un kendi profil değiştirme kısayoluyla çakışıyordu
  // (tarayıcı seviyesinde yakalanıyor, preventDefault() işe yaramıyor) — 2026-07-02'de
  // Ctrl/Cmd+Shift+K'ye değiştirildi (Chrome'da boş; Firefox'ta konsol kısayolu ama
  // kullanılan tarayıcı Chrome).
  useEffect(() => {
    if (!canToggleView) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "k")) return;
      e.preventDefault();
      if (mode === "full") {
        if (uid) setViewMode(uid, "core");
        toast.info("Görünüm: Eğitmen");
        void persistModeAndReload("core");
      } else {
        setPinOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canToggleView, mode, uid]);

  const onPinVerified = () => {
    if (uid) setViewMode(uid, "full");
    setPinOpen(false);
    toast.success("Görünüm: Full");
    void persistModeAndReload("full");
  };

  /** cap yoksa hiç görünmez; core-grup her zaman, enterprise-grup sadece Full'de. */
  const canSee = (cap: string, core: boolean) => caps.has(cap) && (core || mode === "full");

  return (
    <aside className="fs-sidebar" style={S.sidebar}>
      <style>{css}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 8px 26px" }}>
        <div style={S.logoBox}>
          <span style={{ borderRadius: 3, background: "#5b8cff" }} />
          <span style={{ borderRadius: 3, background: "#f97316" }} />
          <span style={{ borderRadius: 3, background: "#22c55e" }} />
          <span style={{ borderRadius: 3, background: "#38bdf8" }} />
        </div>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-.5px" }}>flex</span>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {/* role.manage = admin-benzeri (satış/operasyon/admin) → admin ana sayfa;
            yoksa (gerçek eğitmen veya owner'ın Core görünümü) → eğitmen ana sayfa. */}
        <Item icon={IC.home} label="Ana Sayfa" active={active === "ana"} onClick={go(caps.has("role.manage") ? "/flexos/anasayfa" : "/flexos/egitmen-anasayfa")} />

        {/* Eğitim Yönetimi — akordiyon ana başlık (framer-motion geçişli).
            "Eğitimler" (katalog CRUD) enterprise: sadece Full. "Eğitim Ayarları" (Branş
            Havuzu+Tatil+Sertifika+Sözleşme) her iki modda da açık — katalog kurulumu
            (en az 1 branş/eğitim) Core'daki eğitmenin grup açabilmesi için şart, admin
            Core'dan çıkmadan halledebilsin diye. */}
        {(canSee("education.create", false) || canSee("branch.create", true)) && (
          <>
            <a className="fs-navlink" style={eduActive ? S.parentActive : S.navItem} onClick={() => setEduOpen((o) => !o)}>
              <span style={{ display: "inline-flex", color: eduActive ? "#fb923c" : "currentColor" }} dangerouslySetInnerHTML={{ __html: IC.book }} />
              <span style={{ flex: 1 }}>Eğitim Yönetimi</span>
              <motion.span
                style={{ display: "inline-flex", opacity: 0.7 }}
                animate={{ rotate: eduOpen ? 0 : -90 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                dangerouslySetInnerHTML={{ __html: IC.chevDown }}
              />
            </a>
            <AnimatePresence initial={false}>
              {eduOpen && (
                <motion.div
                  key="edu-sub"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "2px 0 2px 14px" }}>
                    {canSee("education.create", false) && <SubItem label="Eğitimler" active={active === "egitimler"} onClick={go("/flexos/egitim-yonetimi")} />}
                    {canSee("branch.create", true) && <SubItem label="Eğitim Ayarları" active={active === "ayarlar"} onClick={go("/flexos/egitim-yonetimi/ayarlar")} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Satışlar — akordiyon ana başlık. Enterprise: sadece Full. */}
        {canSee("sale.create", false) && (
          <>
            <a className="fs-navlink" style={salesActive ? S.parentActive : S.navItem} onClick={() => setSalesOpen((o) => !o)}>
              <span style={{ display: "inline-flex", color: salesActive ? "#fb923c" : "currentColor" }} dangerouslySetInnerHTML={{ __html: IC.tag }} />
              <span style={{ flex: 1 }}>Satışlar</span>
              <motion.span
                style={{ display: "inline-flex", opacity: 0.7 }}
                animate={{ rotate: salesOpen ? 0 : -90 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                dangerouslySetInnerHTML={{ __html: IC.chevDown }}
              />
            </a>
            <AnimatePresence initial={false}>
              {salesOpen && (
                <motion.div
                  key="sales-sub"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "2px 0 2px 14px" }}>
                    <SubItem label="Satış Yap" active={active === "satis-yap"} onClick={go("/flexos/satislar/satis-yap")} />
                    <SubItem label="Satış Listesi" active={active === "satis-liste"} onClick={go("/flexos/satislar/satis-liste")} />
                    <SubItem label="Paket Yönetimi" active={active === "paket-yonetimi"} onClick={go("/flexos/satislar/paket-yonetimi")} />
                    <SubItem label="Kampanya Yönetimi" active={active === "kampanya-yonetimi"} onClick={go("/flexos/satislar/kampanya-yonetimi")} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Öğrenci Havuzu = admin/satış/operasyon işi — eğitmen (Full'da da Core sistem
            modunda da) burayı hiç görmez, kendi öğrencilerini Sınıflar'daki "Öğrencilerim"
            bölümünden ekler/görür. `sale.read` eğitmen paketinde (hiçbir modda) yok. */}
        {canSee("sale.read", false) && <Item icon={IC.users} label="Öğrenciler" active={active === "ogrenci-havuzu"} onClick={go("/flexos/ogrenciler/havuz")} />}
        {/* Core: eğitmen günlük işi — mode'dan bağımsız her zaman görünür. */}
        {canSee("group.read", true) && <Item icon={IC.graduation} label="Sınıflar" active={active === "siniflar"} onClick={go("/flexos/siniflar")} />}

        {/* Enterprise: sadece Full. */}
        {canSee("trainer.read", false) && <Item icon={IC.trainer} label="Eğitmenler" active={active === "egitmenler"} onClick={go("/flexos/egitmenler")} />}
        {canSee("role.manage", false) && <Item icon={IC.shield} label="Kullanıcılar" active={active === "kullanicilar"} onClick={go("/flexos/kullanicilar")} />}

        {/* Aktivite Merkezi — akordiyon. Enterprise: sadece Full. */}
        {canSee("case.read", false) && (
          <>
            <a className="fs-navlink" style={aktiviteActive ? S.parentActive : S.navItem} onClick={() => setAktiviteOpen((o) => !o)}>
              <span style={{ display: "inline-flex", color: aktiviteActive ? "#fb923c" : "currentColor" }} dangerouslySetInnerHTML={{ __html: IC.activity }} />
              <span style={{ flex: 1 }}>Aktivite Merkezi</span>
              <motion.span
                style={{ display: "inline-flex", opacity: 0.7 }}
                animate={{ rotate: aktiviteOpen ? 0 : -90 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                dangerouslySetInnerHTML={{ __html: IC.chevDown }}
              />
            </a>
            <AnimatePresence initial={false}>
              {aktiviteOpen && (
                <motion.div
                  key="aktivite-sub"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "2px 0 2px 14px" }}>
                    <SubItem label="Aktiviteler" active={active === "aktiviteler" || active === "aktivite-merkezi"} onClick={go("/flexos/aktivite-merkezi")} />
                    <SubItem label="Randevu Takvimi" active={active === "randevu-takvimi"} onClick={go("/flexos/randevu-takvimi")} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Yoklamalar — akordiyon: Yoklama Al + Yoklama Detay (attendance.write, eğitmen
            dahil Core'da da her zaman) + Yoklama Raporu (attendance.report.read, SADECE
            Op/Finans/Admin — eğitmende BİLEREK YOK, 2026-07-02 kararı). Al/Detay YENİ
            SEKMEDE açılır (ders başladıktan sonra yanlışlıkla başka sayfaya geçip yarım
            bırakmasın); Rapor normal navigasyon (yönetim sayfası, FlexSidebar'lı). */}
        {(canSee("attendance.write", true) || canSee("attendance.report.read", false)) && (
          <>
            <a className="fs-navlink" style={yoklamaActive ? S.parentActive : S.navItem} onClick={() => setYoklamaOpen((o) => !o)}>
              <span style={{ display: "inline-flex", color: yoklamaActive ? "#fb923c" : "currentColor" }} dangerouslySetInnerHTML={{ __html: IC.calendar }} />
              <span style={{ flex: 1 }}>Yoklamalar</span>
              <motion.span
                style={{ display: "inline-flex", opacity: 0.7 }}
                animate={{ rotate: yoklamaOpen ? 0 : -90 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                dangerouslySetInnerHTML={{ __html: IC.chevDown }}
              />
            </a>
            <AnimatePresence initial={false}>
              {yoklamaOpen && (
                <motion.div
                  key="yoklama-sub"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "2px 0 2px 14px" }}>
                    {canSee("attendance.write", true) && <SubItem label="Yoklama Al" active={active === "yoklama-al"} onClick={() => window.open("/flexos/yoklama/al", "_blank")} />}
                    {canSee("attendance.write", true) && <SubItem label="Yoklama Detay" active={active === "yoklama-detay"} onClick={() => window.open("/flexos/yoklama/detay", "_blank")} />}
                    {canSee("attendance.report.read", false) && <SubItem label="Yoklama Raporu" active={active === "yoklama-raporu"} onClick={go("/flexos/yoklama/rapor")} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
        {canSee("grade.finalize", true) && <Item icon={IC.award} label="Sertifikasyon" onClick={go(null)} />}
      </nav>

      <ViewPinModal open={pinOpen} onClose={() => setPinOpen(false)} onVerified={onPinVerified} />
    </aside>
  );
}

function Item({ icon, label, onClick, active }: { icon: string; label: string; onClick: () => void; active?: boolean }) {
  return (
    <a className="fs-navlink" style={active ? S.itemActive : S.navItem} onClick={onClick}>
      <span style={{ display: "inline-flex", color: active ? "#fb923c" : "currentColor" }} dangerouslySetInnerHTML={{ __html: icon }} />
      <span style={{ flex: 1 }}>{label}</span>
    </a>
  );
}

function SubItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <a className="fs-navlink" style={active ? S.subActive : S.subItem} onClick={onClick}>
      {active && <span style={S.subBar} />}
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: active ? "#fb923c" : "#5b7298", flex: "0 0 auto" }} />
      <span style={{ flex: 1 }}>{label}</span>
    </a>
  );
}

const S: Record<string, CSSProperties> = {
  sidebar: { height: "100%", background: "linear-gradient(180deg,#102a4e 0%,#0b2244 60%,#091d3a 100%)", display: "flex", flexDirection: "column", padding: "22px 16px 18px" },
  logoBox: { width: 38, height: 38, borderRadius: 11, background: "#0a1c38", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 3, padding: 8, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" },
  navItem: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 11, color: "#c3d1e6", textDecoration: "none", fontSize: 14.5, fontWeight: 500, cursor: "pointer", transition: "all .15s" },
  parentActive: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 11, color: "#fff", textDecoration: "none", fontSize: 14.5, fontWeight: 700, cursor: "pointer" },
  itemActive: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 11, color: "#fff", textDecoration: "none", fontSize: 14.5, fontWeight: 700, cursor: "pointer", background: "linear-gradient(90deg,rgba(249,115,22,.2),rgba(249,115,22,.03))", boxShadow: "inset 0 0 0 1px rgba(249,115,22,.22)" },
  subItem: { position: "relative", display: "flex", alignItems: "center", gap: 11, padding: "9px 13px", borderRadius: 10, color: "#c3d1e6", textDecoration: "none", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all .15s" },
  subActive: { position: "relative", display: "flex", alignItems: "center", gap: 11, padding: "9px 13px", borderRadius: 10, color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "linear-gradient(90deg,rgba(249,115,22,.22),rgba(249,115,22,.05))", boxShadow: "inset 0 0 0 1px rgba(249,115,22,.28)" },
  subBar: { position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: "0 3px 3px 0", background: "#fb923c" },
};

const sv = (inner: string, attrs = 'width="19" height="19"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  home: sv('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>'),
  book: sv('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'),
  tag: sv('<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>'),
  users: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  calendar: sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>'),
  award: sv('<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>'),
  graduation: sv('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>'),
  trainer: sv('<path d="M14 22v-4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4"/><path d="M18 14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2"/><circle cx="9" cy="9" r="3"/><path d="M17 21v-1a2 2 0 0 0-2-2"/>'),
  shield: sv('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'),
  chevDown: sv('<path d="m6 9 6 6 6-6"/>', 'width="15" height="15" stroke-width="2.3"'),
  chevRight: sv('<path d="m9 18 6-6-6-6"/>', 'width="15" height="15" stroke-width="2.3"'),
  activity: sv('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
  barChart: sv('<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>'),
};

const css = `
/* Responsive genişlik: küçük ekranda dar, büyükte kademeli geniş (canlının 320 sıçraması yok) */
.fs-sidebar{width:248px;flex:0 0 248px}
@media(min-width:1536px){.fs-sidebar{width:272px;flex-basis:272px}}
@media(min-width:2560px){.fs-sidebar{width:300px;flex-basis:300px}}
.fs-navlink:hover{background:rgba(255,255,255,.06);color:#fff!important}
`;
