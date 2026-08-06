"use client";

import type { DayData } from "./types";
import { S, IC } from "./constants";

export function GunPlanlayici({ days, getDay, setDay, addKonu, removeKonu }: {
  days: number[];
  getDay: (n: number) => DayData;
  setDay: (n: number, p: Partial<DayData>) => void;
  addKonu: (n: number) => void;
  removeKonu: (n: number, idx: number) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
        <span style={{ fontSize: 15.5, fontWeight: 700, color: "#0f1f3d" }}>Gün Gün Planlama Paneli</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#c2410c", background: "#ffedd5", padding: "3px 10px", borderRadius: 999 }}>gün bazlı</span>
      </div>
      <p style={{ margin: "0 0 18px", fontSize: 12.5, color: "#94a3b8" }}>Her gün standart 6 saattir (10:00 – 16:00). Gün sayısını Genel Bilgiler sekmesinden değiştirebilirsiniz.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {days.map((n) => {
          const d = getDay(n);
          return (
            <div key={n} style={{ border: "1px solid #e9edf4", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: "#f8fafc", borderBottom: "1px solid #eef1f6" }}>
                <span style={S.dayIcon} dangerouslySetInnerHTML={{ __html: IC.calDay }} />
                <span style={{ fontSize: 14.5, fontWeight: 700, color: "#0f1f3d", flex: 1 }}>{n}. Gün</span>
                <span style={S.dayTime}>
                  <span dangerouslySetInnerHTML={{ __html: IC.clock }} />10:00 – 16:00 · 6 saat
                </span>
              </div>
              <div style={{ padding: "14px 16px" }}>
                <input className="ee-input" type="text" value={d.ad} onChange={(e) => setDay(n, { ad: e.target.value })} placeholder="Gün başlığı / eğitim adı — örn: Tanışma ve Temel Kavramlar" style={{ ...S.inputSm, marginBottom: 12 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10 }}>
                  {d.konular.map((text, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#f8fafc", border: "1px solid #eef1f6", borderRadius: 10 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#cbd5e1", flex: "0 0 auto" }} />
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: "#334155", flex: 1 }}>{text}</span>
                      <button type="button" className="ee-kondel" style={S.konuDel} onClick={() => removeKonu(n, idx)}>
                        <span dangerouslySetInnerHTML={{ __html: IC.xSm }} />
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <input className="ee-input" type="text" value={d.draft || ""} onChange={(e) => setDay(n, { draft: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addKonu(n); }} placeholder="Konu başlığı ekle…" style={{ ...S.inputSm, flex: 1, background: "#fff" }} />
                  <button type="button" className="ee-konadd" style={S.konuAdd} onClick={() => addKonu(n)}>
                    <span dangerouslySetInnerHTML={{ __html: IC.plusXs }} />Konu Ekle
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
