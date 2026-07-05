"use client";

/**
 * FlexOS · Ödev Yönetimi — Grup Detay. Sade CRUD: liste + oluştur/düzenle modalı + sil.
 * Backend: assignment-service.ts (assignTask/updateAssignment/deleteAssignment) — Faz 1'den
 * hazır, TEK canonical yol (canlıdaki iki bağımsız oluşturma yolunun yerini alıyor).
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, Loader2, Plus, Pencil, Trash2, X } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../../_components/FlexSidebar";
import FlexHeader from "../../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";

type AssignmentStatus = "draft" | "published" | "closed" | "archived";

interface AssignmentItem {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  status: AssignmentStatus;
  createdAt?: string;
}

const STATUS_META: Record<AssignmentStatus, { label: string; cls: string }> = {
  draft: { label: "Taslak", cls: "bg-surface-100 text-surface-500" },
  published: { label: "Yayında", cls: "bg-status-success-100 text-status-success-700" },
  closed: { label: "Kapalı", cls: "bg-orange-50 text-orange-600" },
  archived: { label: "Arşivde", cls: "bg-surface-100 text-surface-400" },
};

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

interface FormState { title: string; description: string; dueDate: string; status: AssignmentStatus }
const EMPTY_FORM: FormState = { title: "", description: "", dueDate: "", status: "draft" };

export default function OdevYonetimiGroupPage() {
  const router = useRouter();
  const { groupId } = useParams<{ groupId: string }>();

  const [groupCode, setGroupCode] = useState("");
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const [groupsRes, assignRes] = await Promise.all([
        fetch("/api/flexos/groups", { headers }),
        fetch(`/api/flexos/assignments?groupId=${groupId}`, { headers }),
      ]);
      if (groupsRes.ok) {
        const data = await groupsRes.json() as { items: { id: string; code: string }[] };
        setGroupCode(data.items.find((g) => g.id === groupId)?.code ?? "");
      }
      if (assignRes.ok) {
        const data = await assignRes.json() as { items: AssignmentItem[] };
        setAssignments(data.items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")));
      }
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { loadData(); }, [loadData]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }
  function openEdit(a: AssignmentItem) {
    setEditingId(a.id);
    setForm({ title: a.title, description: a.description, dueDate: a.dueDate ? a.dueDate.slice(0, 10) : "", status: a.status });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Başlık ve açıklama zorunlu.");
      return;
    }
    setSaving(true);
    try {
      const headers = await authHeaders();
      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        status: form.status,
      };
      const res = editingId
        ? await fetch(`/api/flexos/assignments/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) })
        : await fetch("/api/flexos/assignments", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ groupId, ...body }) });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast.error(json.error ?? "Kaydedilemedi.");
        return;
      }
      toast.success(editingId ? "Ödev güncellendi." : "Ödev oluşturuldu.");
      setModalOpen(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/assignments/${deleteTarget.id}`, { method: "DELETE", headers });
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      toast.error(json.error ?? "Silinemedi.");
      return;
    }
    toast.success("Ödev silindi.");
    setDeleteTarget(null);
    await loadData();
  }

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#EEF0F3" }}>
      <FlexSidebar active="odev-yonetimi" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          left={
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/flexos/odevler/yonetim")}
                className="w-9 h-9 rounded-xl border border-surface-200 bg-white flex items-center justify-center hover:bg-surface-50 transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft size={16} className="text-surface-700" />
              </button>
              <div>
                <h1 style={{ margin: 0, fontSize: 19, fontWeight: 630, color: "#1E222B" }}>{groupCode || "Ödev Yönetimi"}</h1>
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#8E95A3" }}>Ödevleri oluştur, düzenle, yayınla</p>
              </div>
            </div>
          }
        />

        <div style={{ padding: "30px 36px 72px", maxWidth: 1200, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }} className="font-inter">
          <div className="flex justify-end mb-6">
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-base-primary-600 text-white text-[14px] font-semibold hover:bg-base-primary-700 transition-colors cursor-pointer"
            >
              <Plus size={16} /> Yeni Ödev
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-surface-400">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 border border-dashed border-surface-200 rounded-2xl bg-white">
              <ClipboardList size={24} className="text-surface-300" />
              <p className="text-[15px] font-bold text-surface-500">Bu gruba ait ödev yok</p>
              <p className="text-[13px] text-surface-400">Yukarıdaki &quot;Yeni Ödev&quot; ile ilk ödevi oluşturun.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => (
                <div key={a.id} className="bg-white border border-surface-200 rounded-2xl p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_META[a.status].cls}`}>{STATUS_META[a.status].label}</span>
                      {a.dueDate && <span className="text-[12px] text-surface-400">Teslim: {new Date(a.dueDate).toLocaleDateString("tr-TR")}</span>}
                    </div>
                    <p className="text-[15px] font-bold text-text-primary">{a.title}</p>
                    <p className="text-[13px] text-surface-500 mt-1 line-clamp-2">{a.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEdit(a)} className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-text-secondary transition-colors cursor-pointer">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setDeleteTarget(a)} className="p-2 rounded-lg hover:bg-status-danger-50 text-surface-300 hover:text-status-danger-500 transition-colors cursor-pointer">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>

      {/* Oluştur/Düzenle modalı */}
      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-base-primary-900">{editingId ? "Ödevi Düzenle" : "Yeni Ödev"}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg hover:bg-surface-100 text-surface-400 cursor-pointer"><X size={16} /></button>
            </div>

            <div>
              <label className="text-[12px] font-semibold text-surface-500 mb-1 block">Başlık</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-200 text-[14px] outline-none focus:border-base-primary-400 transition-colors"
                placeholder="Ödev başlığı"
              />
            </div>

            <div>
              <label className="text-[12px] font-semibold text-surface-500 mb-1 block">Açıklama</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-200 text-[14px] outline-none focus:border-base-primary-400 transition-colors resize-none"
                placeholder="Ödev açıklaması / talimatları"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[12px] font-semibold text-surface-500 mb-1 block">Son Teslim Tarihi</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-200 text-[14px] outline-none focus:border-base-primary-400 transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="text-[12px] font-semibold text-surface-500 mb-1 block">Durum</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AssignmentStatus }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-200 text-[14px] outline-none focus:border-base-primary-400 transition-colors bg-white"
                >
                  <option value="draft">Taslak</option>
                  <option value="published">Yayında</option>
                  <option value="closed">Kapalı</option>
                  <option value="archived">Arşivde</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalOpen(false)} disabled={saving} className="px-5 py-2.5 rounded-xl text-[14px] font-semibold text-surface-500 border border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer disabled:opacity-50">
                İptal
              </button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl text-[14px] font-semibold text-white bg-base-primary-600 hover:bg-base-primary-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Silme onayı */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-bold text-base-primary-900">Ödevi sil</h2>
            <p className="text-[14px] text-surface-600"><span className="font-semibold">{deleteTarget.title}</span> ödevini silmek istediğine emin misin? Bu işlem geri alınamaz.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl text-[13px] font-semibold text-surface-500 border border-surface-200 hover:bg-surface-50 transition-colors cursor-pointer">İptal</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white bg-status-danger-500 hover:bg-status-danger-600 transition-colors cursor-pointer">Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
