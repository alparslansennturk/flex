"use client";

import { StatusKey, ST, BRANS, BRANS_FALLBACK } from "./types";
import { S, IC } from "./constants";

interface FilterPanelProps {
  subeList: string[];
  bransList: string[];
  egitimList: string[];
  openDropdown: null | "sube" | "brans" | "egitim";
  toggleDropdown: (n: "sube" | "brans" | "egitim") => void;
  pStatus: StatusKey[];
  togglePStatus: (k: StatusKey) => void;
  pSube: string;
  setPSube: (v: string) => void;
  pBrans: string;
  setPBrans: (v: string) => void;
  pEgitim: string;
  setPEgitim: (v: string) => void;
  query: string;
  setQuery: (v: string) => void;
  setOpenDropdown: (v: null) => void;
  anyFilter: boolean;
  applyFilters: () => void;
  clearFilters: () => void;
}

/** Öğrenci Havuzu filtre paneli — Durum çipleri + Şube/Branş/Eğitim dropdown'ları + isim arama. */
export function FilterPanel({
  subeList, bransList, egitimList, openDropdown, toggleDropdown,
  pStatus, togglePStatus, pSube, setPSube, pBrans, setPBrans, pEgitim, setPEgitim,
  query, setQuery, setOpenDropdown, anyFilter, applyFilters, clearFilters,
}: FilterPanelProps) {
  return (
    <div style={S.filterPanel}>
      {/* DURUM */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <span style={S.sectionLabel}>Durum</span>
        <div style={{ flex: 1, height: 1, background: "#EEF0F3" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 18 }}>
        {(Object.keys(ST) as StatusKey[]).map((k) => {
          const o = ST[k];
          const checked = pStatus.includes(k);
          return (
            <div key={k} className="oh-chip" onClick={() => togglePStatus(k)} title={o.hint}
              style={{ ...S.statusChip, border: checked ? "1.5px solid #2867bd" : "1.5px solid #E2E5EA", background: checked ? "#EFF3FA" : "#fff" }}>
              <span style={{ ...S.statusCheck, border: checked ? "1.5px solid #2867bd" : "1.5px solid #CDD2DA", background: checked ? "#2867bd" : "#fff" }}>
                {checked && <span dangerouslySetInnerHTML={{ __html: IC.checkWhite }} />}
              </span>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: o.dot, flex: "0 0 auto" }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#414B59", whiteSpace: "nowrap" }}>{o.label}</span>
            </div>
          );
        })}
      </div>

      {/* Şube / Branş row */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        {/* ŞUBE */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7, flexShrink: 0 }}>
          <span style={S.sectionLabel}>Şube</span>
          <button className="oh-select" style={{ ...S.selectBtn, minWidth: 190 }} onClick={() => toggleDropdown("sube")}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
              <span dangerouslySetInnerHTML={{ __html: IC.pin }} />{pSube}
            </span>
            <span dangerouslySetInnerHTML={{ __html: IC.chevDown }} />
          </button>
          {openDropdown === "sube" && (
            <div style={{ ...S.dropdown, width: 200 }}>
              {subeList.map((v) => (
                <div key={v} className="oh-ddrow" style={pSube === v ? S.ddActive : S.ddBase} onClick={() => { setPSube(v); setOpenDropdown(null); }}>
                  <span>{v}</span>
                  {pSube === v && <span dangerouslySetInnerHTML={{ __html: IC.checkBlue }} />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BRANŞ */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7, flexShrink: 0 }}>
          <span style={S.sectionLabel}>Branş</span>
          <button className="oh-select" style={{ ...S.selectBtn, minWidth: 180 }} onClick={() => toggleDropdown("brans")}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
              <span dangerouslySetInnerHTML={{ __html: IC.checkSmall }} />{pBrans}
            </span>
            <span dangerouslySetInnerHTML={{ __html: IC.chevDown }} />
          </button>
          {openDropdown === "brans" && (
            <div style={{ ...S.dropdown, width: 200 }}>
              {bransList.map((v) => (
                <div key={v} className="oh-ddrow" style={pBrans === v ? S.ddActive : S.ddBase} onClick={() => { setPBrans(v); setOpenDropdown(null); }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "0 0 auto", background: v === "Tümü" ? "#CDD2DA" : (BRANS[v]?.dot ?? BRANS_FALLBACK.dot) }} />
                    {v}
                  </span>
                  {pBrans === v && <span dangerouslySetInnerHTML={{ __html: IC.checkBlue }} />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* EĞİTİM */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7, flexShrink: 0 }}>
          <span style={S.sectionLabel}>Eğitim</span>
          <button className="oh-select" style={{ ...S.selectBtn, minWidth: 200 }} onClick={() => toggleDropdown("egitim")}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 9, overflow: "hidden", maxWidth: 160, whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              <span dangerouslySetInnerHTML={{ __html: IC.checkSmall }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pEgitim}</span>
            </span>
            <span dangerouslySetInnerHTML={{ __html: IC.chevDown }} />
          </button>
          {openDropdown === "egitim" && (
            <div style={{ ...S.dropdown, width: 240 }}>
              {egitimList.map((v) => (
                <div key={v} className="oh-ddrow" style={pEgitim === v ? S.ddActive : S.ddBase} onClick={() => { setPEgitim(v); setOpenDropdown(null); }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{v}</span>
                  {pEgitim === v && <span dangerouslySetInnerHTML={{ __html: IC.checkBlue }} />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* İSİM ARAMA — 2026-07-17 kullanıcı isteği: Eğitim'den hemen sonra (Filtrele
            butonuna YAKIN DURMASIN — önceki turda 48px marginRight ile Filtrele'ye
            yaklaştırılmıştı, kullanıcı geri aldı). Diğer filtreler gibi `flexShrink:0`
            — Temizle butonu görününce sıkışması gereken SADECE aşağıdaki spacer. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7, flexShrink: 0 }}>
          <span style={S.sectionLabel}>İsim ara</span>
          <div style={{ position: "relative", width: 220 }}>
            <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#8E95A3", pointerEvents: "none", display: "flex" }}>
              <span dangerouslySetInnerHTML={{ __html: IC.search }} />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Öğrenci adı…"
              style={{ ...S.selectBtn, width: "100%", paddingLeft: 36, fontWeight: 500 }}
            />
          </div>
        </div>

        {/* 2026-07-17 GERÇEK BUG fix: Temizle görününce Filtrele aşağı satıra kayıyordu
            (satır `flexWrap:wrap`, hiçbir öğe küçülmüyordu, taşan son öğe alt satıra
            düşüyordu). Tek esnek öğe bu spacer — Temizle'nin kapladığı genişliği
            0'a kadar küçülerek karşılar, diğer hiçbir filtre/buton kaymaz/küçülmez. */}
        <div style={{ flex: 1, minWidth: 0 }} />

        {anyFilter && (
          <button className="oh-clear" style={{ ...S.clearBtn, flexShrink: 0 }} onClick={clearFilters}>
            <span dangerouslySetInnerHTML={{ __html: IC.x }} />
            Temizle
          </button>
        )}

        <button className="oh-filter" style={{ ...S.filterBtn, flexShrink: 0 }} onClick={applyFilters}>
          <span dangerouslySetInnerHTML={{ __html: IC.funnel }} />
          Filtrele
        </button>
      </div>
    </div>
  );
}
