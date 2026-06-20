"use client";

/**
 * FlexOS · Öğrenciler — "Öğrenci Havuzu".
 * Tasarım: _design "Öğrenci Havuzu.dc.html" (Claude Design) React'e portlandı.
 * Katalog/Satış ile aynı desen: inline S/IC, Inter, authStateReady korumalı, FlexSidebar.
 *
 * MİMARİ: Havuz = enrollment listesi + filtre (ayrı koleksiyon değil). Bir satış
 * yapılınca createSale → Person + Enrollment oluşur ve kayıt buraya düşer.
 *
 * DURUM: Liste şu an DEMO veriyle dolu (görsel doğrulama için). Gerçek veri ayağı iki
 * işe bağlı ve sonraki etapta bağlanacak:
 *   1) GET /api/flexos/persons (enrollment/grup/branş read-time join) — henüz YOK.
 *   2) createSale (iş "B") — satış DB'ye yazınca havuz gerçek kayıtlarla dolar.
 * NOT: Tasarımdaki "Şube" ve 7 zengin durum, domain'de henüz birebir karşılığı olmayan
 *   alanlar — wiring adımında modele eklenecek/eşlenecek (bkz. FLEXOS.md Durum bloğu).
 */

import React, { useEffect, useMemo, useState, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";

// ── Durum & Branş sözlükleri (tasarımdan) ────────────────────────────────────
type StatusKey =
  | "beklemede" | "aktif" | "grupsuz" | "tekrar" | "mezun" | "pasif" | "donduruldu";

const ST: Record<StatusKey, { label: string; hint: string; color: string; background: string; dot: string }> = {
  beklemede: { label: "Beklemede", hint: "Ödeme bekleniyor", color: "#8A5A00", background: "#FFF3DC", dot: "#FFB020" },
  aktif: { label: "Aktif", hint: "Ödeme yapıldı", color: "#007A30", background: "#E6F5ED", dot: "#009F3E" },
  grupsuz: { label: "Grupsuz", hint: "Gruba atanmadı", color: "#205297", background: "#DDE8F8", dot: "#3A7BD5" },
  tekrar: { label: "Tekrar", hint: "Tekrar isteyen", color: "#652980", background: "#E6D1F0", dot: "#652980" },
  mezun: { label: "Mezun", hint: "Eğitimi tamamladı", color: "#285253", background: "#CBE6E6", dot: "#4FA3A5" },
  pasif: { label: "Pasif", hint: "Kaydı pasif", color: "#6F7B87", background: "#EEF0F3", dot: "#AEB4C0" },
  donduruldu: { label: "Donduruldu", hint: "Kayıt donduruldu", color: "#0E5D59", background: "#AFF3F0", dot: "#1CB5AE" },
};

const BRANS: Record<string, { color: string; background: string; dot: string }> = {
  Design: { color: "#B80E57", background: "#FED7E9", dot: "#F91079" },
  Finance: { color: "#0E5D59", background: "#AFF3F0", dot: "#1CB5AE" },
  Software: { color: "#4D52A6", background: "#DDE0FA", dot: "#6F74D8" },
};

const AV_PALETTES: Array<[string, string]> = [
  ["#689adf", "#2867bd"], ["#FFA352", "#FF7800"], ["#67B5B6", "#1CB5AE"], ["#8B91E6", "#4D52A6"], ["#F76FA3", "#F91079"],
];

const SUBE_LIST = ["Tümü", "Kadıköy", "Pendik", "Ümraniye", "Beşiktaş"];
const BRANS_LIST = ["Tümü", "Design", "Finance", "Software"];
const PAGE_SIZE = 8;

interface StudentGroup { label: string; branch: string }
interface Student {
  id: number; name: string; email: string; phone: string;
  status: StatusKey; sube: string; gender: string; branches: string[];
  groups: StudentGroup[]; // 0 = atanmadı · 1 = tek grup · 2+ = çoklu (sayı + hover)
}

// DEMO veri — gerçek GET /api/flexos/persons bağlanınca kaldırılacak.
const DEMO: Array<[string, string, string, StatusKey, string, string, string[]]> = [
  ["Elif Yıldız", "elif.yildiz@mail.com", "0532 418 22 71", "beklemede", "Kadıköy", "Kadın", ["Design", "Software"]],
  ["Mert Aksoy", "mert.aksoy@mail.com", "0541 903 18 44", "aktif", "Pendik", "Erkek", ["Software"]],
  ["Zeynep Kaya", "zeynep.kaya@mail.com", "0505 277 65 90", "grupsuz", "Ümraniye", "Kadın", ["Finance", "Design", "Software"]],
  ["Burak Demir", "burak.demir@mail.com", "0533 612 40 07", "tekrar", "Kadıköy", "Erkek", ["Software"]],
  ["Ayşe Şahin", "ayse.sahin@mail.com", "0544 190 73 28", "aktif", "Beşiktaş", "Kadın", ["Design", "Finance"]],
  ["Can Öztürk", "can.ozturk@mail.com", "0537 845 21 60", "beklemede", "Pendik", "Erkek", ["Finance"]],
  ["Selin Arslan", "selin.arslan@mail.com", "0531 408 99 13", "grupsuz", "Kadıköy", "Kadın", ["Software", "Design"]],
  ["Emre Çelik", "emre.celik@mail.com", "0542 736 50 82", "aktif", "Ümraniye", "Erkek", ["Design"]],
  ["Deniz Koç", "deniz.koc@mail.com", "0536 217 84 35", "tekrar", "Beşiktaş", "Kadın", ["Finance", "Software"]],
  ["Kaan Aydın", "kaan.aydin@mail.com", "0530 671 29 47", "beklemede", "Pendik", "Erkek", ["Software"]],
  ["Melisa Doğan", "melisa.dogan@mail.com", "0545 382 16 90", "aktif", "Kadıköy", "Kadın", ["Design", "Finance", "Software"]],
  ["Yusuf Polat", "yusuf.polat@mail.com", "0534 928 47 11", "pasif", "Beşiktaş", "Erkek", ["Finance"]],
  ["İrem Güneş", "irem.gunes@mail.com", "0539 165 73 28", "mezun", "Ümraniye", "Kadın", ["Software"]],
  ["Ozan Yılmaz", "ozan.yilmaz@mail.com", "0532 740 88 51", "tekrar", "Pendik", "Erkek", ["Design", "Software"]],
  ["Buse Kara", "buse.kara@mail.com", "0543 519 02 67", "donduruldu", "Kadıköy", "Kadın", ["Finance"]],
  ["Arda Şen", "arda.sen@mail.com", "0538 246 91 03", "grupsuz", "Beşiktaş", "Erkek", ["Software", "Finance"]],
  ["Ece Tunç", "ece.tunc@mail.com", "0531 873 64 29", "aktif", "Ümraniye", "Kadın", ["Design"]],
  ["Berk Acar", "berk.acar@mail.com", "0546 312 70 85", "tekrar", "Kadıköy", "Erkek", ["Finance", "Design"]],
  ["Naz Erdem", "naz.erdem@mail.com", "0535 690 41 72", "beklemede", "Pendik", "Kadın", ["Software"]],
  ["Tolga Bulut", "tolga.bulut@mail.com", "0540 127 53 96", "aktif", "Beşiktaş", "Erkek", ["Design", "Software", "Finance"]],
  ["Gizem Avcı", "gizem.avci@mail.com", "0533 458 19 04", "grupsuz", "Kadıköy", "Kadın", ["Finance"]],
  ["Onur Taş", "onur.tas@mail.com", "0544 802 36 51", "mezun", "Ümraniye", "Erkek", ["Software"]],
  ["Sıla Korkmaz", "sila.korkmaz@mail.com", "0537 219 75 48", "tekrar", "Pendik", "Kadın", ["Design", "Finance"]],
  ["Efe Yalçın", "efe.yalcin@mail.com", "0532 564 90 17", "donduruldu", "Beşiktaş", "Erkek", ["Finance"]],
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toLocaleUpperCase("tr");
}

export default function OgrenciHavuzuPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [students, setStudents] = useState<Student[]>([]);

  // applied filtreler
  const [statusFilter, setStatusFilter] = useState<StatusKey[]>([]);
  const [subeFilter, setSubeFilter] = useState("Tümü");
  const [bransFilter, setBransFilter] = useState("Tümü");
  // pending (Filtrele'ye basılana kadar)
  const [pStatus, setPStatus] = useState<StatusKey[]>([]);
  const [pSube, setPSube] = useState("Tümü");
  const [pBrans, setPBrans] = useState("Tümü");

  const [openDropdown, setOpenDropdown] = useState<null | "sube" | "brans">(null);
  const [hoveredBrans, setHoveredBrans] = useState<number | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      // DEMO doldur — gerçek GET burada çağrılacak.
      // Grup demo'su: aktif/tekrar/mezun olanın her branşı için bir grup üret (çoklu grubu görselleştirmek için).
      setStudents(DEMO.map((r, i) => {
        const id = i + 1;
        const status = r[3];
        const branches = r[6];
        const hasGroup = status === "aktif" || status === "tekrar" || status === "mezun";
        const groups: StudentGroup[] = hasGroup
          ? branches.map((b, bi) => ({ label: `Grup ${200 + ((id * 7 + bi * 13) % 90)}`, branch: b }))
          : [];
        return { id, name: r[0], email: r[1], phone: r[2], status, sube: r[4], gender: r[5], branches, groups };
      }));
    })();
  }, [router]);

  const togglePStatus = (k: StatusKey) =>
    setPStatus((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const toggleDropdown = (n: "sube" | "brans") => setOpenDropdown((o) => (o === n ? null : n));
  const applyFilters = () => {
    setStatusFilter([...pStatus]); setSubeFilter(pSube); setBransFilter(pBrans);
    setPage(1); setOpenDropdown(null);
  };
  const clearFilters = () => {
    setStatusFilter([]); setSubeFilter("Tümü"); setBransFilter("Tümü");
    setPStatus([]); setPSube("Tümü"); setPBrans("Tümü"); setPage(1); setOpenDropdown(null);
  };
  const soon = () => toast.info("Bu özellik yakında.");

  const filtered = useMemo(
    () => students.filter((st) => {
      if (statusFilter.length && !statusFilter.includes(st.status)) return false;
      if (subeFilter !== "Tümü" && st.sube !== subeFilter) return false;
      if (bransFilter !== "Tümü" && !st.branches.includes(bransFilter)) return false;
      return true;
    }),
    [students, statusFilter, subeFilter, bransFilter],
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const startIdx = (curPage - 1) * PAGE_SIZE;
  const pageStudents = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const anyFilter = pStatus.length > 0 || pSube !== "Tümü" || pBrans !== "Tümü";

  if (authed === null) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", background: "#EEF0F3" }}>
        <div className="oh-spin" />
        <style>{spinCss}</style>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <style>{globalCss}</style>
      <FlexSidebar active="ogrenci-havuzu" />

      {/* ============ MAIN ============ */}
      <main style={S.main}>
        {/* header */}
        <header style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <div style={S.headerIcon} dangerouslySetInnerHTML={{ __html: IC.headerUsers }} />
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.4px", color: "#1E222B" }}>Öğrenci Havuzu</h1>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6F7B87", fontWeight: 500 }}>Tüm öğrenci kayıtlarını filtreleyin ve gruplara atayın.</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <button className="oh-iconbtn" style={S.bellBtn} onClick={soon}>
              <span dangerouslySetInnerHTML={{ __html: IC.bell }} />
              <span style={S.bellDot} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 18, borderLeft: "1px solid #E2E5EA" }}>
              <div style={{ textAlign: "right", lineHeight: 1.3 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B" }}>Alparslan Şentürk</div>
                <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500 }}>Yönetici · Eğitmen</div>
              </div>
              <div style={S.avatar}>AŞ</div>
            </div>
          </div>
        </header>

        <div style={{ padding: "30px 36px 48px", maxWidth: 1480, margin: "0 auto" }}>
          {/* section header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", color: "#1E222B" }}>Öğrenci Havuzu</h2>
              <span style={S.countChip}>{total} öğrenci</span>
            </div>
          </div>

          {/* ============ FILTER PANEL ============ */}
          <div style={S.filterPanel}>
            {/* DURUM */}
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
              <span style={S.sectionLabel}>Durum</span>
              <div style={{ flex: 1, height: 1, background: "#EEF0F3" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 18 }}>
              {(Object.keys(ST) as StatusKey[]).map((k) => {
                const o = ST[k];
                const checked = pStatus.includes(k);
                return (
                  <div key={k} className="oh-chip" onClick={() => togglePStatus(k)} title={o.hint}
                    style={{ ...S.statusChip, border: checked ? "1.5px solid #2867bd" : "1.5px solid #E2E5EA", background: checked ? "#EFF3FA" : "#fff" }}>
                    <span style={{ ...S.statusCheck, border: checked ? "1.5px solid #2867bd" : "1.5px solid #CDD2DA", background: checked ? "#2867bd" : "#fff" }}>
                      {checked && <span dangerouslySetInnerHTML={{ __html: IC.checkWhite }} />}
                    </span>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: o.dot, flex: "0 0 auto" }} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "#414B59", whiteSpace: "nowrap" }}>{o.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Şube / Branş row */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
              {/* ŞUBE */}
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={S.sectionLabel}>Şube</span>
                <button className="oh-select" style={{ ...S.selectBtn, minWidth: 190 }} onClick={() => toggleDropdown("sube")}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.pin }} />{pSube}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: IC.chevDown }} />
                </button>
                {openDropdown === "sube" && (
                  <div style={{ ...S.dropdown, width: 200 }}>
                    {SUBE_LIST.map((v) => (
                      <div key={v} className="oh-ddrow" style={pSube === v ? S.ddActive : S.ddBase} onClick={() => { setPSube(v); setOpenDropdown(null); }}>
                        <span>{v}</span>
                        {pSube === v && <span dangerouslySetInnerHTML={{ __html: IC.checkBlue }} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* BRANŞ */}
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={S.sectionLabel}>Branş</span>
                <button className="oh-select" style={{ ...S.selectBtn, minWidth: 180 }} onClick={() => toggleDropdown("brans")}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.checkSmall }} />{pBrans}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: IC.chevDown }} />
                </button>
                {openDropdown === "brans" && (
                  <div style={{ ...S.dropdown, width: 200 }}>
                    {BRANS_LIST.map((v) => (
                      <div key={v} className="oh-ddrow" style={pBrans === v ? S.ddActive : S.ddBase} onClick={() => { setPBrans(v); setOpenDropdown(null); }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "0 0 auto", background: v === "Tümü" ? "#CDD2DA" : BRANS[v].dot }} />
                          {v}
                        </span>
                        {pBrans === v && <span dangerouslySetInnerHTML={{ __html: IC.checkBlue }} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 10 }} />

              {anyFilter && (
                <button className="oh-clear" style={S.clearBtn} onClick={clearFilters}>
                  <span dangerouslySetInnerHTML={{ __html: IC.x }} />
                  Temizle
                </button>
              )}

              <button className="oh-filter" style={S.filterBtn} onClick={applyFilters}>
                <span dangerouslySetInnerHTML={{ __html: IC.funnel }} />
                Filtrele
              </button>
            </div>
          </div>

          {/* ============ TABLE ============ */}
          <div style={S.tableCard}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                <thead>
                  <tr style={{ background: "#F7F8FA", borderBottom: "1px solid #EEF0F3" }}>
                    {["Ad", "Email", "Telefon", "Durum", "Şube", "Branş", "Grup"].map((h) => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                    <th style={{ ...S.th, textAlign: "right" }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {pageStudents.map((st) => {
                    const ss = ST[st.status];
                    const pal = AV_PALETTES[(st.id - 1) % AV_PALETTES.length];
                    const branchCount = st.branches.length;
                    const activeBrans = st.branches[0];
                    const groups = st.groups;
                    const hasGroup = groups.length > 0;
                    const groupCount = groups.length;
                    const popupOpen = hoveredBrans === st.id && branchCount > 1;
                    const groupPopupOpen = hoveredGroup === st.id && groupCount > 1;
                    return (
                      <tr key={st.id} className="oh-row" style={{ borderBottom: "1px solid #EEF0F3" }}>
                        <td style={S.cell}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ ...S.avatarSm, background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}>{initials(st.name)}</span>
                            <span style={{ fontSize: 14.5, fontWeight: 700, color: "#1E222B" }}>{st.name}</span>
                          </div>
                        </td>
                        <td style={S.cell}><span style={{ fontSize: 13.5, color: "#414B59", fontWeight: 500 }}>{st.email}</span></td>
                        <td style={S.cell}><span style={{ fontSize: 13.5, color: "#414B59", fontWeight: 600 }}>{st.phone}</span></td>
                        <td style={S.cell}>
                          <span style={{ ...S.statusBadge, color: ss.color, background: ss.background }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: ss.dot, flex: "0 0 auto" }} />
                            {ss.label}
                          </span>
                        </td>
                        <td style={S.cell}><span style={{ fontSize: 13.5, color: "#414B59", fontWeight: 600 }}>{st.sube}</span></td>
                        <td style={S.cell}>
                          <div
                            style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 9, cursor: "default" }}
                            onMouseEnter={() => setHoveredBrans(st.id)}
                            onMouseLeave={() => setHoveredBrans(null)}
                          >
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#414B59" }}>{activeBrans}</span>
                            {branchCount > 1 && <span style={S.branchBadge}>{branchCount}</span>}
                            {popupOpen && (
                              <div style={S.branchPopup}>
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em", padding: "4px 9px 7px" }}>
                                  Branşlar ({branchCount})
                                </div>
                                {st.branches.map((b, bi) => {
                                  const c = BRANS[b] ?? BRANS.Design;
                                  return (
                                    <div key={b} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 9px", borderRadius: 8, background: bi === 0 ? "#EFF3FA" : "transparent" }}>
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "0 0 auto", background: c.dot }} />
                                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "#414B59" }}>{b}</span>
                                      </span>
                                      {bi === 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "2px 7px", borderRadius: 999 }}>Aktif</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={S.cell}>
                          {groupCount === 0 ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#8E95A3", fontStyle: "italic", whiteSpace: "nowrap" }}>
                              <span dangerouslySetInnerHTML={{ __html: IC.alert }} />
                              Atanmadı
                            </span>
                          ) : groupCount === 1 ? (
                            <span style={S.groupChip}>
                              <span dangerouslySetInnerHTML={{ __html: IC.groupIcon }} />
                              {groups[0].label}
                            </span>
                          ) : (
                            <div
                              style={{ position: "relative", display: "inline-flex", cursor: "default" }}
                              onMouseEnter={() => setHoveredGroup(st.id)}
                              onMouseLeave={() => setHoveredGroup(null)}
                            >
                              <span style={S.groupChip}>
                                <span dangerouslySetInnerHTML={{ __html: IC.groupIcon }} />
                                {groupCount} Grup
                                <span style={S.branchBadge}>{groupCount}</span>
                              </span>
                              {groupPopupOpen && (
                                <div style={S.branchPopup}>
                                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em", padding: "4px 9px 7px" }}>
                                    Gruplar ({groupCount})
                                  </div>
                                  {groups.map((g) => {
                                    const c = BRANS[g.branch] ?? BRANS.Design;
                                    return (
                                      <div key={g.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "7px 9px", borderRadius: 8 }}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                                          <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "0 0 auto", background: c.dot }} />
                                          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B" }}>{g.label}</span>
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
                        <td style={{ ...S.cell, textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <button className="oh-detail" style={S.detailBtn} onClick={soon}>
                              <span dangerouslySetInnerHTML={{ __html: IC.eye }} />
                              Detay
                            </button>
                            <button
                              className={hasGroup ? undefined : "oh-assign"}
                              disabled={hasGroup}
                              title={hasGroup ? (groupCount === 1 ? `Zaten bir gruba atanmış (${groups[0].label})` : `Zaten ${groupCount} gruba atanmış`) : "Gruba ata"}
                              onClick={soon}
                              style={{ ...S.assignBtn, color: hasGroup ? "#CDD2DA" : "#414B59", cursor: hasGroup ? "not-allowed" : "pointer" }}
                            >
                              <span dangerouslySetInnerHTML={{ __html: IC.userPlus }} />
                              Gruba Ata
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* empty state */}
            {pageStudents.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px", textAlign: "center" }}>
                <div style={S.emptyIcon} dangerouslySetInnerHTML={{ __html: IC.searchBig }} />
                <div style={{ fontSize: 15.5, fontWeight: 700, color: "#414B59" }}>Sonuç bulunamadı</div>
                <div style={{ fontSize: 13.5, color: "#8E95A3", maxWidth: 320 }}>Seçili filtrelere uygun öğrenci yok. Filtreleri temizleyip tekrar deneyin.</div>
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
                  <button style={{ ...S.pageArrow, cursor: curPage > 1 ? "pointer" : "not-allowed", opacity: curPage > 1 ? 1 : 0.4 }} onClick={() => setPage(Math.max(1, curPage - 1))}>
                    <span dangerouslySetInnerHTML={{ __html: IC.chevLeft }} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} style={p === curPage ? S.pageCur : S.pageReg} onClick={() => setPage(p)}>{p}</button>
                  ))}
                  <button style={{ ...S.pageArrow, cursor: curPage < totalPages ? "pointer" : "not-allowed", opacity: curPage < totalPages ? 1 : 0.4 }} onClick={() => setPage(Math.min(totalPages, curPage + 1))}>
                    <span dangerouslySetInnerHTML={{ __html: IC.chevRight }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* click-away overlay */}
      {openDropdown && <div onClick={() => setOpenDropdown(null)} style={{ position: "fixed", inset: 0, zIndex: 15, background: "transparent" }} />}
    </div>
  );
}

// ── stiller ───────────────────────────────────────────────────────────────────
const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#1E222B", fontFamily: "'Inter', system-ui, sans-serif", background: "#EEF0F3" },
  main: { flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3" },
  header: { position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px 36px", background: "#fff", borderBottom: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" },
  headerIcon: { width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" },
  bellBtn: { position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59", transition: "all .14s" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#FF8D28,#D66500)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(214,101,0,.5)" },
  countChip: { fontSize: 12.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "3px 10px", borderRadius: 999 },
  filterPanel: { position: "relative", zIndex: 20, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 2px rgba(15,31,61,.04)", marginBottom: 18 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em" },
  statusChip: { display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, cursor: "pointer", transition: "all .14s" },
  statusCheck: { position: "relative", width: 17, height: 17, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  selectBtn: { display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 15px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  dropdown: { position: "absolute", top: "calc(100% + 8px)", left: 0, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, boxShadow: "0 18px 40px -12px rgba(15,31,61,.22)", padding: 8, zIndex: 60, animation: "oh-ddin .15s cubic-bezier(.2,.8,.3,1)" },
  ddBase: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: 500, color: "#414B59" },
  ddActive: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#205297", background: "#E2EAF3" },
  clearBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 14px", borderRadius: 11, border: "1px dashed #F3B0B0", background: "#fff", color: "#D93636", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  filterBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 22px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)", transition: "filter .14s" },
  tableCard: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" },
  th: { padding: "14px 24px", textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em" },
  cell: { padding: "15px 24px", verticalAlign: "middle" },
  avatarSm: { width: 36, height: 36, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12.5, fontWeight: 700 },
  statusBadge: { display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" },
  branchBadge: { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: "#fff", background: "#2867bd", boxShadow: "0 3px 8px -3px rgba(40,103,189,.55)", flex: "0 0 auto" },
  branchPopup: { position: "absolute", top: "calc(100% + 9px)", left: 0, minWidth: 172, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 12, boxShadow: "0 18px 40px -12px rgba(15,31,61,.26)", padding: 8, zIndex: 50, animation: "oh-ddin .14s cubic-bezier(.2,.8,.3,1)" },
  groupChip: { display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 8, background: "#f1f5f9", border: "1px solid #E2E5EA", fontSize: 13, fontWeight: 700, color: "#414B59", whiteSpace: "nowrap" },
  detailBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .13s" },
  assignBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: "none", background: "transparent", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all .13s" },
  emptyIcon: { width: 58, height: 58, borderRadius: 16, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" },
  pagination: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "16px 24px", borderTop: "1px solid #EEF0F3", background: "#F7F8FA" },
  pageArrow: { width: 38, height: 38, borderRadius: 10, border: "1px solid #e6e9f0", background: "#fff", color: "#414B59", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" },
  pageCur: { minWidth: 38, height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #2867bd", background: "#2867bd", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 6px 14px -6px rgba(40,103,189,.5)" },
  pageReg: { minWidth: 38, height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #e6e9f0", background: "#fff", color: "#414B59", fontWeight: 600, fontSize: 14, fontFamily: "inherit", cursor: "pointer" },
};

// ── ikonlar (lucide, design'dan birebir) ──────────────────────────────────────
const sv = (inner: string, attrs = 'width="19" height="19"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  headerUsers: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', 'width="23" height="23" stroke="#fff"'),
  bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 'width="20" height="20"'),
  pin: sv('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', 'width="16" height="16" stroke="#8E95A3"'),
  checkSmall: sv('<path d="M7.59 13.41 11 17l9-9"/><path d="M3 12l3.59 3.59"/>', 'width="16" height="16" stroke="#8E95A3"'),
  chevDown: sv('<path d="m6 9 6 6 6-6"/>', 'width="15" height="15" stroke="#8E95A3" stroke-width="2.3"'),
  checkWhite: sv('<path d="M20 6 9 17l-5-5"/>', 'width="11" height="11" stroke="#fff" stroke-width="3.4"'),
  checkBlue: sv('<path d="M20 6 9 17l-5-5"/>', 'width="15" height="15" stroke="#205297" stroke-width="3"'),
  x: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="14" height="14" stroke-width="2.3"'),
  funnel: sv('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>', 'width="17" height="17"'),
  groupIcon: sv('<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>', 'width="14" height="14" stroke="#6F7B87"'),
  alert: sv('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>', 'width="13" height="13"'),
  eye: sv('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>', 'width="15" height="15"'),
  userPlus: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>', 'width="15" height="15"'),
  searchBig: sv('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 'width="26" height="26" stroke-width="1.8"'),
  chevLeft: sv('<path d="m15 18-6-6 6-6"/>', 'width="17" height="17" stroke-width="2.2"'),
  chevRight: sv('<path d="m9 18 6-6-6-6"/>', 'width="17" height="17" stroke-width="2.2"'),
};

const spinCss = `.oh-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#2867bd;animation:oh-spin 1s linear infinite}@keyframes oh-spin{to{transform:rotate(360deg)}}`;
const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@keyframes oh-ddin{from{opacity:0;transform:translateY(-8px) scale(.985)}to{opacity:1;transform:none}}
.oh-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#2867bd;animation:oh-spin 1s linear infinite}@keyframes oh-spin{to{transform:rotate(360deg)}}
.oh-chip:hover{border-color:#CDD2DA}
.oh-select:hover{border-color:#CDD2DA;background:#F7F8FA}
.oh-clear:hover{background:#FFECEC}
.oh-filter:hover{filter:brightness(1.05)}
.oh-ddrow:hover{background:#F5F7FB}
.oh-row:hover{background:#F7F8FA}
.oh-iconbtn:hover{background:#F7F8FA;color:#1E222B}
.oh-detail:hover{border-color:#92b6e8;color:#2867bd;background:#EFF3FA}
.oh-assign:hover{color:#2867bd;background:#EFF3FA}
`;
