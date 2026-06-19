"use client";

/**
 * FlexOS · Paylaşımlı sol menü (sidebar).
 * Tek kaynak — tüm FlexOS sayfaları bunu kullanır. Alt menü destekli:
 * "Eğitim Yönetimi" ana başlık → "Eğitimler" + "Eğitim Ayarları" alt başlıkları.
 *
 * NOT: Görsel sonra Claude Design'da elden geçirilecek; şimdilik işlevsel/sade.
 */

import React, { CSSProperties, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export type FlexNavKey =
  | "ana"
  | "egitimler"
  | "ayarlar"
  | "satis-yap"
  | "satis-liste"
  | "siniflar"
  | "yoklamalar"
  | "sertifikasyon";

export default function FlexSidebar({ active }: { active?: FlexNavKey }) {
  const router = useRouter();
  const soon = () => toast.info("Bu özellik yakında.");
  const go = (to: string | null) => () => (to ? router.push(to) : soon());

  const eduActive = active === "egitimler" || active === "ayarlar";
  const [eduOpen, setEduOpen] = useState(eduActive); // aktif alt sayfadaysak başta açık

  const salesActive = active === "satis-yap" || active === "satis-liste";
  const [salesOpen, setSalesOpen] = useState(salesActive);

  return (
    <aside style={S.sidebar}>
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
        <Item icon={IC.home} label="Ana Sayfa" onClick={go(null)} />

        {/* Eğitim Yönetimi — akordiyon ana başlık (framer-motion geçişli) */}
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
                <SubItem label="Eğitimler" active={active === "egitimler"} onClick={go("/flexos/egitim-yonetimi")} />
                <SubItem label="Eğitim Ayarları" active={active === "ayarlar"} onClick={go("/flexos/egitim-yonetimi/ayarlar")} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Satışlar — akordiyon ana başlık */}
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
                <SubItem label="Satış Listesi" active={active === "satis-liste"} onClick={go(null)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Item icon={IC.users} label="Sınıflar" onClick={go(null)} />
        <Item icon={IC.calendar} label="Yoklamalar" onClick={go(null)} />
        <Item icon={IC.award} label="Sertifikasyon" onClick={go(null)} />
      </nav>
    </aside>
  );
}

function Item({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <a className="fs-navlink" style={S.navItem} onClick={onClick}>
      <span style={{ display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: icon }} />
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
  sidebar: { width: 252, flex: "0 0 252px", height: "100%", background: "linear-gradient(180deg,#102a4e 0%,#0b2244 60%,#091d3a 100%)", display: "flex", flexDirection: "column", padding: "22px 16px 18px" },
  logoBox: { width: 38, height: 38, borderRadius: 11, background: "#0a1c38", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 3, padding: 8, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" },
  navItem: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 11, color: "#9fb2cd", textDecoration: "none", fontSize: 14.5, fontWeight: 500, cursor: "pointer", transition: "all .15s" },
  parentActive: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 11, color: "#fff", textDecoration: "none", fontSize: 14.5, fontWeight: 700, cursor: "pointer" },
  subItem: { position: "relative", display: "flex", alignItems: "center", gap: 11, padding: "9px 13px", borderRadius: 10, color: "#9fb2cd", textDecoration: "none", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all .15s" },
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
  chevDown: sv('<path d="m6 9 6 6 6-6"/>', 'width="15" height="15" stroke-width="2.3"'),
  chevRight: sv('<path d="m9 18 6-6-6-6"/>', 'width="15" height="15" stroke-width="2.3"'),
};

const css = `
.fs-navlink:hover{background:rgba(255,255,255,.06);color:#fff!important}
`;
