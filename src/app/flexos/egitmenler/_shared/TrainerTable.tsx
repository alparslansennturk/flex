"use client";

import { memo, useState } from "react";
import ReactDOM from "react-dom";
import { AV_PALETTES, BRANS_COLORS, STATUS_MAP, Trainer, initials } from "./types";
import { IC, S } from "./constants";

interface TrainerTableProps {
  pageItems: Trainer[];
  loading: boolean;
  hasAnyTrainers: boolean;
  filteredCount: number;
  startIdx: number;
  safePage: number;
  totalPages: number;
  setPage: (p: number) => void;
  activeStudents: (t: Trainer) => number;
  onOpenDetail: (id: number) => void;
  onDelete: (id: number) => void;
}

/** Eğitmen Havuzu tablosu — satırlar (Yetkinlik/Gruplar hover popup'ları portal ile), boş/yükleniyor durumları, sayfalama. `React.memo` ile sarılı: bkz. dosya sonu. */
function TrainerTableImpl({ pageItems, loading, hasAnyTrainers, filteredCount, startIdx, safePage, totalPages, setPage, activeStudents, onOpenDetail, onDelete }: TrainerTableProps) {
  // Popup'lar tablo hücresinin içinden `createPortal` ile document.body'ye taşınır —
  // tablo kartı `overflow:hidden` + yatay scroll wrapper'ı `overflowX:auto` (bu ikisinin
  // birlikte kullanımı CSS spec'inde overflow-y'yi de dolaylı "auto/clip" yapıyor) popup'ı
  // içeride sıkıştırıyordu (2026-07-10 bulunan bug). `position:fixed` + gerçek ekran
  // koordinatı (`getBoundingClientRect`) ile artık tablo sınırının dışına taşabiliyor.
  const [hoveredComp, setHoveredComp] = useState<number | null>(null);
  const [compPos, setCompPos] = useState<{ top: number; left: number } | null>(null);
  const [hoveredGroups, setHoveredGroups] = useState<number | null>(null);
  const [groupsPos, setGroupsPos] = useState<{ top: number; left: number } | null>(null);

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
          <thead>
            <tr style={{ background: "#F7F8FA", borderBottom: "1px solid #EEF0F3" }}>
              <th style={S.thFirst}>Eğitmen</th>
              <th style={S.th}>Yetkinlik</th>
              <th style={S.th}>Şube</th>
              <th style={S.th}>Gruplar</th>
              <th style={S.th}>Öğrenci</th>
              <th style={S.th}>Durum</th>
              <th style={S.thRight}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((t) => {
              const st = STATUS_MAP[t.status];
              const pal = AV_PALETTES[(t.id - 1) % AV_PALETTES.length];
              const branches = Object.keys(t.comp);
              const totalComp = branches.reduce((a, b) => a + t.comp[b].length, 0);
              const pinnedNote = t.notes.find((n) => n.pinned);
              return (
                <tr key={t.id} className="sg-trow" style={{ borderBottom: "1px solid #EEF0F3" }}>
                  {/* Eğitmen */}
                  <td style={S.tdFirst}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ width: 38, height: 38, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}>{initials(t.name)}</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} className="sg-name-link" onClick={() => onOpenDetail(t.id)} style={{ fontSize: 14.5, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap", cursor: "pointer" }}>{t.name}</span>
                          {pinnedNote && (
                            <span title={pinnedNote.text} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 6, flex: "0 0 auto",
                              color: pinnedNote.sentiment === "positive" ? "#007A30" : pinnedNote.sentiment === "negative" ? "#B42318" : "#8A5A00",
                              background: pinnedNote.sentiment === "positive" ? "#E6F5ED" : pinnedNote.sentiment === "negative" ? "#FFECEC" : "#FFF3DC" }}>
                              <span dangerouslySetInnerHTML={{ __html: pinnedNote.sentiment === "positive" ? IC.starSm : pinnedNote.sentiment === "negative" ? IC.alertSm : IC.infoSm }} />
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500 }}>{t.email}</span>
                      </div>
                    </div>
                  </td>

                  {/* Yetkinlik — sayı + hover popup (portal — bkz. hover states notu) */}
                  <td style={S.td}>
                    <div
                      onMouseEnter={(e) => { setHoveredComp(t.id); const r = e.currentTarget.getBoundingClientRect(); setCompPos({ top: r.bottom + 9, left: r.left }); }}
                      onMouseLeave={() => setHoveredComp(null)}
                      style={{ display: "inline-flex", cursor: "default" }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, background: "#F2F4F7", border: "1px solid #E2E5EA", fontSize: 13, fontWeight: 700, color: "#414B59" }}>
                        <span dangerouslySetInnerHTML={{ __html: IC.bookSm }} />
                        {totalComp} eğitim
                      </span>
                    </div>
                    {hoveredComp === t.id && compPos && typeof document !== "undefined" && ReactDOM.createPortal(
                      <div style={{ position: "fixed", top: compPos.top, left: compPos.left, width: 268, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 13, boxShadow: "0 18px 44px -12px rgba(15,31,61,.28)", padding: 12, zIndex: 9999, animation: "sgDdIn .14s cubic-bezier(.2,.8,.3,1)" }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 9 }}>Girebildiği Eğitimler</div>
                        {branches.map((b) => (
                          <div key={b} style={{ marginBottom: 11 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <span style={{ width: 9, height: 9, borderRadius: "50%", background: BRANS_COLORS[b]?.dot || "#CDD2DA", flex: "0 0 auto" }} />
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1E222B" }}>{b}</span>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingLeft: 16 }}>
                              {t.comp[b].map((e) => <span key={e} style={{ fontSize: 11.5, fontWeight: 600, color: "#414B59", background: "#F2F4F7", border: "1px solid #E2E5EA", padding: "3px 8px", borderRadius: 6 }}>{e}</span>)}
                            </div>
                          </div>
                        ))}
                      </div>,
                      document.body,
                    )}
                  </td>

                  {/* Şube */}
                  <td style={S.td}><span style={{ fontSize: 13, color: "#414B59", fontWeight: 600 }}>{t.subes.join(", ")}</span></td>

                  {/* Gruplar — hover popup (portal — bkz. hover states notu) */}
                  <td style={S.td}>
                    <div
                      onMouseEnter={(e) => { setHoveredGroups(t.id); const r = e.currentTarget.getBoundingClientRect(); setGroupsPos({ top: r.bottom + 9, left: r.left }); }}
                      onMouseLeave={() => setHoveredGroups(null)}
                      style={{ display: "inline-flex", cursor: "default" }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 8, background: t.groups.length ? "#F2F4F7" : "#FBFCFD", border: "1px solid #E2E5EA", fontSize: 13, fontWeight: 700, color: t.groups.length ? "#414B59" : "#AEB4C0", whiteSpace: "nowrap" }}>
                        <span dangerouslySetInnerHTML={{ __html: IC.groupSm }} />
                        {t.groups.length} Grup
                      </span>
                    </div>
                    {hoveredGroups === t.id && t.groups.length > 0 && groupsPos && typeof document !== "undefined" && ReactDOM.createPortal(
                      <div style={{ position: "fixed", top: groupsPos.top, left: groupsPos.left, width: 230, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 12, boxShadow: "0 18px 40px -12px rgba(15,31,61,.26)", padding: 8, zIndex: 9999, animation: "sgDdIn .14s cubic-bezier(.2,.8,.3,1)" }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em", padding: "4px 9px 7px" }}>Atanmış Gruplar</div>
                        {t.groups.map((g) => (
                          <div key={g.kod} className="sg-group-hover-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 9px", borderRadius: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#1E222B" }}>{g.kod}</span>
                            <span style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500, whiteSpace: "nowrap" }}>{g.ogrenci} öğr.</span>
                          </div>
                        ))}
                      </div>,
                      document.body,
                    )}
                  </td>

                  {/* Öğrenci */}
                  <td style={S.td}><span style={{ fontSize: 14, fontWeight: 700, color: "#1E222B" }}>{activeStudents(t)}</span></td>

                  {/* Durum */}
                  <td style={S.td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: st.color, background: st.bg, whiteSpace: "nowrap" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.dot, flex: "0 0 auto" }} />
                      {st.label}
                    </span>
                  </td>

                  {/* İşlem */}
                  <td style={S.tdRight}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <button type="button" className="sg-edit-btn" onClick={() => onOpenDetail(t.id)} title="Detay" style={S.editBtnIcon}>
                        <span dangerouslySetInnerHTML={{ __html: IC.pencilSm }} />
                      </button>
                      <button type="button" className="sg-del-btn" onClick={() => onDelete(t.id)} title="Sil" style={S.delBtn}>
                        <span dangerouslySetInnerHTML={{ __html: IC.trash }} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* loading state */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px", textAlign: "center", color: "#8E95A3", fontSize: 14, fontWeight: 600 }}>
          Eğitmenler yükleniyor…
        </div>
      )}

      {/* empty state */}
      {!loading && filteredCount === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px", textAlign: "center" }}>
          <div style={{ width: 58, height: 58, borderRadius: 16, background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" }}>
            <span dangerouslySetInnerHTML={{ __html: IC.searchLg }} />
          </div>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: "#414B59" }}>{!hasAnyTrainers ? "Henüz eğitmen eklenmemiş" : "Eğitmen bulunamadı"}</div>
          <div style={{ fontSize: 13.5, color: "#8E95A3", maxWidth: 320 }}>{!hasAnyTrainers ? "Sağ üstteki “Eğitmen Ekle” ile ilk eğitmeni oluşturun." : "Seçili filtrelere uygun eğitmen yok. Filtreleri temizleyip tekrar deneyin."}</div>
        </div>
      )}

      {/* pagination */}
      {filteredCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" as const, padding: "16px 24px", borderTop: "1px solid #EEF0F3", background: "#F7F8FA" }}>
          <div style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>
            <strong style={{ color: "#1E222B", fontWeight: 700 }}>{filteredCount}</strong> eğitmenden <strong style={{ color: "#1E222B", fontWeight: 700 }}>{startIdx + 1}–{startIdx + pageItems.length}</strong> arası
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <button type="button" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1} style={{ ...S.pageNav, opacity: safePage > 1 ? 1 : 0.4, cursor: safePage > 1 ? "pointer" : "not-allowed" }}>
              <span dangerouslySetInnerHTML={{ __html: IC.chevLeft }} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button type="button" key={p} onClick={() => setPage(p)} style={p === safePage ? S.pageActive : S.pageBtn}>{p}</button>
            ))}
            <button type="button" onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages} style={{ ...S.pageNav, opacity: safePage < totalPages ? 1 : 0.4, cursor: safePage < totalPages ? "pointer" : "not-allowed" }}>
              <span dangerouslySetInnerHTML={{ __html: IC.chevRight }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * `React.memo` burada gerçekten işe yarar: container `pageItems`'ı (useMemo) ve
 * `openDetail`/`activeStudents`'ı (useCallback) sabit referansla geçiyor — ör. Detay
 * sheet'te not yazarken (`noteDraft` her tuş vuruşunda değişir) TrainerTable'ın
 * kendisi (hover popup state'i dahil tüm satırları) artık yeniden render OLMUYOR,
 * çünkü prop'larının hiçbiri gerçekten değişmedi.
 */
export const TrainerTable = memo(TrainerTableImpl);
