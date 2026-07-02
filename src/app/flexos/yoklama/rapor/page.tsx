"use client";

/**
 * FlexOS · Yoklama Raporu — `/flexos/yoklama/rapor`.
 * Eğitim Op + Finans + Admin (gated `attendance.report.read`, backend zaten
 * `GET /api/flexos/attendance/report`de vardı — bu sadece görüntüleme sayfası).
 * Eğitmende YOK (2026-07-02 kararı).
 *
 * İki bölüm:
 *  1) Eğitmen Bazlı Özet — seçili ayda eğitmen başına toplam ders+saat (Finans'ın
 *     hakediş hesabı için ham girdi — çarpım/hourlyRate burada YOK, ayrı iş).
 *  2) Kayıtlar — ham+join'li liste (Op'un sınıf durumu takibi için).
 *
 * Diğer FlexOS ayarlar sayfalarıyla aynı desen: inline S/IC, FlexSidebar, Inter.
 */

import React, { useEffect, useState, useCallback, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";

interface ReportItem {
  id: string;
  groupId: string;
  groupCode: string;
  educationName: string;
  branch: string;
  trainerId: string;
  trainerName: string;
  date: string;
  month: string;
  sessionHours: number;
  totalHours: number;
  studentCount: number;
  attendanceClosed: boolean;
}
interface GroupOption { id: string; code: string; }
interface TrainerOption { id: string; name: string; }

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtTr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default function YoklamaRaporuPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState(currentMonth());
  const [groupId, setGroupId] = useState("");
  const [trainerId, setTrainerId] = useState("");

  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [items, setItems] = useState<ReportItem[]>([]);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      if (groupId) params.set("groupId", groupId);
      if (trainerId) params.set("trainerId", trainerId);
      const res = await fetch(`/api/flexos/attendance/report?${params.toString()}`, { headers });
      if (res.status === 403) { setForbidden(true); return; }
      const json = res.ok ? await res.json() : { items: [] };
      setItems(json.items ?? []);
    } catch (e) {
      console.error("[yoklama-raporu] yüklenemedi:", e);
      toast.error("Rapor yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [month, groupId, trainerId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      if (cancelled) return;
      setAuthed(true);
      const headers = await authHeaders();
      const [gRes, tRes] = await Promise.all([
        fetch("/api/flexos/groups", { headers }),
        fetch("/api/flexos/trainers", { headers }),
      ]);
      if (gRes.ok) { const j = await gRes.json(); setGroups((j.items ?? []).map((g: { id: string; code: string }) => ({ id: g.id, code: g.code }))); }
      if (tRes.ok) { const j = await tRes.json(); setTrainers((j.items ?? []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))); }
      await load();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  if (authed === null) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", background: "#eef2f8" }}>
        <div className="yr-spin" />
        <style>{globalCss}</style>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div style={S.root}>
        <style>{globalCss}</style>
        <FlexSidebar active="yoklama-raporu" />
        <main style={{ ...S.main, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: "#64748b" }}>Bu sayfayı görüntüleme yetkin yok.</p>
        </main>
      </div>
    );
  }

  // Eğitmen bazlı özet — client-side aggregate.
  const summary = new Map<string, { name: string; records: number; hours: number }>();
  for (const it of items) {
    const key = it.trainerId || "—";
    const cur = summary.get(key) ?? { name: it.trainerName || "Atanmamış", records: 0, hours: 0 };
    cur.records += 1;
    cur.hours += it.totalHours;
    summary.set(key, cur);
  }
  const summaryRows = [...summary.entries()].sort((a, b) => b[1].hours - a[1].hours);

  return (
    <div style={S.root}>
      <style>{globalCss}</style>
      <FlexSidebar active="yoklama-raporu" />

      <main style={S.main}>
        <header style={S.header}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>
              <span>Yoklama</span>
              <span style={{ color: "#4338ca" }}>Rapor</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: "-.5px", color: "#0f1f3d" }}>Yoklama Raporu</h1>
          </div>
        </header>

        <div style={{ padding: "30px 36px 48px", maxWidth: 1100, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "#64748b", fontWeight: 500 }}>
            Sınıf durumu takibi (Eğitim Op) + eğitmen bazlı ders saati özeti (Finans hakediş kaynağı — hesaplama burada değil, ham veri).
          </p>

          {/* Filtreler */}
          <div style={{ ...S.card, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={S.label}>Ay</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Grup</label>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={{ ...S.input, minWidth: 160 }}>
                <option value="">Tüm gruplar</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.code}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Eğitmen</label>
              <select value={trainerId} onChange={(e) => setTrainerId(e.target.value)} style={{ ...S.input, minWidth: 160 }}>
                <option value="">Tüm eğitmenler</option>
                {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {(groupId || trainerId) && (
              <button onClick={() => { setGroupId(""); setTrainerId(""); }} style={S.clearBtn}>Filtreleri Temizle</button>
            )}
          </div>

          {/* Eğitmen Bazlı Özet */}
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <div style={S.sectionHeader}><span style={{ fontSize: 14.5, fontWeight: 700, color: "#0f1f3d" }}>Eğitmen Bazlı Özet</span></div>
            {summaryRows.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 13, color: "#94a3b8" }}>{loading ? "Yükleniyor…" : "Kayıt yok."}</div>
            ) : (
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Eğitmen</th>
                    <th style={S.th}>Ders Sayısı</th>
                    <th style={S.th}>Toplam Saat</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map(([key, row]) => (
                    <tr key={key}>
                      <td style={S.td}>{row.name}</td>
                      <td style={S.td}>{row.records}</td>
                      <td style={{ ...S.td, fontWeight: 700 }}>{row.hours} saat</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Kayıtlar */}
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <div style={S.sectionHeader}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: "#0f1f3d" }}>Kayıtlar</span>
              <span style={S.countChip}>{items.length}</span>
            </div>
            {items.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 13, color: "#94a3b8" }}>{loading ? "Yükleniyor…" : "Bu filtrelerde kayıt yok."}</div>
            ) : (
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Tarih</th>
                    <th style={S.th}>Grup</th>
                    <th style={S.th}>Eğitim</th>
                    <th style={S.th}>Eğitmen</th>
                    <th style={S.th}>Saat</th>
                    <th style={S.th}>Öğrenci</th>
                    <th style={S.th}>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td style={S.td}>{fmtTr(it.date)}</td>
                      <td style={S.td}>{it.groupCode}</td>
                      <td style={S.td}>{it.educationName || "—"}</td>
                      <td style={S.td}>{it.trainerName || "—"}</td>
                      <td style={S.td}>{it.totalHours} saat</td>
                      <td style={S.td}>{it.studentCount}</td>
                      <td style={S.td}>
                        <span style={it.attendanceClosed ? S.badgeClosed : S.badgeOpen}>{it.attendanceClosed ? "Kapalı" : "Açık"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#0f172a", fontFamily: "'Inter', system-ui, sans-serif", background: "#eef2f8" },
  main: { flex: 1, height: "100%", overflowY: "auto", background: "#eef2f8" },
  header: { position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px max(36px, calc((100% - 1100px) / 2 + 36px))", background: "rgba(238,242,248,.85)", backdropFilter: "blur(10px)", borderBottom: "1px solid #e2e8f1" },
  card: { background: "#fff", border: "1px solid #e9edf4", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(15,31,61,.05)", marginBottom: 18 },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #eef1f6", background: "#fafbfd" },
  label: { display: "block", fontSize: 11.5, fontWeight: 700, color: "#64748b", marginBottom: 5, marginLeft: 2 },
  input: { padding: "10px 13px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14, fontFamily: "inherit", color: "#1e293b", outline: "none", height: 40, boxSizing: "border-box" },
  clearBtn: { height: 40, padding: "0 16px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#fff", color: "#64748b", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  countChip: { fontSize: 12.5, fontWeight: 700, color: "#4338ca", background: "#e8ecfd", padding: "3px 10px", borderRadius: 999 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px 20px", fontSize: 11.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".02em", borderBottom: "1px solid #eef1f6" },
  td: { padding: "12px 20px", fontSize: 13.5, color: "#1e293b", borderBottom: "1px solid #f5f7fa" },
  badgeOpen: { display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: "#0369a1", background: "#e0f2fe" },
  badgeClosed: { display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: "#15803d", background: "#dcfce7" },
};

const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@keyframes yr-spin{to{transform:rotate(360deg)}}
.yr-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#4338ca;animation:yr-spin 1s linear infinite}
`;
