"use client";

import React, { RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FLEX_MESSAGES } from "@/app/lib/messages";
import { AktiviteRow, AV_PAL, DURUMLAR, DraftBundle, GONDERILECEK, GONDERILECEK_LABEL, KANALS, SONRAKI, TIPLER, getInitials } from "./types";
import { ChevIcon, LabeledField, S } from "./ui";

interface ActivityRowProps {
  a: AktiviteRow;
  rowNumber: number;
  expanded: boolean;
  onRowClick: (id: number) => void;
  personCount: number;
  onBadgeClick: (id: number) => void;

  allActs: AktiviteRow[];
  digerOpen: boolean;
  onToggleDiger: (id: number) => void;
  gecmisOpen: boolean;
  onToggleGecmis: (id: number) => void;

  /** Sadece genişletilmiş satırda gerçek değerler taşır — diğerlerinde sabit `EMPTY_DRAFT` referansı (bkz. types.ts). */
  draft: DraftBundle;
  setDraftNote: (v: string) => void;
  onSonrakiTipChange: (v: string) => void;
  setDraftGonderildi: (v: boolean) => void;
  setDraftTarih: (v: string) => void;
  setDraftSaat: (v: string) => void;
  setDraftSorumlu: (v: string) => void;
  dateInputRef: RefObject<HTMLInputElement | null>;
  sorumluList: string[];
  onCancel: () => void;
  onSave: (id: number) => void;
}

/** Aktivite Merkezi tablosunda tek satır — ana satır + genişleyen aksiyon paneli (framer-motion). `React.memo` ile sarılı: bkz. dosya sonu. */
function ActivityRowImpl({
  a, rowNumber, expanded, onRowClick, personCount, onBadgeClick,
  allActs, digerOpen, onToggleDiger, gecmisOpen, onToggleGecmis,
  draft, setDraftNote, onSonrakiTipChange, setDraftGonderildi,
  setDraftTarih, setDraftSaat, setDraftSorumlu,
  dateInputRef, sorumluList, onCancel, onSave,
}: ActivityRowProps) {
  const {
    note: draftNote, sonrakiTip: draftSonrakiTip, gonderildi: draftGonderildi,
    tarih: draftTarih, saat: draftSaat, sorumlu: draftSorumlu,
    savingAct, savedAct, durumError, shakeDropdown, showDatetime,
  } = draft;
  const k = KANALS[a.kanal];
  const t = TIPLER[a.tip];
  const d = DURUMLAR[a.durum];
  const pal = AV_PAL[(a.id - 1) % AV_PAL.length];
  const diger = allActs.filter(x => x.iletisim === a.iletisim && x.id !== a.id);

  return (
    <React.Fragment>
      {/* ── main row ── */}
      <tr className="am-tr" style={{ cursor: "pointer", borderBottom: "1px solid #EEF0F3", background: expanded ? "#EFF3FA" : "transparent" }} onClick={() => onRowClick(a.id)}>
        <td style={{ padding: "15px 14px 15px 22px", verticalAlign: "middle", width: 40 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#AEB4C0" }}>{rowNumber}</span>
        </td>
        <td style={S.td}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: k.bg, color: k.color, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", fontSize: 13, fontWeight: 800 }}>
              {k.label.charAt(0)}
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1E222B", whiteSpace: "nowrap" }}>{k.label}</span>
          </div>
        </td>
        <td style={S.td}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 280 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700, color: t.color, background: t.bg, whiteSpace: "nowrap", width: "fit-content" }}>
              {t.label}
            </span>
            <span style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.ozet}</span>
          </div>
        </td>
        <td style={S.td}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap" }}>{a.ad}</span>
              {personCount > 1 && (
                <span
                  onClick={e => { e.stopPropagation(); onBadgeClick(a.id); }}
                  className="am-badge-btn"
                  title="Bu kişinin diğer kayıtları"
                  style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#64748b", minWidth: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, padding: "0 5px", cursor: "pointer", flexShrink: 0 }}>
                  {personCount}
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500 }}>{a.iletisim}</span>
          </div>
        </td>
        <td style={S.td}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px 5px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: d.color, background: d.bg, whiteSpace: "nowrap" }}>
            {a.durum === "kazanildi" ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}><path d="M20 6 9 17l-5-5"/></svg>
            ) : a.durum === "vazgecti" ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}><path d="M18 6 6 18M6 6l12 12"/></svg>
            ) : (
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: d.dot, flex: "0 0 auto" }} />
            )}
            {d.label}
          </span>
        </td>
        <td style={S.td}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#334155", whiteSpace: "nowrap" }}>{a.tarih}</span>
            <span style={{ fontSize: 12, color: "#8E95A3", fontWeight: 600 }}>{a.saat}</span>
          </div>
        </td>
        <td style={S.td}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${pal[0]},${pal[1]})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, flex: "0 0 auto" }}>
              {getInitials(a.sorumlu)}
            </span>
            <span style={{ fontSize: 13.5, color: "#414B59", fontWeight: 600 }}>{a.sorumlu}</span>
          </div>
        </td>
        <td style={{ padding: "15px 22px 15px 14px", textAlign: "right", width: 48, verticalAlign: "middle" }}>
          <button className="am-chev-btn" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #E2E5EA", background: expanded ? "#DDE8F8" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: expanded ? "#205297" : "#8E95A3" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              {expanded ? <path d="m18 15-6-6-6 6"/> : <path d="m6 9 6 6 6-6"/>}
            </svg>
          </button>
        </td>
      </tr>

      {/* ── expand panel ── */}
      <tr style={{ background: "#F5F8FF", borderBottom: expanded ? "2px solid #c0d5ef" : "none" }}>
        <td colSpan={8} style={{ padding: 0 }}>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: "hidden" }}
              >
            <div style={{ padding: "20px 28px 22px" }}>

              {/* Müşteri mesajı + gelecek randevu */}
              {(a.musteriMesaji || a.gelecekRandevu) && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 24, marginBottom: 18, flexWrap: "wrap" }}>
                  {a.musteriMesaji && (
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8E95A3", marginBottom: 5 }}>Müşteri Mesajı:</div>
                      <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.55, fontWeight: 500 }}>{a.musteriMesaji}</div>
                    </div>
                  )}
                  {a.gelecekRandevu && (
                    <div style={{ flex: "0 0 auto" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8E95A3", marginBottom: 5 }}>Gelecek Randevu:</div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 10, background: "#DDE8F8", color: "#205297", fontSize: 13, fontWeight: 700, border: "1px solid #c0d5ef" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
                        {a.gelecekRandevu}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Geçmiş aksiyonlar (salt-okunur) — accordion, varsayılan kapalı */}
              {a._backend && a._log && a._log.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <button
                    onClick={e => { e.stopPropagation(); onToggleGecmis(a.id); }}
                    style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", padding: "0 0 6px", fontFamily: "inherit" }}
                  >
                    <motion.span
                      animate={{ rotate: gecmisOpen ? 90 : 0 }}
                      transition={{ duration: 0.18 }}
                      style={{ display: "inline-flex", color: "#8E95A3" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </motion.span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#8E95A3" }}>
                      Geçmiş Aksiyonlar
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: "#AEB4C0", borderRadius: 999, padding: "1px 7px" }}>
                      {a._log.length}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {gecmisOpen && (
                      <motion.div
                        key="gecmis"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingBottom: 4 }}>
                          {[...a._log].reverse().map((l, i) => (
                            <div key={i} style={{ padding: "9px 13px", borderRadius: 11, background: "#EEF3FB", border: "1px solid #D8E3F0" }}>
                              <div style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.5, fontWeight: 500 }}>{l.note}</div>
                              <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 600, marginTop: 3 }}>{l.tarih} · {l.saat}</div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Aksiyon notu (yeni giriş) */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8E95A3", marginBottom: 7 }}>Yeni Aksiyon:</div>
                <textarea
                  value={draftNote}
                  onChange={e => setDraftNote(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  placeholder="Aksiyon notunu buraya yazın…"
                  style={{ width: "100%", minHeight: 78, resize: "vertical", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #E2E5EA", background: "#FBFCFD", color: "#1E222B", fontSize: 13.5, fontWeight: 500, lineHeight: 1.55, outline: "none", fontFamily: "inherit" }}
                />
              </div>

              {/* Controls row */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>

                {/* Durum dropdown */}
                <LabeledField label="Durum">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ position: "relative" }}>
                      <select value={draftSonrakiTip} onChange={e => onSonrakiTipChange(e.target.value)} onClick={e => e.stopPropagation()}
                        className={shakeDropdown ? "error-shake" : ""}
                        style={{ ...S.sel, minWidth: 200, color: draftSonrakiTip ? "#1E222B" : "#6F7B87", borderColor: durumError ? "#E5484D" : undefined, background: durumError ? "#FFF5F5" : "#fff" }}>
                        <option value="" disabled style={{ color: "#9AA1AD" }}>— Durum seçin —</option>
                        {SONRAKI.map(s => {
                          const completed = GONDERILECEK[s];
                          const label = (draftSonrakiTip === s && draftGonderildi && completed) ? completed.tip : s;
                          return <option key={s} value={s} style={{ color: "#1E222B" }}>{label}</option>;
                        })}
                      </select>
                      <ChevIcon style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    </div>
                    <AnimatePresence initial={false}>
                      {GONDERILECEK[draftSonrakiTip] && (
                        <motion.label
                          key="gonderildi-cb"
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -6 }}
                          transition={{ duration: 0.18 }}
                          onClick={e => e.stopPropagation()}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                        >
                          <input
                            type="checkbox"
                            checked={draftGonderildi}
                            onChange={e => setDraftGonderildi(e.target.checked)}
                            style={{ width: 15, height: 15, accentColor: "#2867bd", cursor: "pointer" }}
                          />
                          <span style={{ fontSize: 13, fontWeight: 600, color: draftGonderildi ? "#2867bd" : "#6B7280" }}>
                            {draftGonderildi ? GONDERILECEK[draftSonrakiTip]?.tip : (GONDERILECEK_LABEL[draftSonrakiTip] ?? "Gönderildi mi?")}
                          </span>
                        </motion.label>
                      )}
                    </AnimatePresence>
                  </div>
                </LabeledField>

                {/* Tarih + Saat — her zaman görünür, ilgisizse disabled */}
                <LabeledField label="Tarih">
                  <input ref={dateInputRef} type="date" value={draftTarih} onChange={e => setDraftTarih(e.target.value)} onClick={e => e.stopPropagation()}
                    disabled={!showDatetime}
                    style={{ ...S.sel, minWidth: 160, padding: "10px 14px", opacity: showDatetime ? 1 : 0.38, cursor: showDatetime ? "auto" : "not-allowed" }} />
                </LabeledField>
                <LabeledField label="Saat">
                  <input type="time" value={draftSaat} onChange={e => setDraftSaat(e.target.value)} onClick={e => e.stopPropagation()}
                    disabled={!showDatetime}
                    style={{ ...S.sel, minWidth: 120, padding: "10px 14px", opacity: showDatetime ? 1 : 0.38, cursor: showDatetime ? "auto" : "not-allowed" }} />
                </LabeledField>

                {/* Sorumlu devralma */}
                <LabeledField label="Sorumlu">
                  <div style={{ position: "relative" }}>
                    <select value={draftSorumlu || a.sorumlu} onChange={e => setDraftSorumlu(e.target.value)} onClick={e => e.stopPropagation()} style={{ ...S.sel, minWidth: 150 }}>
                      {sorumluList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevIcon style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  </div>
                </LabeledField>

                {/* İptal + Kaydet */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                  {durumError && (
                    <span className={shakeDropdown ? "error-shake" : ""} style={{ fontSize: 13, fontWeight: 600, color: "#B42318", whiteSpace: "nowrap", marginRight: 22 }}>
                      {FLEX_MESSAGES['flexos/durum-required'].text}
                    </span>
                  )}
                  <button onClick={e => { e.stopPropagation(); onCancel(); }} className="am-cancel-btn"
                    style={{ padding: "10px 18px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                    İptal
                  </button>
                  <button onClick={e => { e.stopPropagation(); onSave(a.id); }} disabled={savingAct || savedAct} className="am-save-btn"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 11, border: "none", background: savedAct ? "linear-gradient(135deg,#009F3E,#007A30)" : "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: (savingAct || savedAct) ? "default" : "pointer", boxShadow: savedAct ? "0 6px 14px -6px rgba(0,122,48,.55)" : "0 6px 14px -6px rgba(32,82,151,.55)", transition: "background .25s, box-shadow .25s", minWidth: 110 }}>
                    {savingAct ? (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin .7s linear infinite", flexShrink: 0 }}><path d="M12 2a10 10 0 1 0 10 10"/></svg>Kaydediliyor…</>
                    ) : savedAct ? (
                      <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 6 9 17l-5-5"/></svg>Kaydedildi</>
                    ) : (
                      <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 6 9 17l-5-5"/></svg>Kaydet</>
                    )}
                  </button>
                </div>
              </div>

              {/* ── Diğer Aktiviteler ── */}
              {diger.length > 0 && (
                <div style={{ marginTop: 18, borderTop: "1px solid #D8E3F0" }}>
                  <button
                    onClick={e => { e.stopPropagation(); onToggleDiger(a.id); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0 4px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#4D52A6" }}>
                      Diğer Aktiviteler
                    </span>
                    <motion.span
                      animate={{ rotate: digerOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: "inline-flex", color: "#4D52A6" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {digerOpen && (
                      <motion.div
                        key="diger"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 4, paddingTop: 6 }}>
                          {diger.sort((x, y) => y.id - x.id).map(dg => {
                            const dk = KANALS[dg.kanal];
                            const dd = DURUMLAR[dg.durum];
                            return (
                              <div key={dg.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "#EDF2FB", border: "1px solid #D0DCEE" }}>
                                {/* Kanal chip */}
                                <span style={{ width: 28, height: 28, borderRadius: 7, background: dk.bg, color: dk.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flex: "0 0 auto" }}>
                                  {dk.label.charAt(0)}
                                </span>
                                {/* Özet */}
                                <span style={{ flex: 1, fontSize: 13, color: "#334155", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dg.ozet}</span>
                                {/* Tarih */}
                                <span style={{ fontSize: 12, color: "#8E95A3", fontWeight: 600, whiteSpace: "nowrap" }}>{dg.tarih} · {dg.saat}</span>
                                {/* Durum */}
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: dd.color, background: dd.bg, whiteSpace: "nowrap", flex: "0 0 auto" }}>
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: dd.dot }} />
                                  {dd.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

            </div>
              </motion.div>
            )}
          </AnimatePresence>
        </td>
      </tr>
    </React.Fragment>
  );
}

/**
 * `React.memo` burada gerçekten işe yarar: container `pageActs`'ı (useMemo) ve tüm
 * callback'leri (useCallback) sabit referansla geçiyor, taslak alanları da SADECE
 * genişletilmiş satırda değişen `draft` nesnesine toplanmış (bkz. DraftBundle) — yani
 * aksiyon notuna yazarken artık yalnızca o TEK satır yeniden render oluyor, görünürdeki
 * diğer 9 satır değil.
 */
export const ActivityRow = React.memo(ActivityRowImpl);
