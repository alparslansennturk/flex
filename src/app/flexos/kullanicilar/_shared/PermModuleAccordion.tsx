"use client";

import React, { useState } from "react";
import { PERM_MODULES, PERM_MODULE_GROUPS, type PermModuleDef } from "./permModules";

/** Yetki modüllerini `PERM_MODULE_GROUPS` başlıkları altında akordiyon olarak listeler — satır görünümü (özel rozet vb.) çağıran sayfaya bırakılır. */
export function PermModuleAccordion({
  isPermActive,
  renderItem,
}: {
  isPermActive: (key: string) => boolean;
  renderItem: (m: PermModuleDef) => React.ReactNode;
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(PERM_MODULE_GROUPS[0]?.key ?? null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {PERM_MODULE_GROUPS.map((g) => {
        const modules = PERM_MODULES.filter((m) => m.group === g.key);
        if (modules.length === 0) return null;
        const activeCount = modules.filter((m) => isPermActive(m.key)).length;
        const isOpen = openGroup === g.key;
        return (
          <div key={g.key} style={{ border: "1px solid #E2E5EA", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
            <button
              type="button"
              onClick={() => setOpenGroup(isOpen ? null : g.key)}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 16px",
                border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}
            >
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#1E222B" }}>{g.label}</span>
              <span style={{
                fontSize: 10.5, fontWeight: 700, color: activeCount > 0 ? "#7C3AED" : "#8E95A3",
                background: activeCount > 0 ? "#EDE9FE" : "#F2F4F7", padding: "3px 9px", borderRadius: 999,
              }}>{activeCount}/{modules.length}</span>
              <span style={{ display: "inline-flex", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </span>
            </button>
            {isOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 12px 12px" }}>
                {modules.map((m) => renderItem(m))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
