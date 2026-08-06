"use client";

import { IC, S } from "./constants";

/* ── Filter Dropdown Component ── */
export function FilterDropdown({ label, value, open, onToggle, options, icon }: {
  label: string; value: string; open: boolean; onToggle: () => void; icon: string;
  options: { label: string; active: boolean; dot?: string; onClick: () => void }[];
}) {
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
      <button type="button" onClick={onToggle} className="sg-dd-btn" style={S.ddBtn}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          <span dangerouslySetInnerHTML={{ __html: icon }} />{value}
        </span>
        <span dangerouslySetInnerHTML={{ __html: IC.chevDownSm }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: 175, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, boxShadow: "0 18px 40px -12px rgba(15,31,61,.22)", padding: 8, zIndex: 60, animation: "sgDdIn .15s cubic-bezier(.2,.8,.3,1)" }}>
          {options.map((o) => (
            <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} key={o.label} onClick={o.onClick} className="sg-dd-opt" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: o.active ? 700 : 500, color: o.active ? "#205297" : "#414B59", background: o.active ? "#E2EAF3" : "transparent" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                {o.dot && <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "0 0 auto", background: o.dot }} />}
                {o.label}
              </span>
              {o.active && <span dangerouslySetInnerHTML={{ __html: IC.checkBlue }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
