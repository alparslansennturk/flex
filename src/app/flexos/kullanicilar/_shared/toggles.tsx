"use client";

/** Kullanıcılar modülünde ortak kullanılan toggle bileşenleri (Ekle/Düzenle/Ayarlar). */

export function ToggleSwitch({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={active ? "Kapat" : "Aç"} style={{
      position: "relative", width: 44, height: 24, borderRadius: 999, border: "none", flex: "0 0 auto",
      background: active ? "#22C55E" : "#D1D5DB", cursor: "pointer", transition: "background .2s", padding: 0,
    }}>
      <span style={{ position: "absolute", top: 2, left: active ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .2s" }} />
    </button>
  );
}

export function ChipToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "9px 18px", borderRadius: 11, border: "1.5px solid", borderColor: active ? "#7C3AED" : "#E2E5EA",
      background: active ? "#EDE9FE" : "#fff", color: active ? "#7C3AED" : "#414B59",
      fontSize: 13.5, fontWeight: active ? 700 : 500, fontFamily: "inherit", cursor: "pointer", transition: "all .15s",
    }}>{label}</button>
  );
}

export const SENS_COLORS: Record<string, { color: string; bg: string }> = {
  green: { color: "#15803D", bg: "#DCFCE7" },
  yellow: { color: "#B45309", bg: "#FEF3C7" },
  red: { color: "#DC2626", bg: "#FEE2E2" },
};
