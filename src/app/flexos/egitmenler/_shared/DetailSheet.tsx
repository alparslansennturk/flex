"use client";

import { AnimatePresence, motion } from "framer-motion";
import { formatTrPhone } from "@/app/lib/phone";
import { AV_PALETTES, BRANS_COLORS, GUNLER, STATUS_MAP, Trainer, initials } from "./types";
import { IC, S } from "./constants";

interface DetailSheetProps {
  trainer: Trainer | null;
  onClose: () => void;
  onEdit: (t: Trainer) => void;
  ucretRevealed: boolean;
  onToggleUcret: () => void;
  noteDraft: string; setNoteDraft: (v: string) => void;
  noteSaving: boolean;
  onAddNote: () => void;
  onTogglePin: (noteIdx: number) => void;
}

/** Eğitmen detay bottom sheet — İletişim/Ücret/Yetkinlik/Performans (sol), Gruplar/Müsaitlik/Notlar (sağ). */
export function DetailSheet({ trainer, onClose, onEdit, ucretRevealed, onToggleUcret, noteDraft, setNoteDraft, noteSaving, onAddNote, onTogglePin }: DetailSheetProps) {
  return (
    <AnimatePresence>
      {trainer && (
        <>
          <motion.div key="overlay" className="fx-sheet-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={onClose} style={{ position: "fixed", top: 0, bottom: 0, zIndex: 80, background: "rgba(15,31,61,.4)" }} />
          <motion.div key="sheet" className="fx-sheet"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{ position: "fixed", bottom: 0, zIndex: 81, maxHeight: "85vh", background: "#F7F8FA", borderRadius: "24px 24px 0 0", boxShadow: "0 -24px 60px -12px rgba(15,31,61,.35)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "22px 28px 18px", background: "#F7F8FA" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {(() => { const pal = AV_PALETTES[(trainer.id - 1) % AV_PALETTES.length]; return (
                  <span style={{ width: 52, height: 52, borderRadius: 15, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 17, fontWeight: 700, background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}>{initials(trainer.name)}</span>
                ); })()}
                <div style={{ lineHeight: 1.3 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>{trainer.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                    {(() => { const st = STATUS_MAP[trainer.status]; return (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: st.color, background: st.bg }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.dot, flex: "0 0 auto" }} />{st.label}
                      </span>
                    ); })()}
                    <span style={{ fontSize: 12.5, color: "#8E95A3", fontWeight: 600 }}>{trainer.subes.join(" · ")}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
                <button type="button" onClick={() => onEdit(trainer)} className="eg-edit-link" style={S.editLinkBtn}>
                  <span dangerouslySetInnerHTML={{ __html: IC.pencilSm }} /> Düzenle
                </button>
                <button type="button" onClick={onClose} className="sg-iconbtn" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", flex: "0 0 auto" }}>
                  <span dangerouslySetInnerHTML={{ __html: IC.xMark }} />
                </button>
              </div>
            </div>

            {/* scrollable body — multi-column grid */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 32px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>

                {/* LEFT COLUMN */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {/* İletişim & Profil */}
                  <div style={S.card}>
                    <div style={S.cardTitle}>İletişim & Profil</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 13.5, color: "#414B59" }}>
                        <span dangerouslySetInnerHTML={{ __html: IC.mail }} /><span>{trainer.email}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 13.5, color: "#414B59" }}>
                        <span dangerouslySetInnerHTML={{ __html: IC.phone }} /><span>{trainer.phone ? formatTrPhone(trainer.phone) : "—"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 13.5, color: "#414B59" }}>
                        <span dangerouslySetInnerHTML={{ __html: IC.pinSm }} /><span>{trainer.subes.join(", ")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ücret */}
                  <div style={S.card}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={S.cardTitle}>Ücret Bilgisi</div>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8A5A00", background: "#FFF3DC", padding: "2px 8px", borderRadius: 999 }}>Gizli</span>
                    </div>
                    {trainer.ucret != null ? (
                      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={onToggleUcret} style={{ cursor: "pointer", userSelect: "none" }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "#1E222B", letterSpacing: "-.5px", filter: ucretRevealed ? "none" : "blur(8px)", transition: "filter .25s" }}>
                          {trainer.ucret.toLocaleString("tr-TR")} TL<span style={{ fontSize: 15, fontWeight: 600, color: "#8E95A3" }}> / saat</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500, marginTop: 4 }}>
                          {ucretRevealed ? "Gizlemek için tıklayın" : "Görmek için tıklayın"} · Ders saati başına
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "#AEB4C0", fontWeight: 500 }}>Ücret bilgisi girilmemiş.</div>
                    )}
                  </div>

                  {/* Yetkinlik ağacı */}
                  <div style={S.card}>
                    <div style={S.cardTitle}>Yetkinlik — Girebildiği Eğitimler</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                      {Object.keys(trainer.comp).map((b) => {
                        const bc = BRANS_COLORS[b];
                        return (
                          <div key={b}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 11px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: bc?.color || "#414B59", background: bc?.bg || "#F2F4F7" }}>
                                <span style={{ width: 9, height: 9, borderRadius: "50%", background: bc?.dot || "#CDD2DA", flex: "0 0 auto" }} />{b}
                              </span>
                              <span style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 600 }}>{trainer.comp[b].length} eğitim</span>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, paddingLeft: 4 }}>
                              {trainer.comp[b].map((e) => (
                                <span key={e} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#414B59", background: "#F2F4F7", border: "1px solid #E2E5EA", padding: "5px 10px", borderRadius: 8 }}>
                                  <span dangerouslySetInnerHTML={{ __html: IC.checkGreen }} />{e}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Performans placeholder */}
                  <div style={{ ...S.card, borderStyle: "dashed", padding: "22px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 14 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 11, background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3", flex: "0 0 auto" }}>
                        <span dangerouslySetInnerHTML={{ __html: IC.chart }} />
                      </div>
                      <div style={{ lineHeight: 1.4 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#414B59" }}>Performans & Anket Özeti</div>
                        <div style={{ fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>Doluluk, değerlendirme ortalaması ve anket notu — yakında.</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      {[["Öğrenci", "—"], ["Ort. Puan", "—"], ["Anket", "—"]].map(([label, val]) => (
                        <div key={label} style={{ flex: 1, padding: "12px 10px", borderRadius: 10, background: "#F7F8FA", textAlign: "center" as const }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#CDD2DA", letterSpacing: "-.3px" }}>{val}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#AEB4C0", marginTop: 3 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {/* Atanmış Gruplar */}
                  <div style={S.card}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
                      <span style={S.cardTitle}>Atanmış Gruplar</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "2px 9px", borderRadius: 999 }}>{trainer.groups.length}</span>
                    </div>
                    {trainer.groups.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                        {trainer.groups.map((g) => {
                          const firstBranch = Object.keys(trainer.comp)[0];
                          const bc = BRANS_COLORS[firstBranch] || BRANS_COLORS.Software;
                          return (
                            <div key={g.kod} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 13px", border: "1px solid #EEF0F3", borderRadius: 11, background: "#FBFCFD" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                                <span style={{ width: 30, height: 30, borderRadius: 9, background: bc.bg, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: bc.dot }} />
                                </span>
                                <div style={{ lineHeight: 1.3, minWidth: 0 }}>
                                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B" }}>{g.kod}</div>
                                  <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.egitim}</div>
                                </div>
                              </div>
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#414B59", whiteSpace: "nowrap", flex: "0 0 auto" }}>{g.ogrenci} öğr.</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "#8E95A3", fontWeight: 500, padding: "6px 2px" }}>Bu dönem atanmış grup yok.</div>
                    )}
                  </div>

                  {/* Müsaitlik takvimi — kompakt */}
                  <div style={S.card}>
                    <div style={S.cardTitle}>Müsaitlik Takvimi</div>
                    {trainer.musaitlik.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {GUNLER.map((g) => {
                          const slots = trainer.musaitlik.filter((s) => s.gun === g);
                          if (slots.length === 0) return null;
                          return slots.map((s, i) => (
                            <span key={`${g}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                              color: s.dolu ? "#B42318" : "#007A30",
                              background: s.dolu ? "#FFECEC" : "#E6F5ED",
                              border: s.dolu ? "1px solid #F3B0B0" : "1px solid #A7E0BD" }}>
                              <span style={{ fontWeight: 700, color: s.dolu ? "#B42318" : "#1E222B" }}>{g}</span>
                              {s.baslangic} – {s.bitis}
                              {s.dolu && <span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.8 }}>Dolu</span>}
                            </span>
                          ));
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "#AEB4C0", fontWeight: 500 }}>Müsaitlik bilgisi girilmemiş.</div>
                    )}
                  </div>

                  {/* Notlar */}
                  <div style={S.card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
                      <span dangerouslySetInnerHTML={{ __html: IC.chatSm }} />
                      <span style={{ fontSize: 13.5, fontWeight: 800, color: "#1E222B" }}>Eğitmen Notları</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8A5A00", background: "#FFF3DC", padding: "2px 8px", borderRadius: 999 }}>Dahili</span>
                    </div>
                    {/* add note */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
                      <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Yeni not ekle… (yalnızca yönetim görür)" style={S.noteTextarea} />
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button type="button" onClick={onAddNote} disabled={!noteDraft.trim() || noteSaving} className="sg-add-note-btn" style={{ ...S.addNoteBtn, background: (noteDraft.trim() && !noteSaving) ? "linear-gradient(135deg,#2867bd,#205297)" : "#CDD2DA", cursor: (noteDraft.trim() && !noteSaving) ? "pointer" : "not-allowed" }}>
                          <span dangerouslySetInnerHTML={{ __html: IC.plusSm }} /> {noteSaving ? "Kaydediliyor…" : "Not Ekle"}
                        </button>
                      </div>
                    </div>
                    {/* timeline */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {trainer.notes.map((n, i) => (
                        <div key={i} style={{ display: "flex", gap: 12 }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
                            <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#E2EAF3", color: "#205297", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{initials(n.author)}</span>
                            {i < trainer.notes.length - 1 && <span style={{ width: 2, flex: 1, background: "#EEF0F3", minHeight: 4 }} />}
                          </div>
                          <div style={{ flex: 1, paddingBottom: 16, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#1E222B" }}>{n.author}</span>
                              <span style={{ fontSize: 11.5, color: "#AEB4C0", fontWeight: 500 }}>{n.date}</span>
                              {n.pinned && <span style={{ fontSize: 10, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "1px 6px", borderRadius: 999 }}>Sabitlenmiş</span>}
                              <button type="button" onClick={() => onTogglePin(i)} disabled={noteSaving} className="sg-pin-btn" title={n.pinned ? "Sabiti kaldır" : "Sabitle"} style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: noteSaving ? "not-allowed" : "pointer", color: n.pinned ? "#205297" : "#AEB4C0", flex: "0 0 auto", padding: 0 }}>
                                <span dangerouslySetInnerHTML={{ __html: IC.pinIcon }} />
                              </button>
                            </div>
                            <div style={{ fontSize: 13.5, color: "#414B59", lineHeight: 1.55 }}>{n.text}</div>
                          </div>
                        </div>
                      ))}
                      {trainer.notes.length === 0 && <div style={{ fontSize: 13, color: "#8E95A3", fontWeight: 500, padding: "4px 2px" }}>Henüz not eklenmemiş.</div>}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
