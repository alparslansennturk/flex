"use client";

/**
 * FlexOS · Eğitim Yönetimi → Şube Havuzu.
 * Şube = fiziksel ofis (Kadıköy, Pendik…) — Branş (disiplin) ile KARIŞTIRILMAZ.
 * Sınıflar formundaki + Öğrenci Havuzu filtresindeki şube dropdown'ları buradan
 * (GET /api/flexos/branch-offices) beslenir.
 *
 * Veri: GET/POST /api/flexos/branch-offices (gated `office.create`) +
 * PATCH/DELETE /api/flexos/branch-offices/[id] (gated `office.edit`).
 */

import React, { useEffect, useState, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";

interface OfficeDoc {
  id: string;
  name: string;
  order?: number;
}

const PALETTE = [
  { color: "#0369a1", background: "#e0f2fe", dot: "#0ea5e9" },
  { color: "#be185d", background: "#fce7f3", dot: "#ec4899" },
  { color: "#15803d", background: "#dcfce7", dot: "#22c55e" },
  { color: "#c2410c", background: "#ffedd5", dot: "#f97316" },
  { color: "#4338ca", background: "#e6e9ff", dot: "#6366f1" },
  { color: "#7c3aed", background: "#ede9fe", dot: "#8b5cf6" },
];

export default function SubeHavuzuPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState<OfficeDoc[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<OfficeDoc | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const authHeaders = async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  };

  const load = async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/branch-offices", { headers });
      const json = res.ok ? await res.json() : { items: [] };
      setOffices(json.items ?? []);
    } catch (e) {
      console.error("[subeler] yüklenemedi:", e);
      toast.error("Şube listesi yüklenemedi.");
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

  const addOffice = async () => {
    const ad = name.trim();
    if (!ad || saving) return;
    setSaving(true);
    try {
      const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
      const res = await fetch("/api/flexos/branch-offices", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: ad, order: offices.length }),
      });
      if (res.status === 201) {
        toast.success(`“${ad}” şubesi eklendi.`);
        setName("");
        await load();
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Şube eklenemedi.");
      }
    } catch (e) {
      console.error("[subeler] eklenemedi:", e);
      toast.error("Şube eklenemedi.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (o: OfficeDoc) => {
    setEditingId(o.id);
    setEditingName(o.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit = async (id: string) => {
    const ad = editingName.trim();
    if (!ad) return;
    setSaving(true);
    try {
      const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
      const res = await fetch(`/api/flexos/branch-offices/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: ad }),
      });
      if (res.ok) {
        toast.success("Şube güncellendi.");
        cancelEdit();
        await load();
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Şube güncellenemedi.");
      }
    } catch (e) {
      console.error("[subeler] güncellenemedi:", e);
      toast.error("Şube güncellenemedi.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/branch-offices/${deleteTarget.id}`, { method: "DELETE", headers });
      if (res.ok) {
        toast.success(`“${deleteTarget.name}” şubesi silindi.`);
        setDeleteTarget(null);
        await load();
      } else {
        const j = await res.json().catch(() => ({}));
        setDeleteError(j.error || "Şube silinemedi.");
      }
    } catch (e) {
      console.error("[subeler] silinemedi:", e);
      setDeleteError("Şube silinemedi.");
    } finally {
      setDeleting(false);
    }
  };

  if (authed === null) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", background: "#eef2f8" }}>
        <div className="sh-spin" />
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
              <a className="sh-iconbtn" style={S.backBtn} title="Eğitim Ayarları'na dön" onClick={() => router.push("/flexos/egitim-yonetimi/ayarlar")}>
                <span dangerouslySetInnerHTML={{ __html: IC.back }} />
              </a>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>
                  <span>Eğitim Yönetimi</span>
                  <span style={{ display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.crumb }} />
                  <span>Eğitim Ayarları</span>
                  <span style={{ display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.crumb }} />
                  <span style={{ color: "#f97316" }}>Şube Havuzu</span>
                </div>
                <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: "-.5px", color: "#0f1f3d" }}>Şube Havuzu</h1>
              </div>
            </div>
          }
        />

        <div style={{ padding: "30px 36px 48px", maxWidth: 760, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>
          <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "#64748b", fontWeight: 500 }}>
            Şubeler kurumun fiziksel lokasyonlarıdır (Kadıköy, Pendik…) — branşla (disiplin) karıştırılmaz. Buradan tanımladığınız şubeler Sınıflar formunda ve Öğrenci Havuzu filtresinde çıkar.
          </p>

          {/* Şube Ekle */}
          <div style={S.card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 11, letterSpacing: ".01em" }}>YENİ ŞUBE EKLE</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input
                className="sh-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addOffice(); }}
                placeholder="Şube adı — örn: Kadıköy"
                style={{ ...S.input, flex: 1, minWidth: 220 }}
              />
              <button onClick={addOffice} disabled={!canAdd} style={addBtnStyle(canAdd)}>
                <span dangerouslySetInnerHTML={{ __html: IC.plus }} />
                {saving ? "Ekleniyor…" : "Şube Ekle"}
              </button>
            </div>
          </div>

          {/* Liste */}
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #eef1f6", background: "#fafbfd" }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: "#0f1f3d" }}>Şubeler</span>
              <span style={S.countChip}>{offices.length}</span>
            </div>
            {offices.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, padding: "48px 20px", textAlign: "center" }}>
                <div style={S.emptyIcon} dangerouslySetInnerHTML={{ __html: IC.officeBig }} />
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "#334155" }}>{loading ? "Yükleniyor…" : "Henüz şube yok"}</div>
                <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 320 }}>
                  {loading ? "Şube havuzu getiriliyor." : "Yukarıdan ilk şubeyi ekleyin; ardından gruplar bu şubelere bağlanır."}
                </div>
              </div>
            ) : (
              <div>
                {offices.map((o, i) => {
                  const pal = PALETTE[i % PALETTE.length];
                  const isEditing = editingId === o.id;
                  return (
                    <div key={o.id} className="sh-row" style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 20px", borderBottom: "1px solid #f1f4f9" }}>
                      <span style={{ ...S.rowIcon, color: pal.color, background: pal.background }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: pal.dot }} />
                      </span>
                      {isEditing ? (
                        <input
                          className="sh-input"
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(o.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          style={{ ...S.input, flex: 1, padding: "8px 12px" }}
                        />
                      ) : (
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: "#1e293b", flex: 1 }}>{o.name}</span>
                      )}
                      {isEditing ? (
                        <>
                          <button className="sh-iconbtn" style={S.smallBtn} title="Kaydet" onClick={() => saveEdit(o.id)} disabled={saving}>
                            <span dangerouslySetInnerHTML={{ __html: IC.check }} />
                          </button>
                          <button className="sh-iconbtn" style={S.smallBtn} title="Vazgeç" onClick={cancelEdit}>
                            <span dangerouslySetInnerHTML={{ __html: IC.x }} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="sh-iconbtn" style={S.smallBtn} title="Düzenle" onClick={() => startEdit(o)}>
                            <span dangerouslySetInnerHTML={{ __html: IC.edit }} />
                          </button>
                          <button className="sh-iconbtn" style={{ ...S.smallBtn, color: "#dc2626" }} title="Sil" onClick={() => { setDeleteTarget(o); setDeleteError(""); }}>
                            <span dangerouslySetInnerHTML={{ __html: IC.trash }} />
                          </button>
                        </>
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

      {/* Silme onay modalı */}
      {deleteTarget && (
        <div style={S.modalBackdrop} onClick={() => !deleting && setDeleteTarget(null)}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span style={{ ...S.rowIcon, color: "#dc2626", background: "#fee2e2", width: 44, height: 44 }} dangerouslySetInnerHTML={{ __html: IC.trashBig }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f1f3d" }}>Şubeyi sil</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>“{deleteTarget.name}” kalıcı olarak silinecek.</div>
              </div>
            </div>
            {deleteError && (
              <div style={{ marginBottom: 14, padding: "10px 13px", borderRadius: 10, background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={S.cancelBtn}>Vazgeç</button>
              <button onClick={confirmDelete} disabled={deleting} style={S.dangerBtn}>{deleting ? "Siliniyor…" : "Sil"}</button>
            </div>
          </div>
        </div>
      )}
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
  main: { flex: 1, height: "100%", overflowY: "auto", background: "#eef2f8", display: "flex", flexDirection: "column" },
  backBtn: { width: 46, height: 46, borderRadius: 13, border: "1px solid #e2e8f1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", textDecoration: "none", transition: "all .14s" },
  card: { background: "#fff", border: "1px solid #e9edf4", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(15,31,61,.05)", marginBottom: 18 },
  input: { padding: "12px 15px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14.5, fontFamily: "inherit", color: "#1e293b", outline: "none" },
  countChip: { fontSize: 12.5, fontWeight: 700, color: "#4338ca", background: "#e8ecfd", padding: "3px 10px", borderRadius: 999 },
  rowIcon: { width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  emptyIcon: { width: 54, height: 54, borderRadius: 15, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" },
  smallBtn: { width: 34, height: 34, borderRadius: 9, border: "1px solid #e3e8f0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", flex: "0 0 auto" },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modalCard: { background: "#fff", borderRadius: 18, padding: 24, width: 400, maxWidth: "90vw", boxShadow: "0 20px 50px -12px rgba(15,23,42,.35)" },
  cancelBtn: { padding: "10px 16px", borderRadius: 10, border: "1px solid #e3e8f0", background: "#fff", color: "#334155", fontSize: 13.5, fontWeight: 700, cursor: "pointer" },
  dangerBtn: { padding: "10px 16px", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" },
};

const sv = (inner: string, attrs = 'width="19" height="19"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  back: sv('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', 'width="21" height="21" stroke-width="2.1"'),
  crumb: sv('<path d="m9 18 6-6-6-6"/>', 'width="13" height="13" stroke="#94a3b8" stroke-width="2.3"'),
  plus: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="17" height="17" stroke-width="2.4"'),
  officeBig: sv('<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>', 'width="24" height="24" stroke-width="1.8"'),
  edit: sv('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>', 'width="15" height="15"'),
  trash: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 'width="15" height="15"'),
  trashBig: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 'width="20" height="20"'),
  check: sv('<path d="M20 6 9 17l-5-5"/>', 'width="15" height="15" stroke-width="2.4"'),
  x: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="15" height="15" stroke-width="2.4"'),
};

const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@keyframes sh-spin{to{transform:rotate(360deg)}}
.sh-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#1d4ed8;animation:sh-spin 1s linear infinite}
.sh-iconbtn:hover{background:#f8fafc;color:#0f172a}
.sh-input:focus{border-color:#a5b4fc;background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
.sh-row:hover{background:#f9fafc}
`;
