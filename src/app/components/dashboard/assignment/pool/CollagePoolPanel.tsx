"use client";

import React, { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc, arrayRemove } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import {
  Plus, Trash2, Edit2, Check, X,
  ChevronLeft, ChevronRight,
  Cloud, Leaf, Wand2, Gem,
  type LucideIcon,
} from "lucide-react";
import type { CollagePool, CollageItem } from "./poolTypes";

const CAT_ORDER = ["Gök", "Yer", "Obje 1", "Obje 2"] as const;
type Category = (typeof CAT_ORDER)[number];

const CAT_META: Record<Category, {
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  activeBg: string;
  activeText: string;
  iconColor: string;
}> = {
  "Gök":    { icon: Cloud,  color: "#6366f1", iconColor: "#818cf8", bg: "bg-indigo-50",  border: "border-indigo-200", activeBg: "bg-indigo-600",  activeText: "text-white" },
  "Yer":    { icon: Leaf,   color: "#16a34a", iconColor: "#4ade80", bg: "bg-green-50",   border: "border-green-200",  activeBg: "bg-green-600",   activeText: "text-white" },
  "Obje 1": { icon: Wand2,  color: "#d97706", iconColor: "#fbbf24", bg: "bg-amber-50",   border: "border-amber-200",  activeBg: "bg-amber-500",   activeText: "text-white" },
  "Obje 2": { icon: Gem,    color: "#db2777", iconColor: "#f472b6", bg: "bg-pink-50",    border: "border-pink-200",   activeBg: "bg-pink-600",    activeText: "text-white" },
};

const PAGE_SIZE = 10;

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Satır içi form (ekle / düzenle) ────────────────────────────────────────
function ItemForm({
  category,
  initial,
  onSave,
  onCancel,
}: {
  category: Category;
  initial?: CollageItem;
  onSave: (item: CollageItem) => Promise<void>;
  onCancel: () => void;
}) {
  const [name,    setName]    = useState(initial?.name    ?? "");
  const [emoji,   setEmoji]   = useState(initial?.emoji   ?? "");
  const [color,   setColor]   = useState(initial?.color   || "#e5e7eb");
  const [loading, setLoading] = useState(false);
  const meta = CAT_META[category];

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await onSave({ id: initial?.id ?? generateId(), name: name.trim(), category, color, emoji: emoji.trim() });
    setLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className={`flex items-center gap-2.5 px-5 py-3 ${meta.bg} border-b ${meta.border}`}>
      <input
        value={emoji}
        onChange={e => setEmoji(e.target.value)}
        onKeyDown={handleKey}
        placeholder="✦"
        maxLength={2}
        className="w-10 h-9 text-center text-base border border-surface-200 rounded-xl bg-white outline-none focus:border-base-primary-400 transition-colors shrink-0"
      />
      <input
        type="color"
        value={color}
        onChange={e => setColor(e.target.value)}
        title="Renk seç"
        className="w-9 h-9 rounded-xl border border-surface-200 cursor-pointer shrink-0 p-0.5 bg-white"
      />
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={handleKey}
        placeholder={`${category} öğesi...`}
        autoFocus
        className="flex-1 h-9 px-3 text-[14px] font-medium border border-surface-200 rounded-xl bg-white outline-none focus:border-base-primary-400 transition-colors"
      />
      <button
        onClick={handleSave}
        disabled={!name.trim() || loading}
        className="h-9 w-9 flex items-center justify-center rounded-xl bg-base-primary-600 text-white hover:bg-base-primary-700 disabled:opacity-40 cursor-pointer transition-colors shrink-0"
      >
        <Check size={14} />
      </button>
      <button
        onClick={onCancel}
        className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-surface-100 text-surface-400 cursor-pointer transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Tek öğe satırı ──────────────────────────────────────────────────────────
function ItemRow({
  item,
  index,
  onEdit,
  onDelete,
}: {
  item: CollageItem;
  index: number;
  onEdit: (item: CollageItem) => void;
  onDelete: (item: CollageItem) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-surface-100 last:border-0 group hover:bg-surface-50 transition-colors">
      <span className="text-[12px] font-bold text-surface-300 w-6 text-right shrink-0 tabular-nums">
        {index + 1}
      </span>
      <span className="text-base w-7 text-center shrink-0 leading-none">
        {item.emoji || <span className="text-surface-200 text-[11px]">—</span>}
      </span>
      <div
        className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
        style={{ backgroundColor: item.color || "#e5e7eb" }}
      />
      <span className="flex-1 text-[14px] font-semibold text-text-primary truncate">{item.name}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(item)}
          className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors cursor-pointer"
          title="Düzenle"
        >
          <Edit2 size={13} />
        </button>
        <button
          onClick={() => onDelete(item)}
          className="p-1.5 rounded-lg hover:bg-status-danger-50 text-surface-400 hover:text-status-danger-500 transition-colors cursor-pointer"
          title="Sil"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-surface-100 bg-surface-50/60">
      <p className="text-[12px] font-medium text-surface-400">
        <span className="font-bold text-text-primary">{total}</span> öğe
        &nbsp;·&nbsp;
        Sayfa <span className="font-bold text-text-primary">{page + 1}</span> / {pageCount}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 0}
          className="p-1.5 rounded-lg border border-surface-200 hover:bg-white disabled:opacity-30 transition-colors cursor-pointer"
        >
          <ChevronLeft size={14} />
        </button>
        {Array.from({ length: pageCount }).map((_, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={`w-8 h-8 rounded-lg text-[12px] font-bold transition-all cursor-pointer border ${
              i === page
                ? "bg-base-primary-900 text-white border-base-primary-900"
                : "border-surface-200 text-surface-500 hover:bg-white"
            }`}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === pageCount - 1}
          className="p-1.5 rounded-lg border border-surface-200 hover:bg-white disabled:opacity-30 transition-colors cursor-pointer"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Form açılış/kapanış animasyonu ──────────────────────────────────────────
function FormSlide({ show, children }: { show: boolean; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <div style={{
      display: "grid",
      gridTemplateRows: visible ? "1fr" : "0fr",
      opacity: visible ? 1 : 0,
      pointerEvents: visible ? "auto" : "none",
      transition: "grid-template-rows 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease",
    }}>
      <div style={{ overflow: "hidden" }}>{children}</div>
    </div>
  );
}

// ─── Sekme içerik alanı (transition ile) ─────────────────────────────────────
function TabContent({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (visible) {
      const t = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(t);
    } else {
      setMounted(false);
    }
  }, [visible]);

  if (!visible) return null;
  return (
    <div
      className="transition-all duration-300 ease-out"
      style={{
        opacity:    mounted ? 1 : 0,
        transform:  mounted ? "translateY(0)" : "translateY(6px)",
        position:   "relative",
        zIndex:     20,
      }}
    >
      {children}
    </div>
  );
}

// ─── Ana bileşen ─────────────────────────────────────────────────────────────
export default function CollagePoolPanel() {
  const [pool,        setPool]        = useState<CollagePool | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<Category>("Gök");
  const [adding,      setAdding]      = useState(false);
  const [editingItem, setEditingItem] = useState<CollageItem | null>(null);
  const [pages,       setPages]       = useState<Record<Category, number>>({
    "Gök": 0, "Yer": 0, "Obje 1": 0, "Obje 2": 0,
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "lottery_configs", "collage"), snap => {
      setPool(snap.exists() ? (snap.data() as CollagePool) : null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleTabChange = (cat: Category) => {
    setActiveTab(cat);
    setAdding(false);
    setEditingItem(null);
    setPages(p => ({ ...p, [cat]: 0 }));
  };

  const handleAdd = async (item: CollageItem) => {
    if (!pool) return;
    await updateDoc(doc(db, "lottery_configs", "collage"), { items: [...pool.items, item] });
    setAdding(false);
  };

  const handleEdit = async (updated: CollageItem) => {
    if (!pool) return;
    await updateDoc(doc(db, "lottery_configs", "collage"), {
      items: pool.items.map(i => (i.id === updated.id ? updated : i)),
    });
    setEditingItem(null);
  };

  const handleDelete = async (item: CollageItem) => {
    await updateDoc(doc(db, "lottery_configs", "collage"), { items: arrayRemove(item) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-surface-400">
        <Leaf size={36} className="text-surface-200" />
        <p className="text-[15px] font-bold">Kolaj havuzu henüz yüklenmemiş</p>
        <p className="text-[13px]">Migration sayfasından verileri aktarın.</p>
      </div>
    );
  }

  const catItems   = pool.items.filter(it => it.category === activeTab);
  const page       = pages[activeTab];
  const pageCount  = Math.ceil(catItems.length / PAGE_SIZE);
  const pagedItems = catItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const meta       = CAT_META[activeTab];
  const CatIcon    = meta.icon;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Sekme başlıkları ── */}
      <div className="relative z-20 flex items-center gap-2 bg-surface-100/70 p-1 rounded-2xl w-fit">
        {CAT_ORDER.map(cat => {
          const m      = CAT_META[cat];
          const Icon   = m.icon;
          const count  = pool.items.filter(it => it.category === cat).length;
          const active = cat === activeTab;
          return (
            <button
              key={cat}
              onClick={() => handleTabChange(cat)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-bold transition-all duration-200 cursor-pointer ${
                active
                  ? `${m.activeBg} ${m.activeText} shadow-sm`
                  : "text-surface-500 hover:text-text-primary hover:bg-white"
              }`}
            >
              <Icon size={15} className={active ? "text-white/80" : ""} style={active ? {} : { color: m.iconColor }} />
              {cat}
              <span
                className={`text-[11px] font-black px-1.5 py-0.5 rounded-full tabular-nums ${
                  active ? "bg-white/20 text-white" : "bg-surface-200 text-surface-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── İçerik kartı (animasyonlu) ── */}
      {CAT_ORDER.map(cat => {
        const m          = CAT_META[cat];
        const Icon       = m.icon;
        const thisCatItems   = pool.items.filter(it => it.category === cat);
        const thisPage       = pages[cat];
        const thisPageCount  = Math.ceil(thisCatItems.length / PAGE_SIZE);
        const thisPagedItems = thisCatItems.slice(thisPage * PAGE_SIZE, (thisPage + 1) * PAGE_SIZE);

        return (
          <TabContent key={cat} visible={activeTab === cat}>
            <div className="relative z-20 bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">

              {/* Kart başlığı */}
              <div className={`flex items-center justify-between px-5 py-4 border-b ${m.border} ${m.bg}`}>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${m.activeBg}`}
                  >
                    <Icon size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[17px] font-extrabold text-text-primary leading-none">{cat}</p>
                    <p className="text-[13px] font-medium text-surface-400 mt-0.5">
                      {thisCatItems.length} öğe
                      {thisPageCount > 1 && ` · Sayfa ${thisPage + 1}/${thisPageCount}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setAdding(true); setEditingItem(null); }}
                  disabled={adding}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm ${m.activeBg} ${m.activeText} hover:opacity-90 active:scale-95`}
                >
                  <Plus size={14} />
                  Ekle
                </button>
              </div>

              {/* Form */}
              <FormSlide show={adding && activeTab === cat}>
                <ItemForm
                  category={cat as Category}
                  onSave={handleAdd}
                  onCancel={() => setAdding(false)}
                />
              </FormSlide>

              {/* Boş durum */}
              {thisPagedItems.length === 0 && !(adding && activeTab === cat) ? (
                <div className="py-14 flex flex-col items-center gap-3 text-surface-300">
                  <Icon size={32} />
                  <p className="text-[14px] font-bold text-surface-400">{cat} kategorisinde henüz öğe yok</p>
                  <p className="text-[12px] text-surface-300">Ekle butonuyla öğe ekleyebilirsin</p>
                </div>
              ) : (
                thisPagedItems.map((item, i) =>
                  editingItem?.id === item.id ? (
                    <ItemForm
                      key={item.id}
                      category={cat as Category}
                      initial={item}
                      onSave={handleEdit}
                      onCancel={() => setEditingItem(null)}
                    />
                  ) : (
                    <ItemRow
                      key={item.id}
                      item={item}
                      index={thisPage * PAGE_SIZE + i}
                      onEdit={setEditingItem}
                      onDelete={handleDelete}
                    />
                  )
                )
              )}

              {/* Pagination */}
              <Pagination
                page={thisPage}
                total={thisCatItems.length}
                pageSize={PAGE_SIZE}
                onChange={p => setPages(prev => ({ ...prev, [cat]: p }))}
              />
            </div>
          </TabContent>
        );
      })}

      {/* ── Genel özet ── */}
      <div className="flex items-center gap-3 px-1 flex-wrap">
        {CAT_ORDER.map(cat => {
          const count = pool.items.filter(it => it.category === cat).length;
          const m     = CAT_META[cat];
          const Icon  = m.icon;
          return (
            <div key={cat} className={`flex items-center gap-2 px-3.5 py-2 rounded-xl ${m.bg} border ${m.border}`}>
              <Icon size={13} style={{ color: m.color }} />
              <span className="text-[12px] font-bold text-text-primary">{cat}</span>
              <span className="text-[12px] font-extrabold tabular-nums" style={{ color: m.color }}>{count}</span>
            </div>
          );
        })}
        <div className="ml-auto text-[12px] font-medium text-surface-400">
          Toplam <span className="font-extrabold text-text-primary">{pool.items.length}</span> öğe
        </div>
      </div>

    </div>
  );
}
