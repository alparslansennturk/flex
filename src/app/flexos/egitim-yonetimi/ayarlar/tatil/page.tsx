"use client";

/**
 * FlexOS · Eğitim Yönetimi → Eğitim Ayarları → Senelik Tatiller.
 * Canlıdaki `GroupBranchPanel.tsx` "Tatiller & İptaller" bölümünden örnek alındı
 * (ad + başlangıç/bitiş, ekle/düzenle/sil). Ayrı koleksiyon (`flexos_holidays`),
 * canlıdaki `holidays`'e dokunmaz. Yoklama takvimi bu listeyi okuyup o günleri
 * bloklar (GET /api/flexos/holidays, `AttendanceCore.tsx`).
 *
 * Veri: POST/GET /api/flexos/holidays + PATCH/DELETE /api/flexos/holidays/[id]
 * (yazma `holiday.manage` gated). Branş Havuzu ile aynı desen: inline S/IC, Inter.
 */

import React, { useEffect, useState, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../../_components/FlexSidebar";
import FlexHeader from "../../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";

interface HolidayDoc {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

function dayCount(h: HolidayDoc): number {
  const s = new Date(`${h.startDate}T00:00:00`).getTime();
  const e = new Date(`${h.endDate}T00:00:00`).getTime();
  return Math.round((e - s) / 86400000) + 1;
}
function fmtTr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default function TatilGunleriPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<HolidayDoc[]>([]);

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const authHeaders = async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  };

  const load = async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/holidays", { headers });
      const json = res.ok ? await res.json() : { items: [] };
      setHolidays((json.items ?? []).sort((a: HolidayDoc, b: HolidayDoc) => a.startDate.localeCompare(b.startDate)));
    } catch (e) {
      console.error("[tatil] yüklenemedi:", e);
      toast.error("Tatil listesi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      if (!cancelled) { setAuthed(true); await load(); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const addHoliday = async () => {
    const ad = name.trim();
    if (!ad || !startDate || saving) return;
    setSaving(true);
    try {
      const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
      const res = await fetch("/api/flexos/holidays", {
        method: "POST", headers,
        body: JSON.stringify({ name: ad, startDate, endDate: endDate || startDate }),
      });
      if (res.status === 201) {
        toast.success(`“${ad}” eklendi.`);
        setName(""); setStartDate(""); setEndDate("");
        await load();
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Tatil eklenemedi.");
      }
    } catch (e) {
      console.error("[tatil] eklenemedi:", e);
      toast.error("Tatil eklenemedi.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (h: HolidayDoc) => {
    setEditingId(h.id); setEditName(h.name); setEditStart(h.startDate); setEditEnd(h.endDate);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim() || !editStart) return;
    try {
      const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
      const res = await fetch(`/api/flexos/holidays/${editingId}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ name: editName.trim(), startDate: editStart, endDate: editEnd || editStart }),
      });
      if (res.ok) { setEditingId(null); await load(); }
      else { const j = await res.json().catch(() => ({})); toast.error(j.error || "Güncellenemedi."); }
    } catch (e) {
      console.error("[tatil] güncellenemedi:", e);
      toast.error("Güncellenemedi.");
    }
  };

  const removeHoliday = async (id: string) => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/holidays/${id}`, { method: "DELETE", headers });
      if (res.ok) await load();
      else toast.error("Silinemedi.");
    } catch (e) {
      console.error("[tatil] silinemedi:", e);
      toast.error("Silinemedi.");
    }
  };

  if (authed === null) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", background: "#eef2f8" }}>
        <div className="th-spin" />
        <style>{globalCss}</style>
      </div>
    );
  }

  const canAdd = name.trim().length > 0 && !!startDate && !saving;
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div style={S.root}>
      <style>{globalCss}</style>

      <FlexSidebar active="ayarlar" />

      <main style={S.main}>
        <FlexHeader
          left={
            <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
              <a className="th-iconbtn" style={S.backBtn} title="Eğitim Ayarları'na dön" onClick={() => router.push("/flexos/egitim-yonetimi/ayarlar")}>
                <span dangerouslySetInnerHTML={{ __html: IC.back }} />
              </a>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>
                  <span>Eğitim Yönetimi</span>
                  <span style={{ display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.crumb }} />
                  <span>Eğitim Ayarları</span>
                  <span style={{ display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.crumb }} />
                  <span style={{ color: "#c2410c" }}>Senelik Tatiller</span>
                </div>
                <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: "-.5px", color: "#0f1f3d" }}>Senelik Tatiller</h1>
              </div>
            </div>
          }
        />

        <div style={{ padding: "30px 36px 48px", maxWidth: 760, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>
          <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "#64748b", fontWeight: 500 }}>
            Resmî tatiller ve kurum kapanışları. Bu günlerde tüm gruplar için yoklama devre dışı kalır.
            Tek bir dersin anlık iptali için Yoklama panelindeki &quot;Ders Olmadı&quot; butonunu kullanın.
          </p>

          {/* Tatil Ekle */}
          <div style={S.card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 11, letterSpacing: ".01em" }}>YENİ TATİL EKLE</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={S.label}>Tatil Adı</label>
                <input className="th-input" type="text" value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addHoliday(); }}
                  placeholder="Örn: Kurban Bayramı" style={{ ...S.input, width: "100%" }} />
              </div>
              <div>
                <label style={S.label}>Başlangıç</label>
                <input className="th-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Bitiş (tek günse boş)</label>
                <input className="th-input" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} style={S.input} />
              </div>
              <button onClick={addHoliday} disabled={!canAdd} style={addBtnStyle(canAdd)}>
                <span dangerouslySetInnerHTML={{ __html: IC.plus }} />
                {saving ? "Ekleniyor…" : "Ekle"}
              </button>
            </div>
          </div>

          {/* Liste */}
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #eef1f6", background: "#fafbfd" }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: "#0f1f3d" }}>Tatiller</span>
              <span style={S.countChip}>{holidays.length}</span>
            </div>
            {holidays.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, padding: "48px 20px", textAlign: "center" }}>
                <div style={S.emptyIcon} dangerouslySetInnerHTML={{ __html: IC.calendarBig }} />
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "#334155" }}>{loading ? "Yükleniyor…" : "Henüz tatil eklenmedi"}</div>
                <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 320 }}>
                  {loading ? "Tatil listesi getiriliyor." : "Yukarıdan ilk tatili ekleyin; yoklama takvimi otomatik atlar."}
                </div>
              </div>
            ) : (
              <div>
                {holidays.map((h, i, arr) => {
                  const isPast = h.endDate < todayStr;
                  const isActive = h.startDate <= todayStr && h.endDate >= todayStr;
                  const isEditing = editingId === h.id;
                  return (
                    <div key={h.id} className="th-row" style={{ padding: "14px 20px", borderBottom: i < arr.length - 1 ? "1px solid #f1f4f9" : "none", opacity: isPast ? 0.55 : 1 }}>
                      {isEditing ? (
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 160 }}>
                            <label style={S.label}>Tatil Adı</label>
                            <input className="th-input" type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }} style={{ ...S.input, width: "100%" }} />
                          </div>
                          <div>
                            <label style={S.label}>Başlangıç</label>
                            <input className="th-input" type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} style={S.input} />
                          </div>
                          <div>
                            <label style={S.label}>Bitiş</label>
                            <input className="th-input" type="date" value={editEnd} min={editStart || undefined} onChange={(e) => setEditEnd(e.target.value)} style={S.input} />
                          </div>
                          <button onClick={saveEdit} style={addBtnStyle(true)}>Kaydet</button>
                          <button onClick={() => setEditingId(null)} style={S.cancelBtn}>Vazgeç</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                          <span style={{ ...S.rowIcon, color: isActive ? "#c2410c" : "#64748b", background: isActive ? "#ffedd5" : "#f1f5f9" }}>
                            <span style={{ width: 9, height: 9, borderRadius: "50%", background: isActive ? "#f97316" : "#94a3b8" }} />
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1e293b" }}>{h.name}</div>
                            <div style={{ fontSize: 12.5, color: "#94a3b8", fontWeight: 500 }}>
                              {fmtTr(h.startDate)}{h.startDate !== h.endDate && <> — {fmtTr(h.endDate)}</>}
                              {" · "}{dayCount(h)} gün
                            </div>
                          </div>
                          <button onClick={() => startEdit(h)} style={S.iconBtnSmall} title="Düzenle">
                            <span dangerouslySetInnerHTML={{ __html: IC.edit }} />
                          </button>
                          <button onClick={() => removeHoliday(h.id)} style={S.iconBtnSmallDanger} title="Sil">
                            <span dangerouslySetInnerHTML={{ __html: IC.trash }} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <Footer mini />
      </main>
    </div>
  );
}

const addBtnStyle = (enabled: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, border: "none",
  fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", height: 40,
  cursor: enabled ? "pointer" : "not-allowed",
  background: enabled ? "#c2410c" : "#e8edf4", color: enabled ? "#fff" : "#a9b4c4",
  boxShadow: enabled ? "0 6px 14px -7px rgba(194,65,12,.6)" : "none",
});

const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#0f172a", fontFamily: "'Inter', system-ui, sans-serif", background: "#eef2f8" },
  main: { flex: 1, height: "100%", overflowY: "auto", background: "#eef2f8", display: "flex", flexDirection: "column" },
  header: { position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px max(36px, calc((100% - 760px) / 2 + 36px))", background: "rgba(238,242,248,.85)", backdropFilter: "blur(10px)", borderBottom: "1px solid #e2e8f1" },
  backBtn: { width: 46, height: 46, borderRadius: 13, border: "1px solid #e2e8f1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", textDecoration: "none", transition: "all .14s" },
  card: { background: "#fff", border: "1px solid #e9edf4", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(15,31,61,.05)", marginBottom: 18 },
  label: { display: "block", fontSize: 11.5, fontWeight: 700, color: "#64748b", marginBottom: 5, marginLeft: 2 },
  input: { padding: "10px 13px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14, fontFamily: "inherit", color: "#1e293b", outline: "none", height: 40, boxSizing: "border-box" },
  countChip: { fontSize: 12.5, fontWeight: 700, color: "#9a3412", background: "#ffedd5", padding: "3px 10px", borderRadius: 999 },
  rowIcon: { width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  emptyIcon: { width: 54, height: 54, borderRadius: 15, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" },
  cancelBtn: { height: 40, padding: "0 16px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#fff", color: "#64748b", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer" },
  iconBtnSmall: { width: 34, height: 34, borderRadius: 9, border: "1px solid #e3e8f0", background: "#fff", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "0 0 auto" },
  iconBtnSmallDanger: { width: 34, height: 34, borderRadius: 9, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "0 0 auto" },
};

const sv = (inner: string, attrs = 'width="19" height="19"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  back: sv('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', 'width="21" height="21" stroke-width="2.1"'),
  crumb: sv('<path d="m9 18 6-6-6-6"/>', 'width="13" height="13" stroke="#94a3b8" stroke-width="2.3"'),
  plus: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="17" height="17" stroke-width="2.4"'),
  edit: sv('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>', 'width="15" height="15" stroke-width="2"'),
  trash: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 'width="15" height="15" stroke-width="2"'),
  calendarBig: sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>', 'width="24" height="24" stroke-width="1.8"'),
};

const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@keyframes th-spin{to{transform:rotate(360deg)}}
.th-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#c2410c;animation:th-spin 1s linear infinite}
.th-iconbtn:hover{background:#f8fafc;color:#0f172a}
.th-input:focus{border-color:#fdba74;background:#fff;box-shadow:0 0 0 3px rgba(249,115,22,.12)}
.th-row:hover{background:#f9fafc}
`;
