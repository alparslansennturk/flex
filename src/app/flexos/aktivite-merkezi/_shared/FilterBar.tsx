"use client";

import { DurumKey, DURUMLAR, KANALS, KanalKey, TIP_CATS } from "./types";
import { Dd, DdItem } from "./ui";

interface FilterBarProps {
  fKanal: string; setFKanal: (v: string) => void;
  fTip: string; setFTip: (v: string) => void;
  fDurum: string; setFDurum: (v: string) => void;
  fSorumlu: string; setFSorumlu: (v: string) => void;
  sorumluList: string[];
  fSube: string; setFSube: (v: string) => void;
  subeList: string[];
  openDd: string | null; setOpenDd: (v: string | null) => void;
  anyFilter: boolean;
  onClear: () => void;
  onPageReset: () => void;
  onAddClick: () => void;
}

/** Aktivite Merkezi filtre şeridi — Kanal/Tip/Durum/Sorumlu/Şube dropdown'ları + Temizle + Aktivite Ekle. */
export function FilterBar({
  fKanal, setFKanal, fTip, setFTip, fDurum, setFDurum, fSorumlu, setFSorumlu, sorumluList,
  fSube, setFSube, subeList,
  openDd, setOpenDd, anyFilter, onClear, onPageReset, onAddClick,
}: FilterBarProps) {
  return (
    <div style={{ position: "relative", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

        {/* Kanal */}
        <Dd
          label={fKanal === "Tümü" ? "Tüm Kanallar" : KANALS[fKanal as KanalKey]?.label}
          open={openDd === "kanal"}
          onToggle={() => setOpenDd(openDd === "kanal" ? null : "kanal")}
        >
          {(["Tümü", ...Object.keys(KANALS)] as string[]).map(k => (
            <DdItem key={k}
              label={k === "Tümü" ? "Tüm Kanallar" : KANALS[k as KanalKey].label}
              active={fKanal === k}
              onClick={() => { setFKanal(k); setOpenDd(null); onPageReset(); }}
            />
          ))}
        </Dd>

        {/* Tip kategorisi */}
        <Dd
          label={TIP_CATS.find(x => x[0] === fTip)?.[1] ?? "Tüm Tipler"}
          open={openDd === "tip"}
          onToggle={() => setOpenDd(openDd === "tip" ? null : "tip")}
        >
          {TIP_CATS.map(([k, l]) => (
            <DdItem key={k} label={l} active={fTip === k} onClick={() => { setFTip(k); setOpenDd(null); onPageReset(); }} />
          ))}
        </Dd>

        {/* Durum */}
        <Dd
          label={fDurum === "Tümü" ? "Tüm Durumlar" : DURUMLAR[fDurum as DurumKey]?.label}
          open={openDd === "durum"}
          onToggle={() => setOpenDd(openDd === "durum" ? null : "durum")}
        >
          {(["Tümü", ...Object.keys(DURUMLAR)] as string[]).map(k => {
            const d = DURUMLAR[k as DurumKey];
            return (
              <DdItem key={k} active={fDurum === k} onClick={() => { setFDurum(k); setOpenDd(null); onPageReset(); }}
                label={<span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  {d && <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.dot, flex: "0 0 auto" }} />}
                  {k === "Tümü" ? "Tüm Durumlar" : d?.label}
                </span>}
              />
            );
          })}
        </Dd>

        {/* Sorumlu */}
        <Dd
          label={fSorumlu === "Tümü" ? "Tüm Sorumlular" : fSorumlu}
          open={openDd === "sorumlu"}
          onToggle={() => setOpenDd(openDd === "sorumlu" ? null : "sorumlu")}
        >
          {["Tümü", ...sorumluList].map(v => (
            <DdItem key={v} label={v === "Tümü" ? "Tüm Sorumlular" : v} active={fSorumlu === v}
              onClick={() => { setFSorumlu(v); setOpenDd(null); onPageReset(); }} />
          ))}
        </Dd>

        {/* Şube */}
        <Dd
          label={fSube === "Tümü" ? "Tüm Şubeler" : fSube}
          open={openDd === "sube"}
          onToggle={() => setOpenDd(openDd === "sube" ? null : "sube")}
        >
          {["Tümü", ...subeList].map(v => (
            <DdItem key={v} label={v === "Tümü" ? "Tüm Şubeler" : v} active={fSube === v}
              onClick={() => { setFSube(v); setOpenDd(null); onPageReset(); }} />
          ))}
        </Dd>

        {anyFilter && (
          <button type="button" className="am-clear-btn" onClick={onClear}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 11, border: "1px dashed #F3B0B0", background: "#fff", color: "#D93636", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            Temizle
          </button>
        )}
      </div>

      {/* Aktivite Ekle */}
      <button type="button" className="am-orange-btn" onClick={onAddClick}
        style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        Aktivite Ekle
      </button>
    </div>
  );
}
