"use client";

import React from "react";
import { BundleDoc, OdemeSatir, TAKSIT_PRESETS, fmtTL } from "./types";
import { S, IC, segSm } from "./constants";
import { SectionTitle, SelectWrap } from "./ui";

interface OdemeTabProps {
  sifirKilit: boolean;
  satisNedeni: string;
  satisModu: "bireysel" | "paket";
  selBundle: BundleDoc | undefined;
  bundleDiscPct: number;
  bundleDisc: number;
  brut: number;
  teslimLocked: boolean;
  teslimSekli: "in_person" | "online";
  hasKampanyaInd: boolean;
  kampanyaEtiket: string;
  kampanyaIndTutar: number;
  elIndirimMod: "yuzde" | "tutar";
  setElIndirimMod: (v: "yuzde" | "tutar") => void;
  elIndirim: string;
  setElIndirim: (v: string) => void;
  elIndirimVar: boolean;
  elIndirimTutar: number;
  indirimliMatrah: number;
  kdvOrani: number;
  kdvTutar: number;
  net: number;
  odemeSatirlari: OdemeSatir[];
  updateOdeme: (i: number, key: keyof OdemeSatir, val: string) => void;
  addOdeme: () => void;
  removeOdeme: (i: number) => void;
  hasSenet: boolean;
  kalan: number;
  senetVadeFarki: string;
  setSenetVadeFarki: (v: string) => void;
  vadeFarkiTutar: number;
  senetTaksitN: number;
  kalanSifir: boolean;
  alinan: number;
}

/** Satış Yap · Tab 3 — Finansal özet (kampanya + ek indirim + KDV), çok satırlı ödeme girişi, senet vade farkı. */
export function OdemeTab({
  sifirKilit, satisNedeni, satisModu, selBundle, bundleDiscPct, bundleDisc, brut,
  teslimLocked, teslimSekli, hasKampanyaInd, kampanyaEtiket, kampanyaIndTutar,
  elIndirimMod, setElIndirimMod, elIndirim, setElIndirim, elIndirimVar, elIndirimTutar,
  indirimliMatrah, kdvOrani, kdvTutar, net,
  odemeSatirlari, updateOdeme, addOdeme, removeOdeme,
  hasSenet, kalan, senetVadeFarki, setSenetVadeFarki, vadeFarkiTutar, senetTaksitN,
  kalanSifir, alinan,
}: OdemeTabProps) {
  return (
    <>
      <SectionTitle>Finansal Özet &amp; İndirim</SectionTitle>

      {/* 0 TL kilit uyarısı */}
      {sifirKilit && (
        <div style={S.sifirKilitBox}>
          <span style={S.sifirKilitIcon} dangerouslySetInnerHTML={{ __html: IC.lockBlue }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#1e40af" }}>Ücretsiz İşlem — {satisNedeni}</div>
            <div style={{ fontSize: 12, color: "#3b5b8c", fontWeight: 500 }}>Bu satış nedeni için ek ücret alınmaz; tüm tutarlar 0 TL.</div>
          </div>
        </div>
      )}

      {/* özet kartı */}
      <div style={{ border: "1px solid #e3e8f0", borderRadius: 14, background: "#fff", overflow: "hidden", marginBottom: 20 }}>
        {/* Ana fiyat */}
        {/* Paket modu: bireysel satış ile birebir aynı S.ozetRow stili */}
        {satisModu === "paket" && selBundle ? (<>
          {selBundle.items.map((item) => (
            <React.Fragment key={item.educationId}>
              <div style={S.ozetRow}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>{item.name} (KDV Hariç)</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#475569", minWidth: 110, textAlign: "right" as const }}>{fmtTL(item.listPrice ?? 0)}</span>
              </div>
              <div style={S.ozetSep} />
            </React.Fragment>
          ))}
          <div style={S.ozetRow}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Paket Fiyatı (KDV Hariç)</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#475569", minWidth: 110, textAlign: "right" as const }}>{fmtTL(brut)}</span>
          </div>
          <div style={S.ozetSep} />
          <div style={S.ozetRow}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#64748b" }}>
              İndirim
              {bundleDiscPct > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "1px 7px", borderRadius: 999 }}>%{bundleDiscPct}</span>}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#15803d", minWidth: 110, textAlign: "right" as const }}>− {fmtTL(bundleDisc)}</span>
          </div>
          <div style={S.ozetSep} />
        </>) : (<>
          {/* Bireysel mod: tek satır eğitim tutarı — hibrit ise hangi modelin fiyatı olduğu belli olsun */}
          <div style={S.ozetRow}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>
              Eğitim Tutarı{!teslimLocked && (teslimSekli === "online" ? " (Online)" : " (Yüz Yüze)")} (KDV Hariç)
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#475569", minWidth: 110, textAlign: "right" as const }}>{fmtTL(brut)}</span>
          </div>
          <div style={S.ozetSep} />
          <div style={S.ozetRow}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#64748b" }}>
              Kampanya İndirimi
              {hasKampanyaInd && kampanyaEtiket && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "1px 7px", borderRadius: 999 }}>{kampanyaEtiket}</span>}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: kampanyaIndTutar > 0 ? "#15803d" : "#0f1f3d", minWidth: 110, textAlign: "right" as const }}>{kampanyaIndTutar > 0 ? "− " + fmtTL(kampanyaIndTutar) : fmtTL(0)}</span>
          </div>
          <div style={S.ozetSep} />
        </>)}

        {/* Yönetici / satışçı indirimi */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 18px", background: "#fafbfd" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Yönetici / Satışçı İndirimi</div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 500, marginTop: 1 }}>Kampanyadan bağımsız ek indirim</div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
            <div style={{ display: "inline-flex", background: "#eef2f8", borderRadius: 9, padding: 3, gap: 3 }}>
              <button type="button" onClick={() => setElIndirimMod("yuzde")} style={segSm(elIndirimMod === "yuzde")}>%</button>
              <button type="button" onClick={() => setElIndirimMod("tutar")} style={segSm(elIndirimMod === "tutar")}>TL</button>
            </div>
            <div style={{ position: "relative" }}>
              <input type="number" value={elIndirim} onChange={(e) => setElIndirim(e.target.value)} disabled={sifirKilit} placeholder="0"
                style={{ width: 110, padding: "9px 32px 9px 12px", borderRadius: 10, border: "1px solid #e3e8f0", background: sifirKilit ? "#f1f5f9" : "#f8fafc", fontSize: 14, fontWeight: 700, fontFamily: "inherit", color: "#0f1f3d", outline: "none", textAlign: "right", cursor: sifirKilit ? "not-allowed" : "text" }} />
              <span style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 700, color: "#94a3b8", pointerEvents: "none" }}>{elIndirimMod === "yuzde" ? "%" : "TL"}</span>
            </div>
          </div>
        </div>

        {/* Uygulanan ek indirim */}
        {elIndirimVar && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "9px 18px", background: "#fff8f8", borderTop: "1px dashed #f3c6c6" }}>
            <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600 }}>Uygulanan ek indirim</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#dc2626", minWidth: 110, textAlign: "right" }}>− {fmtTL(elIndirimTutar)}</span>
          </div>
        )}

        {/* İndirimli matrah + KDV + Toplam */}
        <div style={{ borderTop: "2px solid #e3e8f0", background: "#f8fafd" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>İndirimli Matrah</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#475569", minWidth: 110, textAlign: "right" }}>{fmtTL(indirimliMatrah)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 18px 10px" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>KDV (%{kdvOrani})</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#475569", minWidth: 110, textAlign: "right" }}>{fmtTL(kdvTutar)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #e3e8f0", background: "#eef2f8" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#0f1f3d" }}>Toplam (KDV Dahil)</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#0f1f3d", minWidth: 110, textAlign: "right" }}>{fmtTL(net)}</span>
          </div>
        </div>
      </div>

      {/* Parçalı Ödeme kartı */}
      <div style={{ border: "1px solid #e3e8f0", borderRadius: 16, background: "#fcfdfe", padding: "18px 18px 6px", marginBottom: 14, boxShadow: "0 1px 2px rgba(15,31,61,.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 15 }}>
          <span style={{ width: 5, height: 18, borderRadius: 3, background: "#f97316" }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: "#0f1f3d" }}>Ödeme Girişi</span>
          <span style={{ fontSize: 12.5, color: "#94a3b8", fontWeight: 500 }}>— Parayı bölebilir veya boş geçebilirsiniz.</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 14 }}>
          {odemeSatirlari.map((o, i) => {
            const taksitli = o.tip === "Kredi Kartı" || o.tip === "Senet";
            // preset listede olmayan değer (örn. 4, 7) → "Özel" modu
            const isCustomTaksit = taksitli && !TAKSIT_PRESETS.includes(o.taksit);
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr auto", gap: 12, alignItems: "end", border: "1px solid #e9edf4", borderRadius: 14, padding: "14px 16px", background: "#fff" }}>
                <div>
                  <label htmlFor="tip" style={S.odemeLabel}>Ödeme Tipi</label>
                  <SelectWrap small>
                    <select id="tip" value={o.tip} onChange={(e) => updateOdeme(i, "tip", e.target.value)} style={S.odemeSelect}>
                      <option value="Nakit">Nakit</option>
                      <option value="Kredi Kartı">Kredi Kartı</option>
                      <option value="Havale/EFT">Havale/EFT</option>
                      <option value="Senet">Senet</option>
                    </select>
                  </SelectWrap>
                </div>
                <div>
                  <label htmlFor="tutar" style={S.odemeLabel}>Alınan Tutar</label>
                  <div style={{ position: "relative" }}>
                    <input id="tutar" type="number" value={o.tutar} onChange={(e) => updateOdeme(i, "tutar", e.target.value)} placeholder="0"
                      style={{ width: "100%", padding: "11px 42px 11px 13px", borderRadius: 11, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14, fontWeight: 600, fontFamily: "inherit", color: "#0f1f3d", outline: "none" }} />
                    <span style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", fontSize: 12.5, fontWeight: 700, color: "#94a3b8", pointerEvents: "none" }}>TL</span>
                  </div>
                </div>
                <div style={{ opacity: taksitli ? 1 : 0.5 }}>
                  <label htmlFor="taksit" style={{ ...S.odemeLabel, display: "flex", alignItems: "center", gap: 6 }}>
                    Taksit Sayısı{!taksitli && <span dangerouslySetInnerHTML={{ __html: IC.lockTiny }} />}
                  </label>
                  <SelectWrap small>
                    <select id="taksit" value={isCustomTaksit ? "custom" : o.taksit}
                      onChange={(e) => updateOdeme(i, "taksit", e.target.value === "custom" ? "" : e.target.value)}
                      disabled={!taksitli}
                      style={{ ...S.odemeSelect, background: taksitli ? "#f8fafc" : "#f1f5f9", cursor: taksitli ? "pointer" : "not-allowed" }}>
                      <option value="1">Tek Çekim</option>
                      <option value="2">2 Taksit</option>
                      <option value="3">3 Taksit</option>
                      <option value="6">6 Taksit</option>
                      <option value="9">9 Taksit</option>
                      <option value="12">12 Taksit</option>
                      <option value="custom">Özel taksit…</option>
                    </select>
                  </SelectWrap>
                  {isCustomTaksit && (
                    <div style={{ position: "relative", marginTop: 6 }}>
                      <input type="number" min={1} max={36} value={o.taksit} onChange={(e) => updateOdeme(i, "taksit", e.target.value)} placeholder="örn. 7" autoFocus
                        style={{ width: "100%", padding: "9px 44px 9px 12px", borderRadius: 11, border: "1px solid #c7d0de", background: "#fff", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", color: "#0f1f3d", outline: "none" }} />
                      <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 600, color: "#94a3b8", pointerEvents: "none" }}>taksit</span>
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => removeOdeme(i)} title="Satırı kaldır"
                  style={{ width: 42, height: 42, borderRadius: 11, border: "1px solid #e3e8f0", background: "#fff", color: odemeSatirlari.length > 1 ? "#94a3b8" : "#d8dee8", display: "flex", alignItems: "center", justifyContent: "center", cursor: odemeSatirlari.length > 1 ? "pointer" : "not-allowed", flex: "0 0 auto" }}
                  dangerouslySetInnerHTML={{ __html: IC.trash }} />
              </div>
            );
          })}
        </div>

        <button type="button" onClick={addOdeme} className="sy-addpay" style={S.addPayBtn}>
          <span dangerouslySetInnerHTML={{ __html: IC.plusSm }} />Başka Ödeme Yöntemi Ekle
        </button>

        {/* senet vade farkı — senet satırı varken görünür */}
        {hasSenet && kalan > 0 && (
          <div style={{ border: "1px solid #e9edf4", borderRadius: 12, padding: "14px 16px", marginBottom: 14, background: "#fefce8" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label htmlFor="senetVadeFarki" style={{ fontSize: 13.5, fontWeight: 700, color: "#713f12", whiteSpace: "nowrap" }}>Aylık Vade Farkı</label>
              <div style={{ position: "relative", width: 100 }}>
                <input id="senetVadeFarki" type="number" min={0} max={20} step={0.5} value={senetVadeFarki}
                  onChange={(e) => setSenetVadeFarki(e.target.value)} placeholder="0"
                  disabled={sifirKilit}
                  style={{ width: "100%", padding: "9px 32px 9px 12px", borderRadius: 10, border: "1px solid #d4c090", background: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "inherit", color: "#0f1f3d", outline: "none" }} />
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12.5, fontWeight: 700, color: "#94a3b8", pointerEvents: "none" }}>%</span>
              </div>
              {vadeFarkiTutar > 0 && (
                <span style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>
                  Vade farkı: {fmtTL(vadeFarkiTutar)} · Senet toplamı: {fmtTL(kalan + vadeFarkiTutar)} ({senetTaksitN} taksit × {fmtTL(Math.round((kalan + vadeFarkiTutar) / senetTaksitN))})
                </span>
              )}
            </div>
          </div>
        )}

        {/* finansal çıktı şeridi */}
        <div style={{ borderTop: "1px solid #e9edf4", margin: "0 -18px", padding: "16px 18px 18px", background: kalanSifir ? "linear-gradient(135deg,#f3fbf6,#ecfdf3)" : "linear-gradient(135deg,#fffaf4,#fff5ec)", borderRadius: "0 0 14px 14px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 360 }}>
              <span style={{ flex: "0 0 auto", display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.infoSm }} />
              <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>Satış sonrası öğrenci <strong style={{ color: "#15803d", fontWeight: 700 }}>Aktif</strong> statüsünde havuza eklenir.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 0 auto", minWidth: 220 }}>
              <div style={S.cikRow}><span style={S.cikLbl}>Toplam Tutar</span><span style={S.cikVal}>{fmtTL(net)}</span></div>
              {vadeFarkiTutar > 0 && (
                <div style={S.cikRow}><span style={{ ...S.cikLbl, color: "#92400e" }}>Vade Farkı</span><span style={{ ...S.cikVal, color: "#92400e" }}>+{fmtTL(vadeFarkiTutar)}</span></div>
              )}
              <div style={S.cikRow}><span style={S.cikLbl}>Ödenen</span><span style={S.cikVal}>{fmtTL(alinan)}</span></div>
              <div style={{ height: 1, background: "rgba(0,0,0,.08)", margin: "3px 0" }} />
              <div style={S.cikRow}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: "#334155" }}>Kalan</span>
                <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.5px", color: kalanSifir ? "#15803d" : "#b45309" }}>{fmtTL(kalan)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
