"use client";

import FlexSidebar from "../_components/FlexSidebar";

export default function RandevuTakvimiPage() {
  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <FlexSidebar active="randevu-takvimi" />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#EEF0F3", gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(15,31,61,.08)" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4"/><path d="M16 2v4"/>
            <rect width="18" height="18" x="3" y="4" rx="2"/>
            <path d="M3 10h18"/>
            <path d="m9 16 2 2 4-4"/>
          </svg>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#414B59" }}>Randevu Takvimi</div>
          <div style={{ fontSize: 13, color: "#8E95A3", marginTop: 6 }}>Bu sayfa yakında kullanıma açılacak.</div>
        </div>
      </main>
    </div>
  );
}
