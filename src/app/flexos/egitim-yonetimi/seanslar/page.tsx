"use client";

/**
 * FlexOS · Eğitim Ayarları → Seans Yönetimi.
 * Grup açarken seçilebilecek seans kalıpları (gün + saat aralığı) burada yönetilir.
 * Şimdilik local state + dummy veri — ileride Firestore'a bağlanacak.
 */

import React, { useCallback, useEffect, useState, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";

/**
 * Seans veri modeli — yapısal (düz text değil).
 *   days: number[]   → 0=Pazartesi … 6=Pazar (ISO weekday - 1)
 *   startTime: string → "HH:MM" (24h)
 *   endTime:   string → "HH:MM" (24h)
 *
 * Sistem bu yapıyla:
 *   - Yoklama tarihini hesaplar (hangi gün ders var)
 *   - Eğitmen müsaitliğini kontrol eder (saat çakışması)
 *   - Takvimde doğru slot'u gösterir
 */
interface Seans {
  id: string;
  days: number[];       // 0=Pts, 1=Sal, 2=Çrş, 3=Prş, 4=Cum, 5=Cts, 6=Paz
  startTime: string;    // "HH:MM"
  endTime: string;      // "HH:MM"
}

// Gün sabitleri — index = veri değeri
const DAYS_META: { index: number; full: string; abbr: string }[] = [
  { index: 0, full: "Pazartesi", abbr: "Pts" },
  { index: 1, full: "Salı",     abbr: "Sal" },
  { index: 2, full: "Çarşamba", abbr: "Çrş" },
  { index: 3, full: "Perşembe", abbr: "Prş" },
  { index: 4, full: "Cuma",     abbr: "Cum" },
  { index: 5, full: "Cumartesi",abbr: "Cts" },
  { index: 6, full: "Pazar",    abbr: "Paz" },
];

/** days dizisini kısaltmalı gösterim metnine çevirir: "Pts - Çrş" */
function formatDays(days: number[]): string {
  return days.map((d) => DAYS_META[d]?.abbr ?? "?").join(" - ");
}

/** Seans'ın tek satırlık gösterim etiketi: "Pts - Çrş · 19:00 - 21:30" */
function seansLabel(s: Seans): string {
  return `${formatDays(s.days)} · ${s.startTime} - ${s.endTime}`;
}

const DUMMY_SEANSLAR: Seans[] = [
  { id: "1", days: [0, 2],    startTime: "19:00", endTime: "21:30" },
  { id: "2", days: [1, 3],    startTime: "19:00", endTime: "21:30" },
  { id: "3", days: [5, 6],    startTime: "09:00", endTime: "12:00" },
  { id: "4", days: [5, 6],    startTime: "12:00", endTime: "15:00" },
  { id: "5", days: [5, 6],    startTime: "09:00", endTime: "14:00" },
  { id: "6", days: [5, 6],    startTime: "14:00", endTime: "19:00" },
];

let nextId = 7;

export default function SeanslarPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [seanslar, setSeanslar] = useState<Seans[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // form state
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchSeanslar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/flexos/seanslar", { headers: await authHeaders() });
      const json = res.ok ? await res.json() : { items: [] };
      setSeanslar(json.items ?? []);
    } catch { toast.error("Seanslar yüklenemedi."); }
    finally { setLoading(false); }
  }, [authHeaders]);

  useEffect(() => {
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      await fetchSeanslar();
    })();
  }, [router, fetchSeanslar]);

  const toggleDay = (idx: number) =>
    setSelectedDays((prev) => prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx].sort((a, b) => a - b));

  const handleAdd = async () => {
    if (selectedDays.length === 0) { toast.error("En az bir gün seçin."); return; }
    if (!startTime || !endTime) { toast.error("Başlangıç ve bitiş saati girin."); return; }
    if (startTime >= endTime) { toast.error("Bitiş saati başlangıçtan sonra olmalı."); return; }
    setSaving(true);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch("/api/flexos/seanslar", {
        method: "POST", headers,
        body: JSON.stringify({ days: selectedDays, startTime, endTime }),
      });
      if (!res.ok) { const e = await res.json(); toast.error(e.error ?? "Kayıt başarısız."); return; }
      setSelectedDays([]);
      setStartTime("");
      setEndTime("");
      toast.success("Seans eklendi.");
      await fetchSeanslar();
    } catch { toast.error("Bir hata oluştu."); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/seanslar?id=${deleteId}`, { method: "DELETE", headers });
      if (!res.ok) { toast.error("Silinemedi."); return; }
      setDeleteId(null);
      toast.success("Seans silindi.");
      await fetchSeanslar();
    } catch { toast.error("Bir hata oluştu."); }
  };

  if (authed === null) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", background: "#EEF0F3" }}>
        <div className="sn-spin" />
        <style>{globalCss}</style>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <style>{globalCss}</style>
      <FlexSidebar active="ayarlar" />

      <main style={S.main}>
        <FlexHeader
          icon={<span dangerouslySetInnerHTML={{ __html: IC.clock }} />}
          title="Seans Yönetimi"
          subtitle="Grup açarken kullanılacak seans kalıplarını yönetin."
          roleLabel="Yönetici · Eğitmen"
        />

        <div style={{ padding: "30px 36px 48px", maxWidth: 1920, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>
          {/* Yeni Seans Ekle */}
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span style={S.cardIcon} dangerouslySetInnerHTML={{ __html: IC.plus }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: "#1E222B" }}>Yeni seans ekle</span>
            </div>

            {/* Gün seçimi */}
            <div style={{ marginBottom: 18 }}>
              <span style={S.lbl}>Günler</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {DAYS_META.map((dm) => {
                  const on = selectedDays.includes(dm.index);
                  return (
                    <button key={dm.index} className="sn-day" onClick={() => toggleDay(dm.index)}
                      style={{ ...S.dayChip, border: on ? "1.5px solid #2867bd" : "1.5px solid #E2E5EA", background: on ? "#EFF3FA" : "#fff", color: on ? "#205297" : "#414B59", fontWeight: on ? 700 : 500 }}>
                      {on && <span dangerouslySetInnerHTML={{ __html: IC.checkSm }} />}
                      {dm.full}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Saat aralığı */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 20 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={S.lbl}>Başlangıç</span>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={S.inp} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={S.lbl}>Bitiş</span>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={S.inp} />
              </label>
              <button className="sn-add" onClick={handleAdd} style={S.addBtn}>
                <span dangerouslySetInnerHTML={{ __html: IC.plusWhite }} />
                Seans ekle
              </button>
            </div>
          </div>

          {/* Mevcut Seanslar */}
          <div style={{ ...S.card, marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#1E222B" }}>Mevcut seanslar</span>
              <span style={S.countChip}>{seanslar.length} seans</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {seanslar.map((s) => (
                <div key={s.id} className="sn-item" style={S.seansItem}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1E222B", marginBottom: 4 }}>{formatDays(s.days)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={S.timeChip}>
                        <span dangerouslySetInnerHTML={{ __html: IC.clockSm }} />
                        {s.startTime} - {s.endTime}
                      </span>
                    </div>
                  </div>
                  <button className="sn-del" onClick={() => setDeleteId(s.id)} style={S.delBtn} title="Sil">
                    <span dangerouslySetInnerHTML={{ __html: IC.trash }} />
                  </button>
                </div>
              ))}
            </div>

            {seanslar.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#8E95A3", fontSize: 14 }}>
                Henüz seans eklenmemiş.
              </div>
            )}
          </div>
        </div>
        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>

      {/* Silme onay modal */}
      {deleteId && (
        <div style={S.overlay} onClick={() => setDeleteId(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <span style={{ width: 42, height: 42, borderRadius: 12, background: "#FEE2E2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: IC.alertTriangle }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: "#1E222B" }}>Seansı sil</span>
            </div>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#6F7B87", lineHeight: 1.5 }}>
              Bu seansı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="sn-cancel" onClick={() => setDeleteId(null)} style={S.cancelBtn}>Vazgeç</button>
              <button className="sn-confirm" onClick={handleDelete} style={S.confirmBtn}>Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── stiller ──
const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#1E222B", fontFamily: "'Inter', system-ui, sans-serif", background: "#EEF0F3" },
  main: { flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" },
  header: { position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px max(36px, calc((100% - 1920px) / 2 + 36px))", background: "#fff", borderBottom: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" },
  headerIcon: { width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" },
  bellBtn: { position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59", transition: "all .14s" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#FF8D28,#D66500)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(214,101,0,.5)" },
  card: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, padding: "24px 28px", boxShadow: "0 1px 3px rgba(15,31,61,.05)" },
  cardIcon: { width: 36, height: 36, borderRadius: 10, background: "#EFF3FA", color: "#2867bd", display: "flex", alignItems: "center", justifyContent: "center" },
  lbl: { fontSize: 12, fontWeight: 700, color: "#6F7B87", letterSpacing: ".03em" },
  dayChip: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", transition: "all .14s" },
  inp: { padding: "11px 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", width: 140 },
  addBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)", transition: "filter .14s" },
  countChip: { fontSize: 12.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "3px 10px", borderRadius: 999 },
  seansItem: { display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 14, border: "1px solid #EEF0F3", background: "#FAFBFC", transition: "all .14s" },
  timeChip: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#6F7B87", background: "#EEF0F3", padding: "4px 10px", borderRadius: 8 },
  delBtn: { width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#8E95A3", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "0 0 auto", transition: "all .14s" },
  overlay: { position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,31,61,.45)", display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#fff", borderRadius: 20, padding: "28px 30px", width: 400, maxWidth: "90vw", boxShadow: "0 24px 60px -20px rgba(15,31,61,.4)" },
  cancelBtn: { padding: "10px 18px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  confirmBtn: { padding: "10px 18px", borderRadius: 11, border: "none", background: "#DC2626", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 6px 14px -6px rgba(220,38,38,.5)" },
};

// ── ikonlar ──
const sv = (inner: string, attrs = 'width="19" height="19"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  clock: sv('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', 'width="23" height="23" stroke="#fff" stroke-width="2"'),
  clockSm: sv('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', 'width="14" height="14" stroke="#8E95A3" stroke-width="2"'),
  bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 'width="20" height="20"'),
  plus: sv('<line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>', 'width="18" height="18" stroke="#2867bd" stroke-width="2.2"'),
  plusWhite: sv('<line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>', 'width="16" height="16" stroke="#fff" stroke-width="2.5"'),
  checkSm: sv('<path d="M20 6 9 17l-5-5"/>', 'width="13" height="13" stroke="#205297" stroke-width="2.8"'),
  trash: sv('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>', 'width="16" height="16" stroke-width="2"'),
  alertTriangle: sv('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>', 'width="22" height="22" stroke="#DC2626" stroke-width="2"'),
};

const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
.sn-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#2867bd;animation:sn-spin 1s linear infinite}@keyframes sn-spin{to{transform:rotate(360deg)}}
.sn-iconbtn:hover{background:#F7F8FA;color:#1E222B}
.sn-day:hover{border-color:#CDD2DA!important}
.sn-add:hover{filter:brightness(1.07)}
.sn-item:hover{border-color:#CDD2DA;background:#fff}
.sn-del:hover{border-color:#F3B0B0;color:#DC2626;background:#FEF2F2}
.sn-cancel:hover{background:#F7F8FA}
.sn-confirm:hover{filter:brightness(1.08)}
input:focus{border-color:#a5b4fc!important;background:#fff!important;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
`;
