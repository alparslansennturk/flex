"use client";

/**
 * FlexOS · Sınıflar — paylaşımlı grup listesi (filtre + liste/kart toggle + tablo/kart
 * render + sayfalama + lifecycle: Başlat/Bitir/Sil/Geri Al). Full (Operasyon) ve Core
 * (eğitmen standalone) AYNI bileşeni kullanır — "Core = Full eksi Satış/Eğitim-Op"
 * ilkesi UI'da da tek kod olarak korunsun diye (FLEXOS.md).
 *
 * `mode="core"` iken Eğitmen/Şube/doluluk-bar gizlenir (öğrenci sayısı düz metin).
 */
import React, { useCallback, useMemo, useState, CSSProperties } from "react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import { FlexSpinner } from "../../_components/FlexSpinner";
import {
  type DisplayGroup, type GroupStatus,
  STATUS_MAP, BRANS_COLORS, BRANS_FALLBACK,
  parseTrDate, todayMidnight, avatarStyle,
} from "./groupDisplay";

/** Grup kodundan avatar baş harfleri (örn. "DSN-101" → "DS"). */
function groupInitials(kod: string): string {
  const letters = kod.replace(/[^a-zA-ZğüşöçıİĞÜŞÖÇ]/g, "");
  return (letters || kod).slice(0, 2).toLocaleUpperCase("tr");
}

type ViewMode = "list" | "card";
type FilterKey = "hepsi" | GroupStatus;
/** Core (eğitmen): canlıdaki gibi sade iki durum — Açılacak+Aktif = Aktif, Tamamlandı+İptal = Arşiv. */
type CoreFilterKey = "hepsi" | "aktif" | "arsiv";
const CORE_ACTIVE_STATUSES: GroupStatus[] = ["açılacak", "aktif"];
const CORE_ARCHIVE_STATUSES: GroupStatus[] = ["tamamlandı", "iptal"];
const PAGE_SIZE = 15;

interface GroupTableProps {
  groups: DisplayGroup[];
  loading: boolean;
  mode: "full" | "core";
  onRowClick: (g: DisplayGroup) => void;
  onEdit: (g: DisplayGroup) => void;
  onChanged: () => void;
  emptyHint: string;
  /** Başlat/Bitir/Düzenle/Sil/Geri-al aksiyonlarını göster (default true). Full'da
   * grup yönetim yetkisi olmayan aktörler (ör. eğitmen) için false geçilir — veri
   * zaten sunucuda scope'lu, bu sadece kozmetik/UI gate. */
  canManage?: boolean;
}

export default function GroupTable({ groups, loading, mode, onRowClick, onEdit, onChanged, emptyHint, canManage = true }: GroupTableProps) {
  // Varsayılan "Aktif" — sayfa açılışında tamamlanmış/iptal/açılacak gruplarla boğulmadan
  // doğrudan güncel iş yükü görünsün (2026-07-11 kullanıcı kararı). "Tümü" hâlâ bir tık uzakta.
  const [groupFilter, setGroupFilter] = useState<FilterKey | CoreFilterKey>("aktif");
  // Core (eğitmen) VE Full'da eğitmen (canManage=false, "kendi sınıflarım" hissi) için
  // kart görünümü varsayılan — Liste toggle'ı Full'da yine seçilebilir kalıyor.
  const [viewMode, setViewMode] = useState<ViewMode>(mode === "core" || !canManage ? "card" : "list");
  const [page, setPage] = useState(1);
  const [startId, setStartId] = useState<string | null>(null);
  const [finishId, setFinishId] = useState<string | null>(null);
  const [reopenId, setReopenId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const patchStatus = async (id: string, domainStatus: string, okMsg: string) => {
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/flexos/groups/${id}`, { method: "PATCH", headers, body: JSON.stringify({ status: domainStatus }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Durum güncellenemedi."); return; }
      toast.success(okMsg);
      onChanged();
    } catch {
      toast.error("Sunucu hatası — durum güncellenemedi.");
    }
  };

  const confirmStart = async () => { if (startId === null) return; const id = startId; setStartId(null); await patchStatus(id, "active", "Grup başarıyla başlatıldı!"); };
  const confirmFinish = async () => { if (finishId === null) return; const id = finishId; setFinishId(null); await patchStatus(id, "completed", "Eğitim tamamlandı."); };
  const confirmReopen = async () => { if (reopenId === null) return; const id = reopenId; setReopenId(null); await patchStatus(id, "active", "Grup tekrar aktif duruma alındı."); };

  const confirmDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId; setDeleteId(null);
    try {
      const res = await fetch(`/api/flexos/groups/${id}`, { method: "DELETE", headers: await authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Grup silinemedi."); return; }
      toast.success("Grup silindi.");
      onChanged();
    } catch {
      toast.error("Sunucu hatası — grup silinemedi.");
    }
  };

  const filtered = useMemo(() => {
    if (groupFilter === "hepsi") return groups;
    if (mode === "core") {
      if (groupFilter === "aktif") return groups.filter((g) => CORE_ACTIVE_STATUSES.includes(g.status));
      if (groupFilter === "arsiv") return groups.filter((g) => CORE_ARCHIVE_STATUSES.includes(g.status));
      return groups;
    }
    return groups.filter((g) => g.status === groupFilter);
  }, [groups, groupFilter, mode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageGroups = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { hepsi: groups.length, açılacak: 0, aktif: 0, tamamlandı: 0, iptal: 0 };
    groups.forEach((g) => { c[g.status]++; });
    return c;
  }, [groups]);

  const coreCounts = useMemo(() => ({
    hepsi: groups.length,
    aktif: groups.filter((g) => CORE_ACTIVE_STATUSES.includes(g.status)).length,
    arsiv: groups.filter((g) => CORE_ARCHIVE_STATUSES.includes(g.status)).length,
  }), [groups]);

  const findGroup = (id: string | null) => (id === null ? undefined : groups.find((g) => g.id === id));
  const byGroup = mode === "full";

  return (
    <div>
      {/* ===== FILTERS ===== */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "inline-flex", padding: 4, borderRadius: 12, background: "#fff", border: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" }}>
          {(mode === "core"
            ? [
                { key: "hepsi" as const, label: "Tümü", dot: null, count: coreCounts.hepsi },
                { key: "aktif" as const, label: "Aktif", dot: STATUS_MAP.aktif.dot, count: coreCounts.aktif },
                { key: "arsiv" as const, label: "Arşiv", dot: STATUS_MAP.tamamlandı.dot, count: coreCounts.arsiv },
              ]
            : [
                { key: "hepsi" as const, label: "Tümü", dot: null, count: counts.hepsi },
                { key: "açılacak" as const, label: "Açılacak", dot: STATUS_MAP.açılacak.dot, count: counts.açılacak },
                { key: "aktif" as const, label: "Aktif", dot: STATUS_MAP.aktif.dot, count: counts.aktif },
                { key: "tamamlandı" as const, label: "Tamamlandı", dot: STATUS_MAP.tamamlandı.dot, count: counts.tamamlandı },
                { key: "iptal" as const, label: "İptal", dot: STATUS_MAP.iptal.dot, count: counts.iptal },
              ]
          ).map((fd) => {
            const active = groupFilter === fd.key;
            return (
              <button key={fd.key} onClick={() => { setGroupFilter(fd.key); setPage(1); }} style={filterBtnStyle(active)}>
                {fd.dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: fd.dot, flex: "0 0 auto" }} />}
                <span>{fd.label}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999, color: active ? "#205297" : "#8E95A3", background: active ? "#DDE8F8" : "#EEF0F3" }}>{fd.count}</span>
              </button>
            );
          })}
        </div>
        {/* Core: sadece kart görünümü (canlıdaki gibi) — toggle yok. */}
        {mode === "full" && (
          <div style={{ display: "inline-flex", padding: 4, borderRadius: 11, background: "#fff", border: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" }}>
            <button onClick={() => setViewMode("list")} style={viewBtnStyle(viewMode === "list")}>
              <span dangerouslySetInnerHTML={{ __html: IC.listIcon }} />
              <span>Liste</span>
            </button>
            <button onClick={() => setViewMode("card")} style={viewBtnStyle(viewMode === "card")}>
              <span dangerouslySetInnerHTML={{ __html: IC.gridIcon }} />
              <span>Kart</span>
            </button>
          </div>
        )}
      </div>

      {/* ===== LIST VIEW ===== */}
      {viewMode === "list" && filtered.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: byGroup ? 860 : 720 }}>
              <thead>
                <tr style={{ background: "#F7F8FA", borderBottom: "1px solid #EEF0F3" }}>
                  <th style={S.thFirst}>Grup</th>
                  <th style={S.th}>Eğitim</th>
                  {byGroup && <th style={S.th}>Şube</th>}
                  {byGroup && <th style={S.th}>Eğitmen</th>}
                  <th style={S.th}>Bölüm</th>
                  <th style={{ ...S.th, paddingLeft: 18 }}>Seans</th>
                  <th style={{ ...S.th, paddingLeft: 18 }}>Başlangıç</th>
                  <th style={{ ...S.th, paddingLeft: 18 }}>{byGroup ? "Doluluk" : "Öğrenci"}</th>
                  <th style={{ ...S.th, paddingLeft: 18 }}>Durum</th>
                  <th style={S.thRight}></th>
                </tr>
              </thead>
              <tbody>
                {pageGroups.map((g) => {
                  const bs = BRANS_COLORS[g.brans] || BRANS_FALLBACK;
                  const st = STATUS_MAP[g.status];
                  const pct = g.kontenjan > 0 ? Math.round((g.dolu / g.kontenjan) * 100) : 0;
                  const barColor = g.status === "tamamlandı" || g.status === "iptal" ? "#AEB4C0" : pct >= 90 ? "#009F3E" : pct < 50 ? "#FFB020" : "#3A7BD5";
                  const startD = parseTrDate(g.tarih);
                  const canStart = g.status === "açılacak" && startD !== null && startD <= new Date();
                  const endD = parseTrDate(g.bitiş);
                  const canReopen = g.status === "tamamlandı" && (endD === null || endD >= todayMidnight());
                  return (
                    <tr key={g.id} className="gt-trow" onClick={() => onRowClick(g)} style={{ borderBottom: "1px solid #EEF0F3", cursor: "pointer" }}>
                      <td style={S.tdFirst}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {/* En soldaki nokta artık DURUM (her zaman "açılacak"=mavi, "aktif"=yeşil vb.) —
                              önceden branş rengiydi, kullanıcı bunu durum sanıp kırmızı-pembe branş
                              rengini "iptal" zannediyordu (2026-07-10 bulgu). Branş rengi "Eğitim"
                              sütununa taşındı — durum rengiyle asla karışmasın diye kare/köşeli. */}
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.dot, flex: "0 0 auto" }} />
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px", whiteSpace: "nowrap" }}>{g.kod}</span>
                        </div>
                      </td>
                      <td style={S.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 2, background: bs.dot, flex: "0 0 auto" }} />
                          <span style={{ fontSize: 13, color: "#414B59", fontWeight: 600 }}>{g.eğitim}</span>
                        </div>
                      </td>
                      {byGroup && <td style={S.td}><span style={{ fontSize: 13, color: "#414B59" }}>{g.şube}</span></td>}
                      {byGroup && <td style={S.td}><span style={{ fontSize: 13, color: "#414B59" }}>{g.eğitmen}</span></td>}
                      <td style={S.td}><span style={{ fontSize: 13, color: g.bölüm === "—" ? "#AEB4C0" : "#414B59" }}>{g.bölüm}</span></td>
                      <td style={{ ...S.td, paddingLeft: 18 }}>
                        <div style={{ lineHeight: 1.35 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#414B59", whiteSpace: "nowrap" }}>{g.seansGun}</div>
                          <div style={{ fontSize: 11.5, color: "#8E95A3", whiteSpace: "nowrap" }}>{g.seansSaat}</div>
                        </div>
                      </td>
                      <td style={{ ...S.td, paddingLeft: 18 }}><span style={{ fontSize: 12.5, color: "#414B59", fontWeight: 600, whiteSpace: "nowrap" }}>{g.tarih}</span></td>
                      <td style={{ ...S.td, paddingLeft: 18 }}>
                        {byGroup ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 80 }}>
                            <div style={{ width: 36, height: 5, borderRadius: 999, background: "#EEF0F3", overflow: "hidden", flex: "0 0 auto" }}>
                              <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, borderRadius: 999, background: barColor, transition: "width .3s" }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "#1E222B", whiteSpace: "nowrap" }}>{g.dolu}<span style={{ color: "#AEB4C0", fontWeight: 600 }}>/{g.kontenjan}</span></span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: "#1E222B", whiteSpace: "nowrap" }}>{g.dolu}<span style={{ color: "#AEB4C0", fontWeight: 600 }}> öğrenci</span></span>
                        )}
                      </td>
                      <td style={{ ...S.td, paddingLeft: 18 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: st.color, background: st.background, whiteSpace: "nowrap" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot }} />
                          {st.label}
                        </span>
                      </td>
                      <td style={S.tdRight} onClick={(e) => e.stopPropagation()}>
                        {canManage ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            {g.status === "açılacak" && (
                              <button
                                disabled={!canStart}
                                title={canStart && g.dolu === 0 ? "Önce gruba öğrenci ekleyiniz" : undefined}
                                onClick={() => {
                                  if (!canStart) return;
                                  // Öğrencisi olmayan grup başlatılamaz (2026-07-10 kullanıcı kararı) —
                                  // buton disabled DEĞİL (tıklanabilir), açıklayıcı uyarı verip durduruyoruz.
                                  if (g.dolu === 0) { toast.error("Önce gruba öğrenci ekleyiniz."); return; }
                                  setStartId(g.id);
                                }}
                                className="gt-start-btn" style={{ ...S.startBtn, opacity: canStart ? 1 : 0.45, cursor: canStart ? "pointer" : "not-allowed" }}>
                                <span dangerouslySetInnerHTML={{ __html: IC.play }} />
                                Başlat
                              </button>
                            )}
                            {g.status === "aktif" && (
                              <button onClick={() => setFinishId(g.id)} className="gt-start-btn" style={S.startBtn}>
                                <span dangerouslySetInnerHTML={{ __html: IC.checkSm }} />
                                Bitir
                              </button>
                            )}
                            {(g.status === "açılacak" || g.status === "aktif") && (
                              <button onClick={() => onEdit(g)} title="Düzenle" className="gt-edit-btn" style={S.editBtnIcon}>
                                <span dangerouslySetInnerHTML={{ __html: IC.pencilSm }} />
                              </button>
                            )}
                            {(g.status === "açılacak" || g.status === "aktif" || g.status === "tamamlandı" || g.status === "iptal") && (
                              <button onClick={() => setDeleteId(g.id)} title="Sil" className="gt-del-btn" style={S.delBtn}>
                                <span dangerouslySetInnerHTML={{ __html: IC.trash }} />
                              </button>
                            )}
                            {canReopen && (
                              <button onClick={() => setReopenId(g.id)} className="gt-start-btn" style={S.startBtn}>
                                <span dangerouslySetInnerHTML={{ __html: IC.undo }} />
                                Geri al
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#AEB4C0" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== CARD VIEW ===== */}
      {viewMode === "card" && filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
          {pageGroups.map((g, i) => {
            const st = STATUS_MAP[g.status];
            const pct = g.kontenjan > 0 ? Math.round((g.dolu / g.kontenjan) * 100) : 0;
            const barColor = g.status === "tamamlandı" || g.status === "iptal" ? "#AEB4C0" : pct >= 90 ? "#009F3E" : pct < 50 ? "#FFB020" : "#3A7BD5";
            return (
              <div key={g.id} className="gt-card-item" style={S.cardItem} onClick={() => onRowClick(g)}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ ...S.cardAvatar, ...avatarStyle(i) }}>{groupInitials(g.kod)}</div>
                    <div style={{ lineHeight: 1.3 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>{g.kod}</div>
                      <div style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 500 }}>{g.eğitim}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: st.color, background: st.background, whiteSpace: "nowrap" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.dot }} />
                      {st.label}
                    </span>
                    {/* 2026-07-13 fix — kart görünümünde (mode="core", Eğitmen Tek Başına)
                        düzenleme butonu HİÇ yoktu; sadece tablo/liste satırında vardı (yukarıda,
                        mode="core"'da liste görünümü tamamen gizli olduğu için erişilemezdi).
                        `onEdit` prop'u zaten bağlıydı (EgitmenSiniflarPanel.tsx), sadece render
                        eksikti. Tablo satırıyla AYNI durum kuralı (açılacak/aktif) + canManage. */}
                    {canManage && (g.status === "açılacak" || g.status === "aktif") && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(g); }}
                        title="Düzenle"
                        className="gt-edit-btn"
                        style={S.editBtnIcon}
                      >
                        <span dangerouslySetInnerHTML={{ __html: IC.pencilSm }} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "13px 0", borderTop: "1px solid #EEF0F3", borderBottom: "1px solid #EEF0F3" }}>
                  {byGroup && (
                    <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#414B59" }}>
                      <span dangerouslySetInnerHTML={{ __html: IC.mapPin }} />
                      <span style={{ fontWeight: 600 }}>{g.şube}</span>
                      <span style={{ color: "#CDD2DA" }}>&middot;</span>
                      <span>{g.eğitmen}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#414B59" }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.clockGray }} />
                    <span>{g.seansSaat ? `${g.seansGun} · ${g.seansSaat}` : g.seansGun}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#414B59" }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.calendarGray }} />
                    <span>Başlangıç: <strong style={{ fontWeight: 700, color: "#1E222B" }}>{g.tarih}</strong></span>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  {byGroup ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#6F7B87" }}>Öğrenci / Kontenjan</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#1E222B" }}>{g.dolu}<span style={{ color: "#AEB4C0", fontWeight: 600 }}>/{g.kontenjan}</span></span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: "#EEF0F3", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, borderRadius: 999, background: barColor, transition: "width .3s" }} />
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#6F7B87" }}>Öğrenci Sayısı</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#1E222B" }}>{g.dolu}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px", textAlign: "center", background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16 }}>
          <FlexSpinner />
          <div style={{ fontSize: 13.5, color: "#8E95A3" }}>Gruplar yükleniyor…</div>
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px", textAlign: "center", background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16 }}>
          <div style={{ width: 58, height: 58, borderRadius: 16, background: "#EEF0F3", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" }}>
            <span dangerouslySetInnerHTML={{ __html: IC.graduationBig }} />
          </div>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: "#414B59" }}>{groups.length === 0 ? "Henüz grup yok" : "Bu kategoride grup yok"}</div>
          <div style={{ fontSize: 13.5, color: "#8E95A3" }}>{groups.length === 0 ? emptyHint : "Farklı bir durum seçin veya yeni bir grup oluşturun."}</div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginTop: 18 }}>
          <div style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>
            <strong style={{ color: "#1E222B", fontWeight: 700 }}>{filtered.length}</strong> gruptan <strong style={{ color: "#1E222B", fontWeight: 700 }}>{startIdx + 1}&ndash;{startIdx + pageGroups.length}</strong> arası
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
              style={{ ...S.pageNav, opacity: safePage > 1 ? 1 : 0.4, cursor: safePage > 1 ? "pointer" : "not-allowed" }}>
              <span dangerouslySetInnerHTML={{ __html: IC.chevLeftNav }} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} style={pageBtnStyle(p === safePage)}>{p}</button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
              style={{ ...S.pageNav, opacity: safePage < totalPages ? 1 : 0.4, cursor: safePage < totalPages ? "pointer" : "not-allowed" }}>
              <span dangerouslySetInnerHTML={{ __html: IC.chevRightNav }} />
            </button>
          </div>
        </div>
      )}

      {/* ===== Lifecycle modals ===== */}
      {startId !== null && (
        <div onClick={() => setStartId(null)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.modal}>
            <div style={{ padding: "26px 26px 20px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: "#E6F5ED", display: "flex", alignItems: "center", justifyContent: "center", color: "#007A30", marginBottom: 16 }}>
                <span dangerouslySetInnerHTML={{ __html: IC.playBig }} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Eğitimi başlat</h3>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "#6F7B87" }}>
                <strong style={{ color: "#1E222B", fontWeight: 700 }}>{findGroup(startId)?.kod}</strong> grubunun eğitimini başlatmak istediğinize emin misiniz? Grup durumu <strong style={{ color: "#007A30", fontWeight: 700 }}>Aktif</strong> olarak güncellenecektir.
              </p>
            </div>
            <div style={{ display: "flex", gap: 11, padding: "16px 26px 22px", justifyContent: "flex-end" }}>
              <button onClick={() => setStartId(null)} style={S.cancelBtn}>Vazgeç</button>
              <button onClick={confirmStart} style={S.confirmStartBtn}>
                <span dangerouslySetInnerHTML={{ __html: IC.playWhite }} />
                Evet, başlat
              </button>
            </div>
          </div>
        </div>
      )}

      {finishId !== null && (
        <div onClick={() => setFinishId(null)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.modal}>
            <div style={{ padding: "26px 26px 20px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: "#EEF0F3", display: "flex", alignItems: "center", justifyContent: "center", color: "#6F7B87", marginBottom: 16 }}>
                <span dangerouslySetInnerHTML={{ __html: IC.checkBig }} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Eğitimi bitir</h3>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "#6F7B87" }}>
                <strong style={{ color: "#1E222B", fontWeight: 700 }}>{findGroup(finishId)?.kod}</strong> grubunun eğitimini tamamlamak istediğinize emin misiniz? Grup <strong style={{ color: "#6F7B87", fontWeight: 700 }}>Tamamlandı</strong> durumuna alınacaktır.
              </p>
            </div>
            <div style={{ display: "flex", gap: 11, padding: "16px 26px 22px", justifyContent: "flex-end" }}>
              <button onClick={() => setFinishId(null)} style={S.cancelBtn}>Vazgeç</button>
              <button onClick={confirmFinish} style={S.confirmFinishBtn}>
                <span dangerouslySetInnerHTML={{ __html: IC.checkWhite }} />
                Evet, bitir
              </button>
            </div>
          </div>
        </div>
      )}

      {reopenId !== null && (
        <div onClick={() => setReopenId(null)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.modal}>
            <div style={{ padding: "26px 26px 20px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: "#DDE8F8", display: "flex", alignItems: "center", justifyContent: "center", color: "#205297", marginBottom: 16 }}>
                <span dangerouslySetInnerHTML={{ __html: IC.undoBig }} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Grubu geri al</h3>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "#6F7B87" }}>
                <strong style={{ color: "#1E222B", fontWeight: 700 }}>{findGroup(reopenId)?.kod}</strong> grubunu tekrar <strong style={{ color: "#007A30", fontWeight: 700 }}>Aktif</strong> duruma almak istediğinize emin misiniz?
              </p>
            </div>
            <div style={{ display: "flex", gap: 11, padding: "16px 26px 22px", justifyContent: "flex-end" }}>
              <button onClick={() => setReopenId(null)} style={S.cancelBtn}>Vazgeç</button>
              <button onClick={confirmReopen} style={S.confirmStartBtn}>
                <span dangerouslySetInnerHTML={{ __html: IC.undoWhite }} />
                Evet, geri al
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId !== null && (
        <div onClick={() => setDeleteId(null)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.modal}>
            <div style={{ padding: "26px 26px 20px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: "#FFECEC", display: "flex", alignItems: "center", justifyContent: "center", color: "#D93636", marginBottom: 16 }}>
                <span dangerouslySetInnerHTML={{ __html: IC.trashBig }} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Grubu sil</h3>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "#6F7B87" }}>
                <strong style={{ color: "#1E222B", fontWeight: 700 }}>{findGroup(deleteId)?.kod}</strong> grubunu silmek üzeresiniz. Bu işlem geri alınamaz. Gruptaki öğrenciler ilgili branşta grupsuz duruma düşer.
              </p>
            </div>
            <div style={{ display: "flex", gap: 11, padding: "16px 26px 22px", justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteId(null)} style={S.cancelBtn}>Vazgeç</button>
              <button onClick={confirmDelete} style={S.confirmDelBtn}>
                <span dangerouslySetInnerHTML={{ __html: IC.trashWhite }} />
                Evet, sil
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{css}</style>
    </div>
  );
}

const filterBtnStyle = (active: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 9, border: "none",
  fontSize: 13.5, fontWeight: active ? 700 : 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s",
  color: active ? "#1E222B" : "#6F7B87", background: active ? "#fff" : "transparent",
  boxShadow: active ? "0 2px 6px -2px rgba(15,31,61,.2)" : "none",
  outline: active ? "1px solid #E2E5EA" : "none",
});

const viewBtnStyle = (active: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, border: "none",
  fontSize: 13, fontWeight: active ? 700 : 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s",
  color: active ? "#205297" : "#6F7B87", background: active ? "#EFF3FA" : "transparent",
  boxShadow: active ? "inset 0 0 0 1px #cfe0f5" : "none",
});

const pageBtnStyle = (active: boolean): CSSProperties => ({
  minWidth: 38, height: 38, padding: "0 12px", borderRadius: 10, fontWeight: active ? 700 : 600, fontSize: 14,
  fontFamily: "inherit", cursor: "pointer", border: active ? "1px solid #2867bd" : "1px solid #E2E5EA",
  background: active ? "#2867bd" : "#fff", color: active ? "#fff" : "#414B59",
  boxShadow: active ? "0 6px 14px -6px rgba(40,103,189,.55)" : "none",
});

const S: Record<string, CSSProperties> = {
  th: { padding: "14px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8E95A3", letterSpacing: ".05em", whiteSpace: "nowrap" },
  thFirst: { padding: "14px 10px 14px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8E95A3", letterSpacing: ".05em", whiteSpace: "nowrap" },
  thRight: { padding: "14px 16px 14px 10px", textAlign: "right" },
  td: { padding: "18px 10px", verticalAlign: "middle" },
  tdFirst: { padding: "18px 10px 18px 20px", verticalAlign: "middle" },
  tdRight: { padding: "18px 16px 18px 10px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" },
  startBtn: { display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "all .13s", whiteSpace: "nowrap" },
  editBtnIcon: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontFamily: "inherit", cursor: "pointer", transition: "all .13s", flex: "0 0 auto" },
  delBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#8E95A3", fontFamily: "inherit", cursor: "pointer", transition: "all .13s", flex: "0 0 auto" },
  cardItem: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: 18, boxShadow: "0 1px 3px rgba(15,31,61,.05)", transition: "all .15s", cursor: "pointer" },
  cardAvatar: { width: 40, height: 40, borderRadius: 11, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 },
  pageNav: { width: 38, height: 38, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" },
  overlay: { position: "fixed", inset: 0, zIndex: 90, background: "rgba(15,31,61,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden" },
  cancelBtn: { padding: "11px 18px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  confirmStartBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", background: "#007A30", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(0,122,48,.5)" },
  confirmFinishBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", background: "#414B59", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(65,75,89,.5)" },
  confirmDelBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", background: "#D93636", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(217,54,54,.6)" },
};

const sv = (inner: string, attrs = 'width="15" height="15" stroke="currentColor"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  listIcon: sv('<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>', 'width="17" height="17" stroke="currentColor" stroke-width="2"'),
  gridIcon: sv('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>', 'width="17" height="17" stroke="currentColor" stroke-width="2"'),
  chevLeftNav: sv('<path d="m15 18-6-6 6-6"/>', 'width="17" height="17" stroke="currentColor" stroke-width="2.2"'),
  chevRightNav: sv('<path d="m9 18 6-6-6-6"/>', 'width="17" height="17" stroke="currentColor" stroke-width="2.2"'),
  play: sv('<polygon points="6 3 20 12 6 21 6 3"/>', 'width="13" height="13" stroke="currentColor" fill="currentColor" stroke-width="1"'),
  playBig: sv('<polygon points="6 3 20 12 6 21 6 3"/>', 'width="24" height="24" stroke="currentColor" fill="currentColor" stroke-width="1"'),
  playWhite: sv('<polygon points="6 3 20 12 6 21 6 3"/>', 'width="16" height="16" stroke="#fff" fill="#fff" stroke-width="1"'),
  checkSm: sv('<path d="M20 6 9 17l-5-5"/>', 'width="13" height="13" stroke="currentColor" stroke-width="2.5"'),
  checkBig: sv('<path d="M20 6 9 17l-5-5"/>', 'width="24" height="24" stroke="currentColor" stroke-width="2.5"'),
  checkWhite: sv('<path d="M20 6 9 17l-5-5"/>', 'width="16" height="16" stroke="#fff" stroke-width="2.8"'),
  pencilSm: sv('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 'width="14" height="14" stroke="currentColor" stroke-width="2"'),
  trash: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', 'width="15" height="15" stroke="currentColor" stroke-width="2"'),
  trashBig: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', 'width="24" height="24" stroke="currentColor" stroke-width="2"'),
  trashWhite: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 'width="16" height="16" stroke="currentColor" stroke-width="2.2"'),
  undo: sv('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>', 'width="14" height="14" stroke="currentColor" stroke-width="2.2"'),
  undoBig: sv('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>', 'width="24" height="24" stroke="currentColor" stroke-width="2"'),
  undoWhite: sv('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>', 'width="16" height="16" stroke="#fff" stroke-width="2.2"'),
  mapPin: sv('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', 'width="15" height="15" stroke="#8E95A3" stroke-width="2"'),
  clockGray: sv('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', 'width="16" height="16" stroke="#8E95A3" stroke-width="2"'),
  calendarGray: sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>', 'width="15" height="15" stroke="#8E95A3" stroke-width="2"'),
  graduationBig: sv('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>', 'width="26" height="26" stroke="currentColor" stroke-width="1.8"'),
};

const css = `
.gt-trow:hover{background:#F7F8FA}
.gt-start-btn:hover:not(:disabled){border-color:#92b6e8;color:#205297;background:#EFF3FA}
.gt-edit-btn:hover{border-color:#92b6e8;color:#205297;background:#EFF3FA}
.gt-del-btn:hover{border-color:#F3B0B0;color:#D93636;background:#FFECEC}
.gt-card-item:hover{box-shadow:0 10px 26px -14px rgba(15,31,61,.28);transform:translateY(-2px)}
`;
