"use client";

import { RichText } from "./RichText";

export function StandartPaketIcerik({ icerikMetni, onChange }: { icerikMetni: string; onChange: (html: string) => void }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
        <span style={{ fontSize: 15.5, fontWeight: 700, color: "#0f1f3d" }}>İçerik</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#0369a1", background: "#e0f2fe", padding: "3px 10px", borderRadius: 999 }}>standart paket</span>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#94a3b8", lineHeight: 1.5 }}>
        Tek paket olarak satılır. Web sitesindeki müfredat/içerik metnini buraya yapıştırın.
        Parçalara ayırıp bölüm/track bazlı satmak isterseniz Genel Bilgiler&apos;den <strong>Eğitim Yapısı → Track Bazlı</strong> yapın.
      </p>
      <RichText value={icerikMetni} onChange={onChange} />
    </div>
  );
}
