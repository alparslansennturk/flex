"use client";

import { memo, useState } from "react";
import { createPortal } from "react-dom";
import { formatTrPhone } from "@/app/lib/phone";
import { FlexSpinner } from "../../../_components/FlexSpinner";
import { AV_PALETTES, BRANS, BRANS_FALLBACK, PAGE_SIZE, ST, Student, StudentGroup, initials } from "./types";
import { S, IC } from "./constants";

type ActionMenuStep = "root" | "pickGroup" | "pickDelete";
interface ActionMenuPos { top: number; bottom: number; right: number; openUp: boolean }

interface StudentTableProps {
  filtered: Student[];
  hasAnyStudents: boolean;
  loading: boolean;
  page: number;
  setPage: (p: number) => void;
  canAssignGroup: boolean;
  canTransfer: boolean;
  canDeleteEnrollment: boolean;
  actionMenuOpen: string | null;
  actionMenuStep: ActionMenuStep;
  actionMenuPos: ActionMenuPos | null;
  setActionMenuOpen: (id: string | null) => void;
  setActionMenuStep: (s: ActionMenuStep) => void;
  setActionMenuPos: (p: ActionMenuPos | null) => void;
  setOpenDropdown: (v: null) => void;
  onRowClick: (personId: string) => void;
  onOpenAssign: (student: Student) => void;
  onOpenTransfer: (student: Student, entry: StudentGroup) => void;
  onOpenDelete: (student: Student, enrollmentId: string, label: string) => void;
}

/** Öğrenci Havuzu tablosu — satırlar, branş/eğitim/grup hover popup'ları, 3-nokta işlem menüsü, sayfalama. */
function StudentTableImpl({
  filtered, hasAnyStudents, loading, page, setPage,
  canAssignGroup, canTransfer, canDeleteEnrollment,
  actionMenuOpen, actionMenuStep, actionMenuPos, setActionMenuOpen, setActionMenuStep, setActionMenuPos, setOpenDropdown,
  onRowClick, onOpenAssign, onOpenTransfer, onOpenDelete,
}: StudentTableProps) {
  const [hoveredBrans, setHoveredBrans] = useState<string | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [hoveredEdu, setHoveredEdu] = useState<string | null>(null);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const startIdx = (curPage - 1) * PAGE_SIZE;
  const pageStudents = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  return (
    <div style={S.tableCard}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "#F7F8FA", borderBottom: "1px solid #EEF0F3" }}>
              <th className="oh-col-name"  style={S.th}>Ad Soyad</th>
              <th className="oh-col-brans" style={{ ...S.th, paddingLeft: 8 }}>Branş</th>
              <th className="oh-col-edu"   style={S.th}>Eğitim</th>
              <th className="oh-col-stat"  style={S.th}>Durum</th>
              <th className="oh-wide-col oh-col-email" style={S.th}>E-posta</th>
              <th className="oh-wide-col oh-col-phone" style={S.th}>Telefon</th>
              <th className="oh-col-grup"  style={S.th}>Grup</th>
              <th className="oh-col-islem" style={{ ...S.th, textAlign: "right" }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {pageStudents.map((st) => {
              const ss = ST[st.status];
              const idHash = st.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
              const pal = AV_PALETTES[idHash % AV_PALETTES.length];
              const branchCount = st.branches.length;
              const activeBrans = st.branches[0] ?? "—";
              const popupOpen = hoveredBrans === st.id && branchCount > 1;
              const groups = st.groups;
              const groupCount = groups.length;
              const hasGroup = groupCount > 0;
              const groupPopupOpen = hoveredGroup === st.id && groupCount > 1;
              return (
                <tr key={st.id} className="oh-row" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} style={{ borderBottom: "1px solid #EEF0F3", cursor: "pointer" }} onClick={() => onRowClick(st.id)}>
                  {/* Ad Soyad */}
                  <td style={S.cell}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ ...S.avatarSm, background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}>{initials(st.name)}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap" }}>{st.name}</span>
                    </div>
                  </td>
                  {/* Branş */}
                  <td style={{ ...S.cell, paddingLeft: 8 }}>
                    <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }}
                      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8, cursor: "default" }}
                      onMouseEnter={() => setHoveredBrans(st.id)}
                      onMouseLeave={() => setHoveredBrans(null)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span style={{ ...S.bransBadge, color: (BRANS[activeBrans] ?? BRANS_FALLBACK).color, background: (BRANS[activeBrans] ?? BRANS_FALLBACK).background }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: (BRANS[activeBrans] ?? BRANS_FALLBACK).dot, flex: "0 0 auto" }} />
                        {activeBrans}
                      </span>
                      {branchCount > 1 && <span style={S.branchBadge}>+{branchCount - 1}</span>}
                      {popupOpen && (
                        <div style={S.branchPopup}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8E95A3", letterSpacing: ".03em", padding: "4px 9px 7px" }}>
                            Branşlar ({branchCount})
                          </div>
                          {st.branches.map((b, bi) => {
                            const c = BRANS[b] ?? BRANS_FALLBACK;
                            return (
                              <div key={b} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 9px", borderRadius: 8, background: bi === 0 ? "#EFF3FA" : "transparent" }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "0 0 auto", background: c.dot }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#414B59" }}>{b}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </td>
                  {/* Eğitim */}
                  <td role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} style={S.cell} onClick={(e) => e.stopPropagation()}>
                    {st.educations.length === 0 ? (
                      <span style={{ fontSize: 13, color: "#CDD2DA" }}>—</span>
                    ) : (
                      <div
                        style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, cursor: "default" }}
                        onMouseEnter={() => setHoveredEdu(st.id)}
                        onMouseLeave={() => setHoveredEdu(null)}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#414B59", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          title={st.educations[0].name}>
                          {st.educations[0].name}
                        </span>
                        {st.educations.length > 1 && (
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, borderRadius: 10, background: "#2867bd", color: "#fff", fontSize: 11, fontWeight: 700, padding: "0 5px" }}>
                            +{st.educations.length - 1}
                          </span>
                        )}
                        {hoveredEdu === st.id && st.educations.length > 1 && (
                          <div style={{ ...S.branchPopup, minWidth: 200 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8E95A3", letterSpacing: ".03em", padding: "4px 9px 7px" }}>
                              Eğitimler ({st.educations.length})
                            </div>
                            {st.educations.map((edu, ei) => (
                              <div key={edu.educationId} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 9px", borderRadius: 8, background: ei === 0 ? "#EFF3FA" : "transparent" }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "0 0 auto", background: "#3A7BD5" }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#414B59" }}>{edu.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  {/* Durum */}
                  <td style={S.cell}>
                    <span style={{ ...S.statusBadge, color: ss.color, background: ss.background }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: ss.dot, flex: "0 0 auto" }} />
                      {ss.label}
                    </span>
                  </td>
                  {/* E-posta — geniş ekran */}
                  <td className="oh-wide-col" style={S.cell}><span style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>{st.email}</span></td>
                  {/* Telefon — geniş ekran */}
                  <td className="oh-wide-col" style={S.cell}><span style={{ fontSize: 13, color: "#6F7B87", fontWeight: 600, whiteSpace: "nowrap" }}>{st.phone ? formatTrPhone(st.phone) : "—"}</span></td>
                  {/* Grup */}
                  <td role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} style={S.cell} onClick={(e) => e.stopPropagation()}>
                    {groupCount === 0 ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#8E95A3", fontStyle: "italic", whiteSpace: "nowrap" }}>
                        <span dangerouslySetInnerHTML={{ __html: IC.alert }} />Atanmadı
                      </span>
                    ) : groupCount === 1 ? (
                      <span style={S.groupChip}>
                        <span dangerouslySetInnerHTML={{ __html: IC.groupIcon }} />
                        {groups[0].label}
                      </span>
                    ) : (
                      <div
                        style={{ position: "relative", display: "inline-flex", cursor: "default", paddingBottom: 9 }}
                        onMouseEnter={() => setHoveredGroup(st.id)}
                        onMouseLeave={() => setHoveredGroup(null)}
                      >
                        <span style={S.groupChip}>
                          <span dangerouslySetInnerHTML={{ __html: IC.groupIcon }} />
                          {groupCount} Grup
                          <span style={S.branchBadge}>{groupCount}</span>
                        </span>
                        {groupPopupOpen && (
                          <div style={{ ...S.branchPopup, top: "100%" }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8E95A3", letterSpacing: ".03em", padding: "4px 9px 7px" }}>
                              Gruplar ({groupCount})
                            </div>
                            {groups.map((g) => {
                              const c = BRANS[g.branch] ?? BRANS_FALLBACK;
                              return (
                                <div key={g.groupId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "7px 9px", borderRadius: 8 }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "0 0 auto", background: c.dot }} />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1E222B" }}>{g.label}</span>
                                  </span>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "#8E95A3", whiteSpace: "nowrap" }}>{g.branch}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  {/* İşlem — 3 nokta menü: Gruba Ata / Grup Değiştir / Tamamen Sil */}
                  <td role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} style={{ ...S.cell, textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                    {(canAssignGroup || canTransfer || canDeleteEnrollment) ? (() => {
                      const canAssign = canAssignGroup && st.assignableEnrollments.length > 0;
                      const canDoTransfer = canTransfer && hasGroup;
                      // Kişinin TÜM enrollment'ları (gruplu + grupsuz) — hard-delete adayı.
                      // Sunucu satışa bağlı/notlu olanları zaten reddeder, bu sadece liste.
                      const deleteCandidates = [
                        ...st.groups.map((g) => ({ enrollmentId: g.enrollmentId, label: g.label, sub: g.branch })),
                        ...st.assignableEnrollments.map((a) => ({ enrollmentId: a.enrollmentId, label: a.educationName, sub: "Grupsuz" })),
                      ];
                      const menuOpen = actionMenuOpen === st.id;
                      const step = menuOpen ? actionMenuStep : "root";
                      const closeMenu = () => { setActionMenuOpen(null); setActionMenuStep("root"); setActionMenuPos(null); };
                      const menuContent = (
                        <>
                          {step === "root" ? (
                            <>
                              {canAssignGroup && (
                                <button type="button"
                                  className={canAssign ? "oh-ddrow" : undefined}
                                  disabled={!canAssign}
                                  title={canAssign ? "" : "Atanabilir grupsuz kayıt yok"}
                                  onClick={() => { closeMenu(); onOpenAssign(st); }}
                                  style={{ ...S.menuItem, color: canAssign ? "#1E222B" : "#CDD2DA", cursor: canAssign ? "pointer" : "not-allowed" }}
                                >
                                  <span dangerouslySetInnerHTML={{ __html: IC.userPlus }} />Gruba Ata
                                </button>
                              )}
                              {canTransfer && (
                                <button type="button"
                                  className={canDoTransfer ? "oh-ddrow" : undefined}
                                  disabled={!canDoTransfer}
                                  title={canDoTransfer ? "" : "Grup değiştirmek için önce bir gruba atanmış olmalı"}
                                  onClick={() => {
                                    if (!canDoTransfer) return;
                                    if (groupCount === 1) { closeMenu(); onOpenTransfer(st, groups[0]); }
                                    else setActionMenuStep("pickGroup");
                                  }}
                                  style={{ ...S.menuItem, color: canDoTransfer ? "#1E222B" : "#CDD2DA", cursor: canDoTransfer ? "pointer" : "not-allowed" }}
                                >
                                  <span dangerouslySetInnerHTML={{ __html: IC.transfer }} />Grup Değiştir
                                </button>
                              )}
                              {canDeleteEnrollment && deleteCandidates.length > 0 && (
                                <button type="button"
                                  className="oh-ddrow"
                                  title="Kaydı kalıcı olarak sil (satışa bağlı/notlu kayıtlar reddedilir)"
                                  onClick={() => {
                                    if (deleteCandidates.length === 1) {
                                      closeMenu();
                                      onOpenDelete(st, deleteCandidates[0].enrollmentId, deleteCandidates[0].label);
                                    } else {
                                      setActionMenuStep("pickDelete");
                                    }
                                  }}
                                  style={{ ...S.menuItem, color: "#D93636" }}
                                >
                                  <span dangerouslySetInnerHTML={{ __html: IC.trash }} />Tamamen Sil
                                </button>
                              )}
                            </>
                          ) : step === "pickDelete" ? (
                            <>
                              <button type="button"
                                onClick={() => setActionMenuStep("root")}
                                className="oh-ddrow"
                                style={{ ...S.menuItem, color: "#8E95A3", fontWeight: 700, fontSize: 11.5, letterSpacing: ".02em" }}
                              >
                                <span dangerouslySetInnerHTML={{ __html: IC.chevLeftSm }} />HANGİ KAYIT SİLİNSİN?
                              </button>
                              {deleteCandidates.map((d) => (
                                <button type="button"
                                  key={d.enrollmentId}
                                  onClick={() => { closeMenu(); onOpenDelete(st, d.enrollmentId, d.label); }}
                                  className="oh-ddrow"
                                  style={{ ...S.menuItem, justifyContent: "space-between", color: "#D93636" }}
                                >
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                    <span dangerouslySetInnerHTML={{ __html: IC.trash }} />
                                    {d.label}
                                  </span>
                                  <span style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 600 }}>{d.sub}</span>
                                </button>
                              ))}
                            </>
                          ) : (
                            <>
                              <button type="button"
                                onClick={() => setActionMenuStep("root")}
                                className="oh-ddrow"
                                style={{ ...S.menuItem, color: "#8E95A3", fontWeight: 700, fontSize: 11.5, letterSpacing: ".02em" }}
                              >
                                <span dangerouslySetInnerHTML={{ __html: IC.chevLeftSm }} />HANGİ GRUPTAN TAŞINSIN?
                              </button>
                              {groups.map((g) => {
                                const c = BRANS[g.branch] ?? BRANS_FALLBACK;
                                return (
                                  <button type="button"
                                    key={g.groupId}
                                    onClick={() => { closeMenu(); onOpenTransfer(st, g); }}
                                    className="oh-ddrow"
                                    style={{ ...S.menuItem, justifyContent: "space-between", color: "#1E222B" }}
                                  >
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, flex: "0 0 auto" }} />
                                      {g.label}
                                    </span>
                                    <span style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 600 }}>{g.branch}</span>
                                  </button>
                                );
                              })}
                            </>
                          )}
                        </>
                      );
                      return (
                        <div data-oh-actionmenu={st.id} style={{ position: "relative", display: "inline-flex" }}>
                          <button type="button"
                            className="oh-iconbtn"
                            title="İşlemler"
                            onClick={(e) => {
                              if (menuOpen) { closeMenu(); return; }
                              const r = e.currentTarget.getBoundingClientRect();
                              const openUp = window.innerHeight - r.bottom < 260;
                              setActionMenuPos({ top: r.bottom + 6, bottom: window.innerHeight - r.top + 6, right: window.innerWidth - r.right, openUp });
                              setActionMenuOpen(st.id); setActionMenuStep("root"); setOpenDropdown(null);
                            }}
                            style={S.dotsBtn}
                          >
                            <span dangerouslySetInnerHTML={{ __html: IC.dots }} />
                          </button>
                          {menuOpen && actionMenuPos && createPortal(
                            <div
                              data-oh-actionmenu={st.id}
                              style={{
                                ...S.actionMenu,
                                position: "fixed",
                                top: actionMenuPos.openUp ? "auto" : actionMenuPos.top,
                                bottom: actionMenuPos.openUp ? actionMenuPos.bottom : "auto",
                                right: actionMenuPos.right,
                                left: "auto",
                              }}
                            >
                              {menuContent}
                            </div>,
                            document.body
                          )}
                        </div>
                      );
                    })() : (
                      <span style={{ fontSize: 12, color: "#AEB4C0" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* loading */}
      {loading && pageStudents.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px", textAlign: "center" }}>
          <FlexSpinner />
          <div style={{ fontSize: 13.5, color: "#8E95A3" }}>Öğrenciler yükleniyor…</div>
        </div>
      )}

      {/* empty state */}
      {!loading && pageStudents.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px", textAlign: "center" }}>
          <div style={S.emptyIcon} dangerouslySetInnerHTML={{ __html: IC.searchBig }} />
          <div style={{ fontSize: 15.5, fontWeight: 700, color: "#414B59" }}>{!hasAnyStudents ? "Henüz öğrenci yok" : "Sonuç bulunamadı"}</div>
          <div style={{ fontSize: 13.5, color: "#8E95A3", maxWidth: 320 }}>{!hasAnyStudents ? "İlk satışı yaptığınızda öğrenciler burada görünecek." : "Seçili filtrelere uygun öğrenci yok. Filtreleri temizleyip tekrar deneyin."}</div>
        </div>
      )}

      {/* pagination */}
      {pageStudents.length > 0 && (
        <div style={S.pagination}>
          <div style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>
            <strong style={{ color: "#1E222B", fontWeight: 700 }}>{total}</strong> öğrenciden{" "}
            <strong style={{ color: "#1E222B", fontWeight: 700 }}>{total ? startIdx + 1 : 0}–{startIdx + pageStudents.length}</strong> arası gösteriliyor
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <button type="button" style={{ ...S.pageArrow, cursor: curPage > 1 ? "pointer" : "not-allowed", opacity: curPage > 1 ? 1 : 0.4 }} onClick={() => setPage(Math.max(1, curPage - 1))}>
              <span dangerouslySetInnerHTML={{ __html: IC.chevLeft }} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button type="button" key={p} style={p === curPage ? S.pageCur : S.pageReg} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button type="button" style={{ ...S.pageArrow, cursor: curPage < totalPages ? "pointer" : "not-allowed", opacity: curPage < totalPages ? 1 : 0.4 }} onClick={() => setPage(Math.min(totalPages, curPage + 1))}>
              <span dangerouslySetInnerHTML={{ __html: IC.chevRight }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const StudentTable = memo(StudentTableImpl);
