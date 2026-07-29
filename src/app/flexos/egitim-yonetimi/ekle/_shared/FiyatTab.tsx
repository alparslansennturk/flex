"use client";

import type { FormState, PoolOpt } from "./types";
import { S, IC, addBtn } from "./constants";

export function FiyatTab({ s, onChange, isGun, poolOptions, canAddPrice, addPriceRow, kdv, fmtCurrency, getSymbol, sureFor, setListe, removePriceRow }: {
  s: FormState;
  onChange: (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  isGun: boolean;
  poolOptions: PoolOpt[];
  canAddPrice: boolean;
  addPriceRow: () => void;
  kdv: number;
  fmtCurrency: (n: number) => string;
  getSymbol: () => string;
  sureFor: (key: string) => string;
  setListe: (id: number, val: string) => void;
  removePriceRow: (id: number) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 15.5, fontWeight: 700, color: "#0f1f3d" }}>Satılabilir Ürün Havuzu</span>
          <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 999, color: isGun ? "#c2410c" : "#0369a1", background: isGun ? "#ffedd5" : "#e0f2fe" }}>
            {isGun ? "günlük ücret bazlı" : "saatlik / paket bazlı"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#64748b" }}>Para Birimi</span>
          <div style={{ position: "relative", width: 100 }}>
            <select className="ee-select" value={s.paraBirimi} onChange={onChange("paraBirimi")} style={S.selectCur}>
              <option value="TL">TL</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
            <span style={{ ...S.selChevSm, right: 9 }} dangerouslySetInnerHTML={{ __html: IC.selChevSm }} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ position: "relative" }}>
            <select className="ee-select" value={s.poolSel} onChange={onChange("poolSel")} style={S.select}>
              {poolOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span style={S.selChev} dangerouslySetInnerHTML={{ __html: IC.selChev }} />
          </div>
        </div>
        <button onClick={addPriceRow} disabled={!canAddPrice} style={addBtn(canAddPrice, "#4f46e5")}>
          <span dangerouslySetInnerHTML={{ __html: IC.plusSm }} />
          Listeye Ekle
        </button>
      </div>

      <div style={{ border: "1px solid #e9edf4", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr style={{ background: "#fafbfd", borderBottom: "1px solid #eef1f6" }}>
                {["Ürün Adı", isGun ? "Süre (Gün)" : "Süre (Saat)", "Liste Fiyatı (KDV Hariç)", "KDV", "Net Matrah (KDV Dahil)", ""].map((h, i) => (
                  <th key={i} style={{ padding: "13px 18px", textAlign: i === 5 ? "right" : "left", fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.priceRows.map((r) => {
                const net = (Number(r.liste) || 0) * (1 + kdv / 100);
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f4f6fa" }}>
                    <td style={S.priceCell}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{r.name}</span>
                      <div style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 500, marginTop: 1 }}>{r.kind}</div>
                    </td>
                    <td style={S.priceCell}><span style={{ fontSize: 13.5, fontWeight: 600, color: "#475569" }}>{sureFor(r.key)}</span></td>
                    <td style={S.priceCell}>
                      <div style={{ position: "relative", width: 160 }}>
                        <input className="ee-input" type="number" min={0} value={r.liste} onChange={(e) => setListe(r.id, e.target.value)} placeholder="0" style={S.priceInput} />
                        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#94a3b8", fontWeight: 600, pointerEvents: "none" }}>{getSymbol()}</span>
                      </div>
                    </td>
                    <td style={S.priceCell}><span style={{ fontSize: 13, fontWeight: 600, color: "#64748b", background: "#eef2f8", padding: "4px 10px", borderRadius: 8 }}>%{kdv}</span></td>
                    <td style={S.priceCell}><span style={{ fontSize: 14.5, fontWeight: 800, color: "#0f1f3d" }}>{fmtCurrency(net)}</span></td>
                    <td style={{ ...S.priceCell, textAlign: "right" }}>
                      <button className="ee-del" style={S.smDelBtn} onClick={() => removePriceRow(r.id)}>
                        <span dangerouslySetInnerHTML={{ __html: IC.trashSm }} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {s.priceRows.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, padding: "42px 20px", textAlign: "center" }}>
            <div style={S.emptyIconSm} dangerouslySetInnerHTML={{ __html: IC.sellBig }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>Fiyat listesi boş</div>
            <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 300 }}>Yukarıdaki havuzdan ürün seçip &quot;Listeye Ekle&quot; ile fiyatlandırmaya başlayın.</div>
          </div>
        )}
      </div>
    </div>
  );
}
