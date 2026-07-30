"use client";

interface SummaryCard { value: number; label: string; bg: string; color: string; icon: string }

interface SummaryCardsProps {
  cards: SummaryCard[];
}

/** Eğitmen Havuzu üst özet kartları — Toplam/Aktif/Ders Veren/Grupsuz sayaçları. */
export function SummaryCards({ cards }: SummaryCardsProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 22 }}>
      {cards.map((c) => (
        <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 15, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: c.bg, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
            <span dangerouslySetInnerHTML={{ __html: c.icon }} />
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#1E222B", letterSpacing: "-.5px" }}>{c.value}</div>
            <div style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 600, marginTop: 2 }}>{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
