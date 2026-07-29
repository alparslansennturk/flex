"use client";

import { S, IC } from "./constants";

export function SertifikasyonTab({ isKurumsal, isBireysel, sertTipi, onSertTipiChange, sertText }: {
  isKurumsal: boolean;
  isBireysel: boolean;
  sertTipi: string;
  onSertTipiChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  sertText: string;
}) {
  return (
    <div style={{ maxWidth: 580 }}>
      {isKurumsal && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
            <span style={{ fontSize: 15.5, fontWeight: 700, color: "#0f1f3d" }}>Sertifikasyon</span>
            <span style={S.pillIndigo}>kurumsal</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 22, border: "1px solid #e9edf4", borderRadius: 16, background: "linear-gradient(135deg,#fafbff,#f5f7ff)" }}>
            <div style={S.certIcon} dangerouslySetInnerHTML={{ __html: IC.awardBig }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0f1f3d" }}>Kurumsal Katılım Sertifikası</div>
              <p style={{ margin: "5px 0 0", fontSize: 13.5, color: "#64748b", lineHeight: 1.5 }}>Kurumsal eğitimlerde sınav, proje ve puan barajı uygulanmaz. Programı tamamlayan tüm katılımcılara standart katılım sertifikası düzenlenir.</p>
            </div>
          </div>
        </>
      )}
      {isBireysel && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
            <span style={{ fontSize: 15.5, fontWeight: 700, color: "#0f1f3d" }}>Sertifikasyon</span>
            <span style={S.pillIndigo}>bireysel</span>
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={S.label}>Sertifikasyon Tipi</label>
            <div style={{ position: "relative" }}>
              <select className="ee-select" value={sertTipi} onChange={onSertTipiChange} style={S.select}>
                <option value="Sınav Bazlı">Sınav Bazlı</option>
                <option value="Proje Bazlı">Proje Bazlı</option>
              </select>
              <span style={S.selChev} dangerouslySetInnerHTML={{ __html: IC.selChev }} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={S.label}>Verilecek Sertifika</label>
            <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 15px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f1f5f9" }}>
              <span style={{ flex: "0 0 auto", display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.awardGreen }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>{sertText}</span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: "#94a3b8", lineHeight: 1.55 }}>Ufak Not: Kurum yönetmeliği gereğince ilgili ölçüm tipinden 90 ve üzeri puan alanlar Başarı, 50 ve üzeri puan alanlar Katılım Sertifikası almaya hak kazanır.</p>
        </>
      )}
    </div>
  );
}
