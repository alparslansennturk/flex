"use client";

/**
 * Geliştirici Notları (2026-07-25) — "Ayarlar" sayfasının SADECE owner'ın gördüğü
 * sekmesi (`canPin`, view.toggle). Tamamen dahili: kullanırken bulunan bir hatayı
 * hemen not almak, sonra "Çözüldü" tıklayıp kapatmak için basit bir CRUD ekranı.
 * Ürünün gerçek domain'iyle hiçbir ilişkisi yok, `flexos_dev_notes` server-only.
 */

import { useCallback, useEffect, useState, CSSProperties } from "react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import { authHeadersJson } from "@/app/lib/client/auth-headers";

type Priority = "dusuk" | "orta" | "yuksek";
type Status = "acik" | "cozuldu";

interface DevNote {
  id: string;
  title: string;
  description: string;
  module: string;
  priority: Priority;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

const PRIORITY_LABEL: Record<Priority, string> = { dusuk: "Düşük", orta: "Orta", yuksek: "Yüksek" };
const PRIORITY_COLOR: Record<Priority, { bg: string; fg: string }> = {
  dusuk: { bg: "#EEF0F3", fg: "#6F7B87" },
  orta: { bg: "#FEF3C7", fg: "#B45309" },
  yuksek: { bg: "#FFECEC", fg: "#D93636" },
};


function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`;
}

export default function DevNotesPanel() {
  const [notes, setNotes] = useState<DevNote[]>([]);
  const [loading, setLoading] = useState(true);
  // 2026-07-25 kullanıcı bulgusu: varsayılan "Açık" filtresiyle bir notu Çözüldü
  // işaretleyince anında listeden kayboluyordu, kullanıcı bunu hata sandı. Artık
  // varsayılan "Tümü" — Açık/Çözüldü AYNI listede, işaretlenince sadece soluklaşıp
  // üstü çizili görünüyor (aşağıdaki satır stili), kaybolmuyor. Filtre butonları
  // hâlâ duruyor, isterse daraltabilir.
  const [statusFilter, setStatusFilter] = useState<"hepsi" | Status>("hepsi");

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fModule, setFModule] = useState("");
  const [fPriority, setFPriority] = useState<Priority>("orta");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const headers = await authHeadersJson();
      const res = await fetch("/api/flexos/dev-notes", { headers, signal });
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      if (!signal?.aborted) setNotes(json.items ?? []);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Notlar yüklenemedi.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  function resetForm() {
    setEditId(null);
    setFTitle(""); setFDesc(""); setFModule(""); setFPriority("orta");
  }

  function openNewForm() {
    resetForm();
    setFormOpen(true);
  }

  function openEditForm(n: DevNote) {
    setEditId(n.id);
    setFTitle(n.title); setFDesc(n.description); setFModule(n.module); setFPriority(n.priority);
    setFormOpen(true);
  }

  async function saveForm() {
    if (!fTitle.trim()) { toast.error("Başlık zorunlu."); return; }
    setSaving(true);
    try {
      const headers = await authHeadersJson();
      if (editId) {
        const res = await fetch(`/api/flexos/dev-notes/${editId}`, {
          method: "PATCH", headers,
          body: JSON.stringify({ title: fTitle, description: fDesc, module: fModule, priority: fPriority }),
        });
        if (!res.ok) throw new Error("patch failed");
        toast.success("Not güncellendi.");
      } else {
        const res = await fetch("/api/flexos/dev-notes", {
          method: "POST", headers,
          body: JSON.stringify({ title: fTitle, description: fDesc, module: fModule, priority: fPriority }),
        });
        if (!res.ok) throw new Error("post failed");
        toast.success("Not eklendi.");
      }
      setFormOpen(false);
      resetForm();
      await load();
    } catch {
      toast.error("Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(n: DevNote) {
    const next: Status = n.status === "acik" ? "cozuldu" : "acik";
    setBusyId(n.id);
    setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, status: next } : x))); // optimistic
    try {
      const headers = await authHeadersJson();
      const res = await fetch(`/api/flexos/dev-notes/${n.id}`, { method: "PATCH", headers, body: JSON.stringify({ status: next }) });
      if (!res.ok) throw new Error("patch failed");
    } catch {
      setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, status: n.status } : x))); // rollback
      toast.error("Durum güncellenemedi.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      const headers = await authHeadersJson();
      const res = await fetch(`/api/flexos/dev-notes/${id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("delete failed");
      setNotes((prev) => prev.filter((x) => x.id !== id));
      toast.success("Not silindi.");
    } catch {
      toast.error("Silinemedi.");
    }
  }

  const visible = notes.filter((n) => statusFilter === "hepsi" || n.status === statusFilter);
  const acikCount = notes.filter((n) => n.status === "acik").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const }}>
        <div style={{ display: "inline-flex", padding: 4, borderRadius: 11, background: "#fff", border: "1px solid #E2E5EA" }}>
          {([
            { key: "hepsi" as const, label: "Tümü" },
            { key: "acik" as const, label: "Açık" },
            { key: "cozuldu" as const, label: "Çözüldü" },
          ]).map((f) => {
            const active = statusFilter === f.key;
            return (
              <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
                padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: active ? 700 : 600, fontFamily: "inherit",
                color: active ? "#1E222B" : "#6F7B87", background: active ? "#F2F4F7" : "transparent",
              }}>
                {f.label}{f.key === "acik" && acikCount > 0 ? ` (${acikCount})` : ""}
              </button>
            );
          })}
        </div>
        <button onClick={openNewForm} style={S.addBtn}>+ Yeni Not</button>
      </div>

      {loading ? (
        <div style={{ ...S.card, textAlign: "center" as const, color: "#8E95A3", fontSize: 13.5, padding: "40px 20px" }}>Yükleniyor…</div>
      ) : visible.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center" as const, color: "#8E95A3", fontSize: 13.5, padding: "40px 20px" }}>Bu filtrede not yok.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map((n) => {
            const pc = PRIORITY_COLOR[n.priority];
            const resolved = n.status === "cozuldu";
            return (
              <div key={n.id} style={{ ...S.card, opacity: resolved ? 0.6 : 1, display: "flex", gap: 14, alignItems: "flex-start" }}>
                <button
                  onClick={() => toggleStatus(n)}
                  disabled={busyId === n.id}
                  title={resolved ? "Tekrar aç" : "Çözüldü olarak işaretle"}
                  style={{
                    width: 22, height: 22, borderRadius: 7, flex: "0 0 auto", marginTop: 2, cursor: "pointer",
                    border: resolved ? "none" : "1.5px solid #C7CDD6", background: resolved ? "#15803D" : "#fff",
                    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {resolved && <CheckIcon />}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, marginBottom: 4 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 800, color: "#1E222B", textDecoration: resolved ? "line-through" : "none" }}>{n.title}</span>
                    {n.module && <span style={S.chip}>{n.module}</span>}
                    <span style={{ ...S.chip, background: pc.bg, color: pc.fg }}>{PRIORITY_LABEL[n.priority]}</span>
                  </div>
                  {n.description && <div style={{ fontSize: 13, color: "#6F7B87", lineHeight: 1.5, marginBottom: 6, whiteSpace: "pre-wrap" as const }}>{n.description}</div>}
                  <div style={{ fontSize: 11.5, color: "#AEB4C0" }}>{fmtDate(n.createdAt)}</div>
                </div>

                <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
                  <button onClick={() => openEditForm(n)} title="Düzenle" style={S.iconBtn}><PencilIcon /></button>
                  <button onClick={() => setDeleteId(n.id)} title="Sil" style={S.iconBtn}><TrashIcon /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <div onClick={() => setFormOpen(false)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.formModal}>
            <div style={{ padding: "28px 30px 6px" }}>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#1E222B" }}>{editId ? "Notu Düzenle" : "Yeni Geliştirici Notu"}</h3>
            </div>
            <div style={{ padding: "18px 30px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <label style={S.label}>Başlık</label>
                <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} style={S.input} placeholder="Kısa özet" autoFocus />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <label style={S.label}>Açıklama</label>
                <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} style={{ ...S.input, minHeight: 130, resize: "vertical" as const, fontFamily: "inherit" }} placeholder="Ne oldu, nasıl tekrarlanır..." />
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                  <label style={S.label}>Modül <span style={{ fontWeight: 500, color: "#AEB4C0" }}>(opsiyonel)</span></label>
                  <input value={fModule} onChange={(e) => setFModule(e.target.value)} style={S.input} placeholder="Bilmiyorsan boş bırak" />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={S.label}>Öncelik</label>
                  <select value={fPriority} onChange={(e) => setFPriority(e.target.value as Priority)} style={S.input}>
                    <option value="dusuk">Düşük</option>
                    <option value="orta">Orta</option>
                    <option value="yuksek">Yüksek</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, padding: "18px 30px 26px", justifyContent: "flex-end" }}>
              <button onClick={() => setFormOpen(false)} style={S.cancelBtn}>Vazgeç</button>
              <button onClick={saveForm} disabled={saving} style={{ ...S.addBtn, opacity: saving ? 0.6 : 1 }}>{saving ? "Kaydediliyor…" : "Kaydet"}</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div onClick={() => setDeleteId(null)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...S.modal, maxWidth: 380 }}>
            <div style={{ padding: "24px 24px 8px" }}>
              <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: "#1E222B" }}>Notu sil</h3>
              <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "#6F7B87", lineHeight: 1.5 }}>Bu işlem geri alınamaz.</p>
            </div>
            <div style={{ display: "flex", gap: 10, padding: "16px 24px 22px", justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteId(null)} style={S.cancelBtn}>Vazgeç</button>
              <button onClick={confirmDelete} style={{ ...S.addBtn, background: "#D93636" }}>Evet, sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>; }
function PencilIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>; }
function TrashIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>; }

const S: Record<string, CSSProperties> = {
  card: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: "16px 18px", boxShadow: "0 1px 3px rgba(15,31,61,.05)" },
  chip: { display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#EEF0F3", color: "#6F7B87" },
  iconBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#8E95A3", cursor: "pointer" },
  addBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#7C3AED,#5B21B6)", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(124,58,237,.5)" },
  cancelBtn: { padding: "10px 16px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  label: { fontSize: 12, fontWeight: 700, color: "#6F7B87" },
  input: { padding: "9px 12px", borderRadius: 10, border: "1px solid #E2E5EA", fontSize: 14, fontFamily: "inherit", outline: "none", color: "#1E222B", width: "100%", boxSizing: "border-box" as const },
  overlay: { position: "fixed", inset: 0, zIndex: 90, background: "rgba(15,31,61,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { width: "100%", maxWidth: 460, background: "#fff", borderRadius: 18, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" as const },
  // 2026-07-25 kullanıcı isteği: not formu modal'ı "çok ufak" bulundu — silme
  // onayı hâlâ küçük kalsın diye ayrı bir stil (S.modal aynı kalıyor).
  formModal: { width: "100%", maxWidth: 720, background: "#fff", borderRadius: 18, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" as const },
};
