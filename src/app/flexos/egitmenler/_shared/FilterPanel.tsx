"use client";

import { BRANS_COLORS, STATUS_MAP } from "./types";
import { IC, S } from "./constants";
import { FilterDropdown } from "./FilterDropdown";

const subeList = ["Tümü", "Kadıköy", "Pendik", "Ümraniye", "Beşiktaş"];
const bransList = ["Tümü", "Design", "Finance", "Software"];
const durumList: [string, string][] = [["Tümü", "Tümü"], ["Aktif", "aktif"], ["Pasif", "pasif"]];

interface FilterPanelProps {
  pSearch: string; setPSearch: (v: string) => void;
  pSube: string; setPSube: (v: string) => void;
  pBrans: string; setPBrans: (v: string) => void;
  pStatus: string; setPStatus: (v: string) => void;
  openDD: string | null; setOpenDD: (v: string | null) => void;
  anyFilter: boolean;
  onApply: () => void;
  onClear: () => void;
}

/** Eğitmen Havuzu filtre paneli — arama + Şube/Branş/Durum dropdown'ları + Temizle/Filtrele. */
export function FilterPanel({ pSearch, setPSearch, pSube, setPSube, pBrans, setPBrans, pStatus, setPStatus, openDD, setOpenDD, anyFilter, onApply, onClear }: FilterPanelProps) {
  return (
    <div style={{ position: "relative", zIndex: 20, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 2px rgba(15,31,61,.04)", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" as const }}>
        {/* search */}
        <div style={{ flex: 1, minWidth: 230, display: "flex", flexDirection: "column" as const, gap: 7 }}>
          <span style={S.filterLabel}>Ara</span>
          <span style={{ position: "relative" as const, display: "flex" }}>
            <span style={{ position: "absolute" as const, left: 14, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" as const }}>
              <span dangerouslySetInnerHTML={{ __html: IC.search }} />
            </span>
            <input value={pSearch} onChange={(e) => setPSearch(e.target.value)} placeholder="Eğitmen adı ara…" style={S.searchInput} />
          </span>
        </div>

        {/* Şube dropdown */}
        <FilterDropdown label="Şube" value={pSube} open={openDD === "sube"} onToggle={() => setOpenDD(openDD === "sube" ? null : "sube")}
          options={subeList.map((v) => ({ label: v, active: pSube === v, onClick: () => { setPSube(v); setOpenDD(null); } }))}
          icon={IC.pin} />

        {/* Branş dropdown */}
        <FilterDropdown label="Branş" value={pBrans} open={openDD === "brans"} onToggle={() => setOpenDD(openDD === "brans" ? null : "brans")}
          options={bransList.map((v) => ({ label: v, active: pBrans === v, dot: v !== "Tümü" ? BRANS_COLORS[v]?.dot : "#CDD2DA", onClick: () => { setPBrans(v); setOpenDD(null); } }))}
          icon={IC.check} />

        {/* Durum dropdown */}
        <FilterDropdown label="Durum" value={durumList.find(([, val]) => val === pStatus)?.[0] || "Tümü"} open={openDD === "durum"} onToggle={() => setOpenDD(openDD === "durum" ? null : "durum")}
          options={durumList.map(([label, val]) => ({ label, active: pStatus === val, dot: val === "Tümü" ? "#CDD2DA" : STATUS_MAP[val]?.dot, onClick: () => { setPStatus(val); setOpenDD(null); } }))}
          icon={IC.statusIcon} />

        <div style={{ flex: 1, minWidth: 6 }} />

        {anyFilter && (
          <button className="sg-clear-btn" onClick={onClear} style={S.clearBtn}>
            <span dangerouslySetInnerHTML={{ __html: IC.xSmall }} /> Temizle
          </button>
        )}
        <button className="sg-filter-btn" onClick={onApply} style={S.filterBtn}>
          <span dangerouslySetInnerHTML={{ __html: IC.filter }} /> Filtrele
        </button>
      </div>
    </div>
  );
}
