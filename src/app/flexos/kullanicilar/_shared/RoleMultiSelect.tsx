"use client";

/**
 * Rol seçimi — dropdown + checkbox listesi. Yan yana chip butonları rol sayısı arttıkça
 * (Kullanıcı Ayarları'ndan kurum-özel rol eklendikçe) sığmaz hale geliyordu (2026-07-08) —
 * bunun yerine tek bir dropdown + altında seçili rolleri gösteren kaldırılabilir etiketler.
 */

import React, { useEffect, useRef, useState } from "react";

export interface RoleOption {
  id: string;
  label: string;
  color?: string;
  description?: string;
}

export function RoleMultiSelect({ options, selected, onToggle }: {
  options: RoleOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%",
        padding: "11px 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff",
        cursor: "pointer", fontFamily: "inherit", boxSizing: "border-box",
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: selected.length === 0 ? "#94a3b8" : "#1E222B" }}>
          {selected.length === 0 ? "Rol seçin" : `${selected.length} rol seçili`}
        </span>
        <span style={{ display: "inline-flex", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 30,
          background: "#fff", border: "1px solid #E2E5EA", borderRadius: 12,
          boxShadow: "0 8px 24px -4px rgba(15,31,61,.14)", padding: 6, maxHeight: 280, overflowY: "auto",
        }}>
          {options.length === 0 && (
            <div style={{ padding: "12px 10px", fontSize: 13, color: "#94a3b8", textAlign: "center" }}>Rol yok</div>
          )}
          {options.map((o) => {
            const sel = selected.includes(o.id);
            const color = o.color || "#475569";
            return (
              <button key={o.id} type="button" onClick={() => onToggle(o.id)} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px",
                borderRadius: 8, border: "none", background: sel ? "#F7F5FF" : "transparent",
                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}>
                <span style={{
                  width: 17, height: 17, borderRadius: 5, flexShrink: 0,
                  border: sel ? `2px solid ${color}` : "2px solid #D1D5DB", background: sel ? color : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {sel && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
                </span>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, fontWeight: sel ? 700 : 500, color: sel ? color : "#414B59" }}>{o.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {selected.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {selected.map((id) => {
            const o = options.find((x) => x.id === id);
            const color = o?.color || "#475569";
            return (
              <span key={id} style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px 5px 12px",
                borderRadius: 999, fontSize: 12.5, fontWeight: 700, color, background: `${color}1A`,
              }}>
                {o?.label ?? id}
                <button type="button" onClick={() => onToggle(id)} title="Kaldır" style={{
                  display: "flex", alignItems: "center", justifyContent: "center", width: 15, height: 15,
                  borderRadius: "50%", border: "none", background: "transparent", color, cursor: "pointer", padding: 0,
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
