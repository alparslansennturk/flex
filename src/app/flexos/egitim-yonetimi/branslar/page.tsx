"use client";

/**
 * FlexOS · Eğitim Yönetimi → Branş Havuzu.
 * Branşlar buradan tek merkezden tanımlanır; "Eğitim Ekle" formundaki branş
 * dropdown'ı bu havuzdan (GET /api/flexos/branches) beslenir.
 *
 * Veri: GET + POST /api/flexos/branches (gated `branch.create`, kiracı filtreli).
 * Aynı katalog deseni: inline S/IC, Inter, authStateReady korumalı.
 */

import React, { useEffect, useState, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";

interface BranchDoc {
  id: string;
  name: string;
  order?: number;
}

// Branş renk paleti — sıraya göre atanır (katalogla aynı).
const PALETTE = [
  { color: "#be185d", background: "#fce7f3", dot: "#ec4899" },
  { color: "#4338ca", background: "#e6e9ff", dot: "#6366f1" },
  { color: "#c2410c", background: "#ffedd5", dot: "#f97316" },
  { color: "#0369a1", background: "#e0f2fe", dot: "#0ea5e9" },
  { color: "#15803d", background: "#dcfce7", dot: "#22c55e" },
  { color: "#7c3aed", background: "#ede9fe", dot: "#8b5cf6" },
];

export default function BransHavuzuPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<BranchDoc[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  };

  const load = async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/branches", { headers });
      const json = res.ok ? await res.json() : { items: [] };
      setBranches(json.items ?? []);
    } catch (e) {
      console.error("[branslar] yüklenemedi:", e);
      toast.error("Branş listesi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) {
        router.push("/login");
        return;
      }
      if (!cancelled) {
        setAuthed(true);
        await load();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const addBranch = async () => {
    const ad = name.trim();
    if (!ad || saving) return;
    setSaving(true);
    try {
      const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
      const res = await fetch("/api/flexos/branches", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: ad, order: branches.length }),
      });
      if (res.status === 201) {
        toast.success(`“${ad}” branşı eklendi.`);
        setName("");
        await load();
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Branş eklenemedi.");
      }
    } catch (e) {
      console.error("[branslar] eklenemedi:", e);
      toast.error("Branş eklenemedi.");
    } finally {
      setSaving(false);
    }
  };

  if (authed === null) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", background: "#eef2f8" }}>
        <div className="bh-spin" />
        <style>{globalCss}</style>
      </div>
    );
  }

  const canAdd = name.trim().length > 0 && !saving;

  return (
    <div style={S.root}>
      <style>{globalCss}</style>

      <FlexSidebar active="ayarlar" />

      {/* MAIN */}
      <main style={S.main}>
        <FlexHeader
          roleLabel="Yönetici · Eğitmen"
          left={
            <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
              <a className="bh-iconbtn" style={S.backBtn} title="Eğitim Ayarları'na dön" onClick={() => router.push("/flexos/egitim-yonetimi/ayarlar")}>
                <span dangerouslySetInnerHTML={{ __html: IC.back }} />
              </a>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>
                  <span>Eğitim Yönetimi</span>
                  <span style={{ display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.crumb }} />
                  <span>Eğitim Ayarları</span>
                  <span style={{ display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.crumb }} />
                  <span style={{ color: "#f97316" }}>Branş Havuzu</span>
                </div>
                <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: "-.5px", color: "#0f1f3d" }}>Branş Havuzu</h1>
              </div>
            </div>
          }
        />

        <div style={{ padding: "30px 36px 48px", maxWidth: 760, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>
          <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "#64748b", fontWeight: 500 }}>
            Branşlar tüm eğitimlerin üst kategorisidir (Grafik Tasarım, Yazılım…). Buradan tanımladığınız branşlar “Eğitim Ekle” formundaki dropdown'da çıkar.
          </p>

          {/* Branş Ekle */}
          <div style={S.card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 11, letterSpacing: ".01em" }}>YENİ BRANŞ EKLE</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input
                className="bh-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addBranch(); }}
                placeholder="Branş adı — örn: Grafik Tasarım"
                style={{ ...S.input, flex: 1, minWidth: 220 }}
              />
              <button onClick={addBranch} disabled={!canAdd} style={addBtnStyle(canAdd)}>
                <span dangerouslySetInnerHTML={{ __html: IC.plus }} />
                {saving ? "Ekleniyor…" : "Branş Ekle"}
              </button>
            </div>
          </div>

          {/* Liste */}
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #eef1f6", background: "#fafbfd" }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: "#0f1f3d" }}>Branşlar</span>
              <span style={S.countChip}>{branches.length}</span>
            </div>
            {branches.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, padding: "48px 20px", textAlign: "center" }}>
                <div style={S.emptyIcon} dangerouslySetInnerHTML={{ __html: IC.branchBig }} />
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "#334155" }}>{loading ? "Yükleniyor…" : "Henüz branş yok"}</div>
                <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 320 }}>
                  {loading ? "Branş havuzu getiriliyor." : "Yukarıdan ilk branşı ekleyin; ardından eğitimler bu branşlara bağlanır."}
                </div>
              </div>
            ) : (
              <div>
                {branches.map((b, i) => {
                  const pal = PALETTE[i % PALETTE.length];
                  return (
                    <div key={b.id} className="bh-row" style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 20px", borderBottom: "1px solid #f1f4f9" }}>
                      <span style={{ ...S.rowIcon, color: pal.color, background: pal.background }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: pal.dot }} />
                      </span>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: "#1e293b", flex: 1 }}>{b.name}</span>
                      <span style={{ fontSize: 12.5, color: "#94a3b8", fontWeight: 500 }}>#{(b.order ?? i) + 1}</span>
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

// ── dinamik buton ──
const addBtnStyle = (enabled: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 12, border: "none",
  fontFamily: "inherit", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap",
  cursor: enabled ? "pointer" : "not-allowed",
  background: enabled ? "#4f46e5" : "#e8edf4", color: enabled ? "#fff" : "#a9b4c4",
  boxShadow: enabled ? "0 6px 14px -7px rgba(67,56,202,.6)" : "none",
});

// ── stiller ──
const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#0f172a", fontFamily: "'Inter', system-ui, sans-serif", background: "#eef2f8" },
  sidebar: { width: 252, flex: "0 0 252px", height: "100%", background: "linear-gradient(180deg,#102a4e 0%,#0b2244 60%,#091d3a 100%)", display: "flex", flexDirection: "column", padding: "22px 16px 18px" },
  logoBox: { width: 38, height: 38, borderRadius: 11, background: "#0a1c38", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 3, padding: 8, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" },
  navItem: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 11, color: "#9fb2cd", textDecoration: "none", fontSize: 14.5, fontWeight: 500, cursor: "pointer", transition: "all .15s" },
  navActive: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 11, color: "#fff", textDecoration: "none", fontSize: 14.5, fontWeight: 700, cursor: "pointer", background: "linear-gradient(90deg,rgba(249,115,22,.22),rgba(249,115,22,.05))", boxShadow: "inset 0 0 0 1px rgba(249,115,22,.28)" },
  navActiveBar: { position: "absolute", left: 0, top: 9, bottom: 9, width: 3, borderRadius: "0 3px 3px 0", background: "#fb923c" },
  main: { flex: 1, height: "100%", overflowY: "auto", background: "#eef2f8", display: "flex", flexDirection: "column" },
  header: { position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px max(36px, calc((100% - 760px) / 2 + 36px))", background: "rgba(238,242,248,.85)", backdropFilter: "blur(10px)", borderBottom: "1px solid #e2e8f1" },
  backBtn: { width: 46, height: 46, borderRadius: 13, border: "1px solid #e2e8f1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", textDecoration: "none", transition: "all .14s" },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#fb923c,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(234,88,12,.7)" },
  card: { background: "#fff", border: "1px solid #e9edf4", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(15,31,61,.05)", marginBottom: 18 },
  input: { padding: "12px 15px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14.5, fontFamily: "inherit", color: "#1e293b", outline: "none" },
  countChip: { fontSize: 12.5, fontWeight: 700, color: "#4338ca", background: "#e8ecfd", padding: "3px 10px", borderRadius: 999 },
  rowIcon: { width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  emptyIcon: { width: 54, height: 54, borderRadius: 15, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" },
};

const sv = (inner: string, attrs = 'width="19" height="19"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  home: sv('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>'),
  book: sv('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'),
  users: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  calendar: sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>'),
  award: sv('<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>'),
  back: sv('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', 'width="21" height="21" stroke-width="2.1"'),
  crumb: sv('<path d="m9 18 6-6-6-6"/>', 'width="13" height="13" stroke="#94a3b8" stroke-width="2.3"'),
  plus: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="17" height="17" stroke-width="2.4"'),
  branchBig: sv('<path d="M7.59 13.41 11 17l9-9"/><path d="M3 12l3.59 3.59"/>', 'width="24" height="24" stroke-width="1.8"'),
};

const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@keyframes bh-spin{to{transform:rotate(360deg)}}
.bh-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#1d4ed8;animation:bh-spin 1s linear infinite}
.bh-navlink:hover{background:rgba(255,255,255,.06);color:#fff!important}
.bh-iconbtn:hover{background:#f8fafc;color:#0f172a}
.bh-input:focus{border-color:#a5b4fc;background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
.bh-row:hover{background:#f9fafc}
`;
