"use client";

/**
 * FlexOS · Ödev Yönetimi — canlıdaki `dashboard/tasks` (`TaskManagementPanel.tsx`, 1095
 * satır, global 5 sekmeli ayarlar sayfası: Şablon Yönetimi/Mevcut Ödevler/Arşiv/Ödev
 * Havuzları/Lig) portu. GRUP KARTI DEĞİL — TEK global tablo, grup sadece bir sütun.
 *
 * Kapsam (kullanıcı kararı, 2026-07-06 — "şablon ödevin kalbi, canlı-birebir"):
 * **"Şablon Yönetimi"** İLK sekme olarak bitti (kullanıcının verdiği Claude Design
 * çıktısı `Ödev Şablonu Yönetimi.dc.html`'den port) — branş filtresi (gerçek katalog
 * branşları, `siniflar/_shared/groupDisplay.ts`'teki paylaşımlı `BRANS_COLORS` ile
 * renklendirilir), oluştur/düzenle/sil + "Ana Sayfada göster" onay toggle'ı (Ödev
 * Parkuru'nun ghost-slotlarında görünürlüğü kontrol eder, `AssignmentTemplate.visible`).
 * "Mevcut Ödevler" + "Arşiv" sekmeleri değişmedi. "Ödev Havuzları" (oyunlaştırılmış
 * şablonlar, `templateKind`/deep-copy tasarımı) ve "Lig Yönetimi" hâlâ ayrı/opsiyonel,
 * henüz YOK (bkz. [[flexos_odev_faz2_submission_2026_07_05]] hafızası).
 *
 * BİLİNÇLİ OLARAK "Yeni Ödev" butonu YOK — canlıda da bu sayfada (TaskTable/TaskRow)
 * oluşturma yok, sadece düzenle/sil/arşivle/aktife-al var. Gerçek oluşturma noktası
 * canlıda Eğitmen Ana Sayfa'daki "Ödev Parkuru" (sağ üstte turuncu + custom ödev,
 * altta şablon kütüphanesinden hazır ödev seçme) — o FlexOS'a AYRICA portlandı
 * (`egitmen-anasayfa/OdevOlusturModal.tsx`, "Şablon olarak kaydet" toggle'ı buradaki
 * şablon kütüphanesine yazar; branş seçili Gruptan otomatik türetilir, ayrı alan YOK).
 *
 * **Şablon modalı — sabit `height` (2026-07-06, kullanıcı: "genişlik ve yükseklik aynen
 * korunmalı, oynamamalı asla"):** `maxHeight` (auto-fit) ilk denemesi ikon seçimi popup'ı
 * açılınca panelin TAMAMEN büyümesine sebep oluyordu. `OdevOlusturModal.tsx` ile AYNI çözüm:
 * `height: min(820px, calc(100dvh-32px))` sabit (Ödev Puanı satırı eklenince 760px yetersiz
 * kaldı, Ödev Ekle'yle aynı değere çıkarıldı) — panel boyutu ikon picker açık/kapalı FARK
 * ETMEKSİZİN sabit kalır, içerik sığmazsa SADECE body (`flex-1 min-h-0 overflow-y-auto`)
 * kendi içinde scroll eder (ikon picker açıkken beklenen davranış budur).
 */

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ClipboardList, Loader2, Pencil, Trash2, X, CalendarDays, AlertTriangle, Plus, Check, ChevronDown } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { BRANS_FALLBACK } from "../../siniflar/_shared/groupDisplay";
import { ASSIGNMENT_ICONS, ASSIGNMENT_ICON_KEYS, ASSIGNMENT_KIND_OPTIONS } from "../_shared/assignmentIcons";
import { useCapabilities } from "../../_components/useCapabilities";
import CollagePoolPanel from "../_shared/CollagePoolPanel";
import GlobalLibraryPanel from "../_shared/GlobalLibraryPanel";

type AssignmentStatus = "draft" | "published" | "closed" | "archived";
type MgmtTab = "templates" | "active" | "archive" | "pool" | "globalLibrary";
type TemplateKind = "normal" | "proje";

interface TemplateItem {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  branch?: string;
  icon?: string;
  kind?: TemplateKind;
  maxPuan?: number;
  visible?: boolean;
  gamifiedType?: "kolaj";
}

interface BranchOption { id: string; name: string }

const TUMU = "Tümü";
const PUAN_HIZLI = [100, 150, 200, 250, 300];

function branchColorFor(_name?: string) {
  // Kullanıcı kararı (2026-07-07): bu sayfada branş çipi nötr gri — eğitmen tek
  // branşta çalıştığında BRANS_COLORS'ın renkli paleti anlamsız/monoton kalıyordu.
  // Diğer sayfalardaki BRANS_COLORS kullanımına dokunulmadı.
  return BRANS_FALLBACK;
}

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
  const [tab, setTab] = useState<MgmtTab>("templates");
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Şablon Yönetimi ──
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [bransFilter, setBransFilter] = useState<string>(TUMU);
  const [bransFilterOpen, setBransFilterOpen] = useState(false);

  const [tplFormOpen, setTplFormOpen] = useState(false);
  const [tplEditingId, setTplEditingId] = useState<string | null>(null);
  const [tplTitle, setTplTitle] = useState("");
  const [tplSubtitle, setTplSubtitle] = useState("");
  const [tplDescription, setTplDescription] = useState("");
  const [tplBranch, setTplBranch] = useState("");
  const [tplFormBransOpen, setTplFormBransOpen] = useState(false);
  const [tplIcon, setTplIcon] = useState("pen");
  const [tplIconPickerOpen, setTplIconPickerOpen] = useState(false);
  const [tplKind, setTplKind] = useState<TemplateKind>("normal");
  const [tplPuan, setTplPuan] = useState(100);
  // Global Kütüphane'ye ekle (2026-07-07 kararı) — SADECE org scope aktöre (Op/Admin)
  // gösterilir, self-scope eğitmenin kişisel şablonunda anlamsız/sunucu reddeder.
  const [tplGamified, setTplGamified] = useState(false);
  const { templateManageScope } = useCapabilities();
  const canPromoteGlobal = templateManageScope === "org";
  const [tplSaving, setTplSaving] = useState(false);
  const [tplDeleteTarget, setTplDeleteTarget] = useState<TemplateItem | null>(null);
  const [tplMounted, setTplMounted] = useState(false);
  useEffect(() => setTplMounted(true), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const [groupsRes, assignRes, tplRes, branchRes] = await Promise.all([
        fetch("/api/flexos/groups", { headers }),
        fetch("/api/flexos/assignments", { headers }),
        fetch("/api/flexos/assignment-templates", { headers }),
        fetch("/api/flexos/branches", { headers }),
      ]);
      if (groupsRes.ok) {
        const data = await groupsRes.json() as { items: { id: string; code: string; branch: string }[] };
        setGroups(data.items.map((g) => ({ id: g.id, code: g.code, branch: g.branch })));
      }
      if (assignRes.ok) {
        const data = await assignRes.json() as { items: AssignmentItem[] };
        setAssignments(data.items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")));
      }
      if (tplRes.ok) {
        const data = await tplRes.json() as { items: TemplateItem[] };
        setTemplates(data.items);
      }
      if (branchRes.ok) {
        const data = await branchRes.json() as { items: BranchOption[] };
        setBranches(data.items);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function openTplCreate() {
    setTplEditingId(null);
    setTplTitle("");
    setTplSubtitle("");
    setTplDescription("");
    setTplBranch(branches[0]?.name ?? "");
    setTplFormBransOpen(false);
    setTplIcon("pen");
    setTplIconPickerOpen(false);
    setTplKind("normal");
    setTplPuan(100);
    setTplGamified(false);
    setTplFormOpen(true);
  }
  function openTplEdit(t: TemplateItem) {
    setTplEditingId(t.id);
    setTplTitle(t.title);
    setTplSubtitle(t.subtitle ?? "");
    setTplDescription(t.description);
    setTplBranch(t.branch ?? branches[0]?.name ?? "");
    setTplFormBransOpen(false);
    setTplIcon(t.icon ?? "pen");
    setTplIconPickerOpen(false);
    setTplKind(t.kind ?? "normal");
    setTplPuan(t.maxPuan ?? 100);
    setTplGamified(t.gamifiedType === "kolaj");
    setTplFormOpen(true);
  }
  function closeTplForm() {
    setTplFormOpen(false);
    setTplFormBransOpen(false);
    setTplIconPickerOpen(false);
  }

  async function saveTplForm() {
    const title = tplTitle.trim();
    if (!title) { toast.error("Şablon adı zorunludur."); return; }
    const description = tplDescription.trim();
    if (!description) { toast.error("Açıklama zorunludur."); return; }
    const subtitle = tplSubtitle.trim() || undefined;
    const branch = tplBranch || undefined;
    setTplSaving(true);
    try {
      const headers = await authHeaders();
      // org-scope aktör için checkbox durumu HER ZAMAN gönderilir (false → null = "temizle",
      // JSON.stringify undefined key'i düşürür ama null'ı korur); self-scope eğitmende alan
      // hiç dahil edilmez (dokunmasın, kendi kişisel şablonunda zaten anlamsız).
      const gamifiedType = canPromoteGlobal ? (tplGamified ? "kolaj" : null) : undefined;
      const body = JSON.stringify({ title, subtitle, description, branch, icon: tplIcon, kind: tplKind, maxPuan: tplPuan, gamifiedType });
      if (tplEditingId) {
        const res = await fetch(`/api/flexos/assignment-templates/${tplEditingId}`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body });
        if (!res.ok) {
          const json = await res.json().catch(() => ({})) as { error?: string };
          toast.error(json.error ?? "Kaydedilemedi.");
          return;
        }
        toast.success("Şablon güncellendi.");
        const id = tplEditingId;
        const savedGamifiedType = gamifiedType === "kolaj" ? "kolaj" as const : undefined;
        setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, title, subtitle, description, branch, icon: tplIcon, kind: tplKind, maxPuan: tplPuan, gamifiedType: savedGamifiedType } : t)));
      } else {
        const res = await fetch("/api/flexos/assignment-templates", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body });
        if (!res.ok) {
          const json = await res.json().catch(() => ({})) as { error?: string };
          toast.error(json.error ?? "Kaydedilemedi.");
          return;
        }
        const { id } = await res.json() as { id: string };
        toast.success("Şablon oluşturuldu.");
        // visible varsayılan false (server-side default) — yeni oluşturulan şablon bilinen
        // alanlarla yerel state'e eklenir, koca liste yeniden çekilmez.
        setTemplates((prev) => [{ id, title, subtitle, description, branch, icon: tplIcon, kind: tplKind, maxPuan: tplPuan, visible: false, gamifiedType: gamifiedType === "kolaj" ? "kolaj" as const : undefined }, ...prev]);
      }
      setTplFormOpen(false);
    } finally {
      setTplSaving(false);
    }
  }

  async function toggleTplVisible(t: TemplateItem) {
    const nextVisible = !t.visible;
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/assignment-templates/${t.id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ visible: nextVisible }),
    });
    if (!res.ok) { toast.error("İşlem başarısız."); return; }
    setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, visible: nextVisible } : x)));
  }

  async function confirmTplDelete() {
    if (!tplDeleteTarget) return;
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/assignment-templates/${tplDeleteTarget.id}`, { method: "DELETE", headers });
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      toast.error(json.error ?? "Silinemedi.");
      return;
    }
    toast.success("Şablon silindi.");
    setTemplates((prev) => prev.filter((t) => t.id !== tplDeleteTarget.id));
    setTplDeleteTarget(null);
  }

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const activeList = assignments.filter((a) => a.status !== "archived");
  const archivedList = assignments.filter((a) => a.status === "archived");
  const list = tab === "active" ? activeList : archivedList;

  const bransList = [TUMU, ...branches.map((b) => b.name)];
  const filteredTemplates = bransFilter === TUMU ? templates : templates.filter((t) => t.branch === bransFilter);
  const visibleTemplateCount = templates.filter((t) => t.visible).length;

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
      const title = form.title.trim();
      const description = form.description.trim();
      const dueDate = form.dueDate ? new Date(form.dueDate).toISOString() : undefined;
      const body = { title, description, dueDate, status: form.status };
      const res = await fetch(`/api/flexos/assignments/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast.error(json.error ?? "Kaydedilemedi.");
        return;
      }
      toast.success("Ödev güncellendi.");
      setModalOpen(false);
      // Sunucudan tekrar çekmek yerine (koca liste + spinner flaşı) sadece bu satırı güncelle.
      setAssignments((prev) => prev.map((a) => (a.id === editingId ? { ...a, title, description, dueDate, status: form.status } : a)));
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
    setAssignments((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    setDeleteTarget(null);
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
    setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, status } : x)));
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const headers = await authHeaders();
    const deletedIds = new Set<string>();
    for (const id of selectedIds) {
      const res = await fetch(`/api/flexos/assignments/${id}`, { method: "DELETE", headers });
      if (res.ok) deletedIds.add(id);
    }
    toast.success(`${deletedIds.size} ödev silindi.`);
    setAssignments((prev) => prev.filter((a) => !deletedIds.has(a.id)));
    setSelectedIds(new Set());
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
                { key: "templates", label: "Şablon Yönetimi" },
                { key: "active", label: "Mevcut Ödevler" },
                { key: "archive", label: "Arşiv" },
                { key: "pool", label: "Havuz Yönetimi" },
                { key: "globalLibrary", label: "Global Kütüphane" },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setSelectedIds(new Set()); }}
                  className={`px-5 py-2 rounded-[10px] text-[13px] font-bold transition-all cursor-pointer outline-none ${
                    tab === t.key ? "bg-white text-base-primary-900 shadow-sm border border-surface-100" : "text-surface-400 hover:text-surface-600 border border-transparent"
                  }`}
                >
                  {t.label}
                  {(t.key === "templates" || t.key === "active" || t.key === "archive") &&
                    ` (${t.key === "templates" ? templates.length : t.key === "active" ? activeList.length : archivedList.length})`}
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
              {tab === "templates" && (
                <>
                  <span className="text-[12px] font-bold text-[#007A30] bg-[#E6F5ED] px-2.5 py-1.5 rounded-full whitespace-nowrap">
                    {visibleTemplateCount} şablon kütüphanede
                  </span>
                  <div className="relative">
                    <button
                      onClick={() => setBransFilterOpen((v) => !v)}
                      className="flex items-center gap-2.5 h-11 pl-3.5 pr-3 rounded-xl border border-[#E2E5EA] bg-white text-[13.5px] font-semibold text-[#1E222B] cursor-pointer hover:border-[#CDD2DA] hover:bg-[#F7F8FA] transition-all"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: bransFilter === TUMU ? "#CDD2DA" : branchColorFor(bransFilter).dot }} />
                      {bransFilter}
                      <ChevronDown size={14} className="text-[#8E95A3]" style={{ transform: bransFilterOpen ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
                    </button>
                    {bransFilterOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setBransFilterOpen(false)} />
                        <div className="absolute right-0 top-[calc(100%+8px)] w-[200px] bg-white border border-[#E2E5EA] rounded-2xl shadow-xl p-2 z-50">
                          {bransList.map((b) => (
                            <button
                              key={b}
                              onClick={() => { setBransFilter(b); setBransFilterOpen(false); }}
                              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13.5px] font-semibold cursor-pointer transition-colors ${
                                bransFilter === b ? "bg-[#E2EAF3] text-[#205297]" : "text-[#414B59] hover:bg-[#F7F8FA]"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b === TUMU ? "#CDD2DA" : branchColorFor(b).dot }} />
                                {b}
                              </span>
                              {bransFilter === b && <Check size={14} className="text-[#205297]" />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={openTplCreate}
                    className="flex items-center gap-2 h-11 px-4.5 rounded-xl border-none text-white text-[13.5px] font-bold cursor-pointer transition-all"
                    style={{ background: "linear-gradient(135deg,#FF8D28,#D66500)", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}
                  >
                    <Plus size={16} strokeWidth={2.4} /> Şablon Oluştur
                  </button>
                </>
              )}
            </div>
          </div>

          {tab === "templates" && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-24 text-surface-400">
                  <Loader2 size={22} className="animate-spin" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="bg-white rounded-2xl border border-surface-100 flex flex-col items-center justify-center py-20 text-surface-300">
                  <ClipboardList size={32} className="mb-3 opacity-40" />
                  <p className="text-[14px] font-semibold">{bransFilter === TUMU ? "Henüz şablon yok." : "Bu branşta henüz şablon yok."}</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-4 px-5 py-3 bg-surface-50 border-b border-surface-100">
                    <div className="w-56 shrink-0"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Şablon Adı</span></div>
                    <div className="flex-1 min-w-0"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Açıklama</span></div>
                    <div className="w-40 shrink-0"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Branş</span></div>
                    <div className="w-32 shrink-0 text-right"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">İşlem</span></div>
                  </div>

                  {filteredTemplates.map((t) => {
                    const c = branchColorFor(t.branch);
                    const RowIcon = (t.icon && ASSIGNMENT_ICONS[t.icon]) || ClipboardList;
                    return (
                      <div key={t.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#FBFCFD] transition-colors border-b border-surface-50 last:border-0">
                        <div className="w-56 shrink-0 min-w-0 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.background, color: c.color }}>
                            <RowIcon size={17} />
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-[13.5px] font-bold text-base-primary-900 truncate block">{t.title}</span>
                            {t.subtitle && <span className="text-[11.5px] text-surface-400 font-medium truncate block">{t.subtitle}</span>}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] text-surface-500 truncate block">{t.description || <span className="italic text-surface-300">—</span>}</span>
                        </div>
                        <div className="w-40 shrink-0">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-bold whitespace-nowrap" style={{ color: c.color, background: c.background }}>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dot }} />
                            {t.branch ?? "—"}
                          </span>
                        </div>
                        <div className="w-32 shrink-0 flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => toggleTplVisible(t)}
                            title={t.visible ? "Kütüphaneden kaldır" : "Kütüphanede göster"}
                            className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                              t.visible ? "border-[#A7E0BD] bg-[#E6F5ED] text-[#007A30]" : "border-[#F3B0B0] bg-[#FFECEC] text-[#D93636]"
                            }`}
                          >
                            {t.visible ? <Check size={15} /> : <X size={15} />}
                          </button>
                          <button
                            onClick={() => openTplEdit(t)}
                            title="Düzenle"
                            className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#E2E5EA] bg-white text-[#6F7B87] hover:border-[#92b6e8] hover:text-[#2867bd] hover:bg-[#EFF3FA] transition-all cursor-pointer"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setTplDeleteTarget(t)}
                            title="Sil"
                            className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#E2E5EA] bg-white text-[#6F7B87] hover:border-[#F3B0B0] hover:text-[#D93636] hover:bg-[#FFECEC] transition-all cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-between gap-4 px-5 py-3 border-t border-surface-100 bg-surface-50">
                    <span className="text-[13px] text-surface-500 font-medium">
                      Toplam <strong className="text-base-primary-900 font-bold">{filteredTemplates.length}</strong> şablon gösteriliyor
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {(tab === "active" || tab === "archive") && (loading ? (
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
          ))}

          {tab === "pool" && <CollagePoolPanel />}
          {tab === "globalLibrary" && <GlobalLibraryPanel />}
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

      {/* Şablon Oluştur/Düzenle modalı — "Ödev Ekle" (OdevOlusturModal) ile AYNI framer-motion
          geçiş animasyonu + portal deseni (backdrop 0.18s fade, panel 0.24s scale/y). */}
      {tplMounted && createPortal(
        <AnimatePresence>
          {tplFormOpen && (
            <motion.div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4"
              style={{ background: "rgba(15,26,48,.55)", backdropFilter: "blur(2px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => !tplSaving && closeTplForm()}
            >
              <motion.div
                className="w-full flex flex-col bg-white rounded-[20px] shadow-2xl overflow-hidden font-inter"
                style={{ maxWidth: 780, height: "min(820px, calc(100dvh - 32px))" }}
                initial={{ opacity: 0, scale: 0.98, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 8 }}
                transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-4 px-7 py-5 border-b border-[#EEF0F3] shrink-0">
                  <div className="flex items-center gap-3.5">
                    <div className="w-[42px] h-[42px] rounded-xl bg-[#FFEAD7] text-[#C2410C] flex items-center justify-center shrink-0">
                      <ClipboardList size={21} />
                    </div>
                    <div>
                      <h3 className="text-[18px] font-extrabold text-[#1E222B] tracking-tight">{tplEditingId ? "Şablonu Düzenle" : "Yeni Şablon Oluştur"}</h3>
                      <p className="text-[12.5px] text-[#8E95A3] font-medium mt-0.5">{tplEditingId ? "Şablon bilgilerini güncelleyin." : "Ödev şablonu bilgilerini girin."}</p>
                    </div>
                  </div>
                  <button onClick={closeTplForm} className="w-9 h-9 rounded-xl border border-[#E2E5EA] bg-white flex items-center justify-center text-[#6F7B87] hover:bg-[#F7F8FA] hover:text-[#1E222B] transition-colors cursor-pointer shrink-0">
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-7 py-5 flex flex-col gap-4" style={{ scrollbarGutter: "stable" }}>
                  {/* Şablon Adı (üst) + Alt Başlık (alt) solda; İkon Seçimi sağda, dikey/uzun buton
                      — "Ödev Ekle" modalıyla AYNI düzen. */}
                  <div className="flex gap-3 items-stretch">
                    <div className="flex-1 flex flex-col gap-2.5 min-w-0">
                      <div>
                        <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Şablon Adı</label>
                        <input
                          value={tplTitle}
                          onChange={(e) => setTplTitle(e.target.value)}
                          placeholder="Örn. Poster Tasarım Ödevi"
                          className="w-full px-4 py-3 rounded-xl border border-[#E2E5EA] bg-[#FBFCFD] text-[14px] font-medium text-[#1E222B] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Alt Başlık</label>
                        <input
                          value={tplSubtitle}
                          onChange={(e) => setTplSubtitle(e.target.value)}
                          placeholder="Kısa bir alt başlık (opsiyonel)"
                          className="w-full px-4 py-3 rounded-xl border border-[#E2E5EA] bg-[#FBFCFD] text-[14px] font-medium text-[#1E222B] outline-none"
                        />
                      </div>
                    </div>
                    <div className="w-[130px] shrink-0 flex flex-col">
                      <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">İkon Seçimi</label>
                      <button
                        type="button"
                        onClick={() => setTplIconPickerOpen((v) => !v)}
                        className="flex-1 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer transition-all"
                        style={{ border: `1px solid ${tplIconPickerOpen ? "#205297" : "#E2E5EA"}`, background: tplIconPickerOpen ? "#EFF5FE" : "#FBFCFD", color: "#205297" }}
                      >
                        {(() => { const SeciliIcon = ASSIGNMENT_ICONS[tplIcon]; return <SeciliIcon size={19} />; })()}
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold">
                          Seç
                          <ChevronDown size={11} color="#8E95A3" style={{ transform: tplIconPickerOpen ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
                        </span>
                      </button>
                    </div>
                  </div>

                  {tplIconPickerOpen && (
                    <div className="border border-[#E2E5EA] rounded-xl p-2.5 bg-[#FBFCFD]">
                      <div className="text-[10.5px] font-bold text-[#8E95A3] mb-2">Bir ikon seçin</div>
                      <div className="grid grid-cols-8 gap-1.5">
                        {ASSIGNMENT_ICON_KEYS.map((key) => {
                          const Icon = ASSIGNMENT_ICONS[key];
                          const aktif = key === tplIcon;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => { setTplIcon(key); setTplIconPickerOpen(false); }}
                              className="aspect-square rounded-lg flex items-center justify-center cursor-pointer transition-all"
                              style={{ border: `1px solid ${aktif ? "#205297" : "#E2E5EA"}`, background: aktif ? "#205297" : "#fff", color: aktif ? "#fff" : "#6F7B87" }}
                            >
                              <Icon size={16} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ödev Türü + Branş — TEK satır */}
                  <div className="flex gap-2.5 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Ödev Türü</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {ASSIGNMENT_KIND_OPTIONS.map((k) => {
                          const aktif = k.key === tplKind;
                          return (
                            <button
                              key={k.key}
                              type="button"
                              onClick={() => setTplKind(k.key)}
                              className="flex items-center gap-1.5 py-3 px-2.5 rounded-xl cursor-pointer transition-all"
                              style={{ border: `1px solid ${aktif ? "#AECBF2" : "#E2E5EA"}`, background: aktif ? "#EFF5FE" : "#FBFCFD", color: "#1E222B" }}
                            >
                              <span
                                className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center"
                                style={{ background: aktif ? "#DDE8F8" : "#F2F4F7", color: aktif ? "#205297" : "#8E95A3" }}
                              >
                                {k.key === "proje" ? <ClipboardList size={12} /> : <Pencil size={12} />}
                              </span>
                              <span className="text-[12.5px] font-bold">{k.label}</span>
                              {aktif && <Check size={13} strokeWidth={2.6} color="#205297" className="ml-auto" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="relative flex-1 min-w-[180px]">
                      <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Branş</label>
                      <button
                        type="button"
                        onClick={() => setTplFormBransOpen((v) => !v)}
                        className="w-full flex items-center justify-between gap-2.5 px-3.5 py-3 rounded-xl border border-[#E2E5EA] bg-[#FBFCFD] text-[14px] font-semibold text-[#1E222B] cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: branchColorFor(tplBranch).dot }} />
                          {tplBranch || "Branş seçin"}
                        </span>
                        <ChevronDown size={14} className="text-[#8E95A3]" />
                      </button>
                      {tplFormBransOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setTplFormBransOpen(false)} />
                          <div className="absolute left-0 right-0 top-[calc(100%+6px)] bg-white border border-[#E2E5EA] rounded-xl shadow-xl p-2 z-50">
                            {branches.length === 0 ? (
                              <div className="px-3 py-2 text-[13px] text-surface-400 font-medium">Branş bulunamadı</div>
                            ) : branches.map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => { setTplBranch(b.name); setTplFormBransOpen(false); }}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13.5px] font-semibold cursor-pointer transition-colors ${
                                  tplBranch === b.name ? "bg-[#E2EAF3] text-[#205297]" : "text-[#414B59] hover:bg-[#F7F8FA]"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: branchColorFor(b.name).dot }} />
                                  {b.name}
                                </span>
                                {tplBranch === b.name && <Check size={14} className="text-[#205297]" />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Ödev Puanı — "Ödev Ekle" ile aynı alan */}
                  <div>
                    <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Ödev Puanı</label>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="relative shrink-0">
                        <input
                          className="w-[120px] py-3 pl-4 pr-[42px] rounded-xl border border-[#E2E5EA] bg-[#FBFCFD] text-[14px] font-extrabold text-[#1E222B] outline-none"
                          type="number" min={0} value={tplPuan} onChange={(e) => setTplPuan(Math.max(0, parseInt(e.target.value, 10) || 0))} placeholder="100"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#8E95A3] pointer-events-none">puan</span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {PUAN_HIZLI.map((p) => {
                          const aktif = tplPuan === p;
                          return (
                            <button
                              key={p} type="button" onClick={() => setTplPuan(p)}
                              className="py-1.5 px-3 rounded-lg text-[11.5px] font-bold cursor-pointer transition-all"
                              style={{ border: `1px solid ${aktif ? "#205297" : "#E2E5EA"}`, background: aktif ? "#EFF5FE" : "#fff", color: aktif ? "#205297" : "#6F7B87" }}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {canPromoteGlobal && (
                    <button
                      type="button"
                      onClick={() => setTplGamified((v) => !v)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all text-left"
                      style={{ border: `1px solid ${tplGamified ? "#AECBF2" : "#E2E5EA"}`, background: tplGamified ? "#EFF5FE" : "#FBFCFD" }}
                    >
                      <div>
                        <p className="text-[13px] font-bold text-[#1E222B]">Global Kütüphane&apos;ye ekle (Kolaj Bahçesi)</p>
                        <p className="text-[11.5px] text-[#8E95A3] mt-0.5">Eğitmenler bu şablonu kendi kütüphanelerine ekleyip çekiliş ödevini başlatabilir.</p>
                      </div>
                      <span
                        className="w-10 h-6 rounded-full shrink-0 relative transition-colors"
                        style={{ background: tplGamified ? "#205297" : "#D0D5DE" }}
                      >
                        <span
                          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                          style={{ left: tplGamified ? 18 : 2 }}
                        />
                      </span>
                    </button>
                  )}

                  <div>
                    <label className="block text-[12.5px] font-bold text-[#414B59] mb-2">Açıklama</label>
                    <textarea
                      value={tplDescription}
                      onChange={(e) => setTplDescription(e.target.value)}
                      rows={4}
                      placeholder="Şablonun neyi kapsadığını kısaca açıklayın…"
                      className="w-full px-4 py-3 rounded-xl border border-[#E2E5EA] bg-[#FBFCFD] text-[14px] font-medium text-[#1E222B] outline-none resize-none leading-relaxed"
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end px-7 py-4.5 border-t border-[#EEF0F3] shrink-0">
                  <button onClick={closeTplForm} disabled={tplSaving} className="px-5 py-2.5 rounded-xl border border-[#E2E5EA] bg-white text-[#414B59] text-[14px] font-semibold hover:bg-[#F7F8FA] transition-colors cursor-pointer disabled:opacity-50">
                    Vazgeç
                  </button>
                  <button
                    onClick={saveTplForm}
                    disabled={tplSaving || !tplTitle.trim()}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl border-none text-white text-[14px] font-bold cursor-pointer disabled:cursor-not-allowed transition-all"
                    style={{ background: tplSaving || !tplTitle.trim() ? "#CDD2DA" : "linear-gradient(135deg,#FF8D28,#D66500)" }}
                  >
                    {tplSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {tplEditingId ? "Değişiklikleri Kaydet" : "Şablon Oluştur"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Şablon silme onayı */}
      {tplDeleteTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0F1A30]/45 p-4" onClick={() => setTplDeleteTarget(null)}>
          <div className="bg-white rounded-[18px] shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6.5 pt-6.5 pb-5">
              <div className="w-12 h-12 rounded-xl bg-[#FFECEC] text-[#D93636] flex items-center justify-center mb-4">
                <Trash2 size={22} />
              </div>
              <h3 className="text-[18px] font-extrabold text-[#1E222B] tracking-tight">Şablonu sil</h3>
              <p className="text-[14px] text-[#6F7B87] mt-2 leading-relaxed">
                <span className="font-bold text-[#1E222B]">{tplDeleteTarget.title}</span> şablonunu silmek üzeresiniz. Bu işlem geri alınamaz.
              </p>
            </div>
            <div className="flex gap-2.5 justify-end px-6.5 pb-5.5">
              <button onClick={() => setTplDeleteTarget(null)} className="px-5 py-2.5 rounded-xl border border-[#E2E5EA] bg-white text-[#414B59] text-[14px] font-semibold hover:bg-[#F7F8FA] transition-colors cursor-pointer">Vazgeç</button>
              <button onClick={confirmTplDelete} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-none bg-[#D93636] text-white text-[14px] font-bold cursor-pointer transition-all" style={{ boxShadow: "0 8px 18px -8px rgba(217,54,54,.6)" }}>
                <Trash2 size={16} /> Evet, sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
