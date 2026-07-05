"use client";

/**
 * FlexOS · Ödev Yönetimi — canlıdaki `dashboard/tasks` (`TaskManagementPanel.tsx`, 1095
 * satır, global 5 sekmeli ayarlar sayfası: Şablon Yönetimi/Mevcut Ödevler/Arşiv/Ödev
 * Havuzları/Lig) portu. GRUP KARTI DEĞİL — TEK global tablo, grup sadece bir sütun.
 *
 * Kapsam (kullanıcı onaylı, aşamalı): şimdilik SADECE "Mevcut Ödevler" + "Arşiv" sekmeleri.
 * "Şablon Yönetimi" + "Ödev Havuzları" — kullanıcının oyunlaştırılmış şablonları için
 * kritik ama `templateKind: "standard"|"system"` + duplicate/deep-copy tasarım kararı
 * henüz verilmedi (bkz. [[flexos_odev_faz2_submission_2026_07_05]] hafızası) — o karar
 * netleşince buraya sekme olarak eklenecek. "Lig Yönetimi" — kullanıcı kararıyla tamamen
 * ayrı/opsiyonel bir modül, şimdi YOK.
 *
 * BİLİNÇLİ OLARAK "Yeni Ödev" butonu YOK — canlıda da bu sayfada (TaskTable/TaskRow)
 * oluşturma yok, sadece düzenle/sil/arşivle/aktife-al var. Gerçek oluşturma noktası
 * canlıda Eğitmen Ana Sayfa'daki "Ödev Parkuru" (sağ üstte turuncu + custom ödev,
 * altta şablon kütüphanesinden hazır ödev seçme) — o FlexOS'a AYRICA portlanacak.
 */

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ClipboardList, Loader2, Pencil, Trash2, X, CalendarDays, AlertTriangle } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";

type AssignmentStatus = "draft" | "published" | "closed" | "archived";
type MgmtTab = "active" | "archive";

interface AssignmentItem {
  id: string;
  groupId: string;
  title: string;
  description: string;
  dueDate?: string;
  status: AssignmentStatus;
  createdAt?: string;
}

interface GroupOption { id: string; code: string; branch: string }

interface FormState { title: string; description: string; dueDate: string; status: AssignmentStatus; groupId: string }
const EMPTY_FORM: FormState = { title: "", description: "", dueDate: "", status: "draft", groupId: "" };

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

export default function OdevYonetimiPage() {
  const [tab, setTab] = useState<MgmtTab>("active");
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const [groupsRes, assignRes] = await Promise.all([
        fetch("/api/flexos/groups", { headers }),
        fetch("/api/flexos/assignments", { headers }),
      ]);
      if (groupsRes.ok) {
        const data = await groupsRes.json() as { items: { id: string; code: string; branch: string }[] };
        setGroups(data.items.map((g) => ({ id: g.id, code: g.code, branch: g.branch })));
      }
      if (assignRes.ok) {
        const data = await assignRes.json() as { items: AssignmentItem[] };
        setAssignments(data.items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const activeList = assignments.filter((a) => a.status !== "archived");
  const archivedList = assignments.filter((a) => a.status === "archived");
  const list = tab === "active" ? activeList : archivedList;

  function openEdit(a: AssignmentItem) {
    setEditingId(a.id);
    setForm({ title: a.title, description: a.description, dueDate: a.dueDate ? a.dueDate.slice(0, 10) : "", status: a.status, groupId: a.groupId });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!editingId) return;
    if (!form.title.trim() || !form.description.trim()) { toast.error("Başlık ve açıklama zorunlu."); return; }
    setSaving(true);
    try {
      const headers = await authHeaders();
      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        status: form.status,
      };
      const res = await fetch(`/api/flexos/assignments/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast.error(json.error ?? "Kaydedilemedi.");
        return;
      }
      toast.success("Ödev güncellendi.");
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

  async function setStatus(a: AssignmentItem, status: AssignmentStatus) {
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/assignments/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { toast.error("İşlem başarısız."); return; }
    toast.success(status === "archived" ? "Arşive taşındı." : "Aktife alındı.");
    await loadData();
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const headers = await authHeaders();
    let ok = 0;
    for (const id of selectedIds) {
      const res = await fetch(`/api/flexos/assignments/${id}`, { method: "DELETE", headers });
      if (res.ok) ok++;
    }
    toast.success(`${ok} ödev silindi.`);
    setSelectedIds(new Set());
    await loadData();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  }
  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === list.length ? new Set() : new Set(list.map((a) => a.id))));
  }

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#EEF0F3" }}>
      <FlexSidebar active="odev-yonetimi" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<ClipboardList size={20} color="#fff" />}
          title="Ödev Yönetimi"
          subtitle="Tüm gruplardaki ödevleri tek yerden yönet"
          roleLabel="Eğitmen"
        />

        <div style={{ padding: "30px 36px 72px", maxWidth: 1400, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }} className="font-inter">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-1 bg-surface-50 w-fit p-1 rounded-xl border border-surface-100 shadow-sm">
              {([
                { key: "active", label: "Mevcut Ödevler" },
                { key: "archive", label: "Arşiv" },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setSelectedIds(new Set()); }}
                  className={`px-5 py-2 rounded-[10px] text-[13px] font-bold transition-all cursor-pointer outline-none ${
                    tab === t.key ? "bg-white text-base-primary-900 shadow-sm border border-surface-100" : "text-surface-400 hover:text-surface-600 border border-transparent"
                  }`}
                >
                  {t.label} ({t.key === "active" ? activeList.length : archivedList.length})
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {tab === "archive" && selectedIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-status-danger-500 text-white text-[12px] font-bold hover:bg-status-danger-600 transition-colors cursor-pointer"
                >
                  <Trash2 size={13} /> {selectedIds.size} Ödevi Sil
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-surface-400">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : list.length === 0 ? (
            <div className="bg-white rounded-2xl border border-surface-100 flex flex-col items-center justify-center py-20 text-surface-300">
              <AlertTriangle size={32} className="mb-3 opacity-40" />
              <p className="text-[14px] font-semibold">{tab === "active" ? "Aktif ödev bulunamadı." : "Arşivde kayıt yok."}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-3 bg-surface-50 border-b border-surface-100">
                {tab === "archive" && (
                  <input type="checkbox" checked={selectedIds.size === list.length && list.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded accent-status-danger-500 cursor-pointer shrink-0" />
                )}
                <div className="w-44 shrink-0"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Ödev Adı</span></div>
                <div className="flex-1 min-w-0"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Açıklama</span></div>
                <div className="w-28 shrink-0"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Grup</span></div>
                <div className="w-24 shrink-0"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Durum</span></div>
                <div className="w-28 shrink-0"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Teslim</span></div>
                <div className="w-28 shrink-0" />
              </div>

              {list.map((a) => {
                const group = groupMap.get(a.groupId);
                return (
                  <div key={a.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors border-b border-surface-50 last:border-0">
                    {tab === "archive" && (
                      <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} className="w-4 h-4 rounded accent-status-danger-500 cursor-pointer shrink-0" />
                    )}
                    <div className="w-44 shrink-0 min-w-0">
                      <span className="text-[13px] font-bold text-base-primary-900 truncate block">{a.title}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] text-surface-500 truncate block">{a.description || <span className="italic text-surface-300">—</span>}</span>
                    </div>
                    <div className="w-28 shrink-0">
                      <span className="text-[12px] font-semibold text-surface-600 truncate block">{group?.code ?? "—"}</span>
                    </div>
                    <div className="w-24 shrink-0">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        a.status === "published" ? "bg-status-success-50 text-status-success-600" :
                        a.status === "archived" ? "bg-surface-100 text-surface-500" :
                        a.status === "closed" ? "bg-orange-50 text-orange-600" :
                        "bg-surface-100 text-surface-400"
                      }`}>
                        {a.status === "published" ? "Yayında" : a.status === "archived" ? "Arşivde" : a.status === "closed" ? "Kapalı" : "Taslak"}
                      </span>
                    </div>
                    <div className="w-28 shrink-0 flex items-center gap-1 text-[12px] text-surface-400">
                      {a.dueDate ? (<><CalendarDays size={11} /><span>{fmtDate(a.dueDate)}</span></>) : <span className="italic text-surface-300">—</span>}
                    </div>
                    <div className="w-28 shrink-0 flex items-center gap-1">
                      <button onClick={() => openEdit(a)} title="Düzenle" className="w-8 h-8 flex items-center justify-center rounded-xl text-surface-300 hover:bg-base-primary-50 hover:text-base-primary-500 transition-all cursor-pointer">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(a)} title="Sil" className="w-8 h-8 flex items-center justify-center rounded-xl text-surface-300 hover:bg-status-danger-50 hover:text-status-danger-500 transition-all cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                      {tab === "active" ? (
                        <button onClick={() => setStatus(a, "archived")} title="Arşive Taşı" className="px-2.5 h-8 rounded-xl text-[11px] font-bold text-surface-500 hover:bg-surface-100 transition-all cursor-pointer whitespace-nowrap">
                          Arşivle
                        </button>
                      ) : (
                        <button onClick={() => setStatus(a, "published")} title="Aktife Al" className="px-2.5 h-8 rounded-xl text-[11px] font-bold text-status-success-600 hover:bg-status-success-50 transition-all cursor-pointer whitespace-nowrap">
                          Aktife Al
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>

      {/* Düzenle modalı — oluşturma burada YOK (canlıda da yok, bkz. dosya başı not) */}
      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-base-primary-900">Ödevi Düzenle</h2>
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
