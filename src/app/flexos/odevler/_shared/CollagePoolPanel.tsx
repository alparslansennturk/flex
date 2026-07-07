"use client";

/**
 * Havuz Yönetimi — Kolaj Bahçesi sekmesi. Canlının `pool/CollagePoolPanel.tsx`
 * UI portu (4 kategori sekmesi, ekle/düzenle/sil) — ama doğrudan Firestore yerine
 * `/api/flexos/collage-pool` GET/PATCH'e bağlı, ve PAYLAŞIMLI-DEĞİL: her eğitmen
 * SADECE KENDİ bağımsız havuz kopyasını görür/düzenler (2026-07-07 kararı — bir
 * eğitmenin ekleme/düzenlemesi başka eğitmeni etkilemesin, kaos riski).
 */
import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Check, X, Cloud, Leaf, Wand2, Gem, Loader2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";

const CAT_ORDER = ["Gök", "Yer", "Obje 1", "Obje 2"] as const;
type Category = (typeof CAT_ORDER)[number];

interface CollageItem { id: string; name: string; category: Category; color: string; emoji: string }
interface CollagePool { id: string; tenantId: string; trainerId?: string; items: CollageItem[] }

const CAT_META: Record<Category, { icon: LucideIcon; color: string; bg: string; border: string; activeBg: string }> = {
  "Gök": { icon: Cloud, color: "#6366f1", bg: "bg-indigo-50", border: "border-indigo-200", activeBg: "bg-indigo-600" },
  "Yer": { icon: Leaf, color: "#16a34a", bg: "bg-green-50", border: "border-green-200", activeBg: "bg-green-600" },
  "Obje 1": { icon: Wand2, color: "#d97706", bg: "bg-amber-50", border: "border-amber-200", activeBg: "bg-amber-500" },
  "Obje 2": { icon: Gem, color: "#db2777", bg: "bg-pink-50", border: "border-pink-200", activeBg: "bg-pink-600" },
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

function ItemForm({
  category, initial, onSave, onCancel,
}: { category: Category; initial?: CollageItem; onSave: (item: CollageItem) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "");
  const [color, setColor] = useState(initial?.color || "#e5e7eb");
  const [loading, setLoading] = useState(false);
  const meta = CAT_META[category];

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSave({ id: initial?.id ?? generateId(), name: name.trim(), category, color, emoji: emoji.trim() });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex items-center gap-2.5 px-5 py-3 ${meta.bg} border-b ${meta.border}`}>
      <input
        value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="✦" maxLength={2}
        className="w-10 h-9 text-center text-base border border-surface-200 rounded-xl bg-white outline-none focus:border-base-primary-400 transition-colors shrink-0"
      />
      <input
        type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Renk seç"
        className="w-9 h-9 rounded-xl border border-surface-200 cursor-pointer shrink-0 p-0.5 bg-white"
      />
      <input
        value={name} onChange={(e) => setName(e.target.value)} placeholder={`${category} öğesi...`} autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
        className="flex-1 h-9 px-3 text-[14px] font-medium border border-surface-200 rounded-xl bg-white outline-none focus:border-base-primary-400 transition-colors"
      />
      <button onClick={handleSave} disabled={!name.trim() || loading} className="h-9 w-9 flex items-center justify-center rounded-xl bg-base-primary-600 text-white hover:bg-base-primary-700 disabled:opacity-40 cursor-pointer transition-colors shrink-0">
        <Check size={14} />
      </button>
      <button onClick={onCancel} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-surface-100 text-surface-400 cursor-pointer transition-colors shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

export default function CollagePoolPanel() {
  const [pool, setPool] = useState<CollagePool | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Category>("Gök");
  const [adding, setAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<CollageItem | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/collage-pool", { headers });
      if (res.ok) {
        const data = await res.json() as { pool: CollagePool | null };
        setPool(data.pool);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  async function persist(items: CollageItem[]) {
    setSaving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/collage-pool", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast.error(json.error ?? "Kaydedilemedi.");
        return;
      }
      const data = await res.json() as { pool: CollagePool };
      setPool(data.pool);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd(item: CollageItem) {
    if (!pool) return;
    await persist([...pool.items, item]);
    setAdding(false);
  }
  async function handleEdit(updated: CollageItem) {
    if (!pool) return;
    await persist(pool.items.map((i) => (i.id === updated.id ? updated : i)));
    setEditingItem(null);
  }
  async function handleDelete(item: CollageItem) {
    if (!pool) return;
    await persist(pool.items.filter((i) => i.id !== item.id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-surface-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="bg-white rounded-2xl border border-surface-100 flex flex-col items-center justify-center py-20 gap-3 text-surface-300">
        <Leaf size={32} className="opacity-40" />
        <p className="text-[14px] font-bold text-surface-500">Henüz bir oyunlaştırılmış ödev eklemediniz</p>
        <p className="text-[12.5px] text-surface-400">Global Kütüphane sekmesinden &quot;Kolaj Bahçesi&quot;ni kütüphanenize ekleyin.</p>
      </div>
    );
  }

  const meta = CAT_META[activeTab];
  const items = pool.items.filter((i) => i.category === activeTab);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 bg-surface-100/70 p-1 rounded-2xl w-fit">
        {CAT_ORDER.map((cat) => {
          const m = CAT_META[cat];
          const Icon = m.icon;
          const count = pool.items.filter((i) => i.category === cat).length;
          const active = cat === activeTab;
          return (
            <button
              key={cat}
              onClick={() => { setActiveTab(cat); setAdding(false); setEditingItem(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer ${
                active ? `${m.activeBg} text-white shadow-sm` : "text-surface-500 hover:text-text-primary hover:bg-white"
              }`}
            >
              <Icon size={15} />
              {cat}
              <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-full tabular-nums ${active ? "bg-white/20 text-white" : "bg-surface-200 text-surface-500"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
        <div className={`flex items-center justify-between px-5 py-4 border-b ${meta.border} ${meta.bg}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.activeBg}`}>
              <meta.icon size={18} className="text-white" />
            </div>
            <p className="text-[17px] font-extrabold text-text-primary">{activeTab}</p>
          </div>
          <button
            onClick={() => { setAdding(true); setEditingItem(null); }}
            disabled={adding || saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm text-white hover:opacity-90 active:scale-95 ${meta.activeBg}`}
          >
            <Plus size={14} /> Ekle
          </button>
        </div>

        {adding && <ItemForm category={activeTab} onSave={handleAdd} onCancel={() => setAdding(false)} />}

        {items.length === 0 && !adding ? (
          <div className="py-14 flex flex-col items-center gap-3 text-surface-300">
            <meta.icon size={32} />
            <p className="text-[14px] font-bold text-surface-400">{activeTab} kategorisinde henüz öğe yok</p>
          </div>
        ) : (
          items.map((item, i) =>
            editingItem?.id === item.id ? (
              <ItemForm key={item.id} category={activeTab} initial={item} onSave={handleEdit} onCancel={() => setEditingItem(null)} />
            ) : (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3 border-b border-surface-100 last:border-0 group hover:bg-surface-50 transition-colors">
                <span className="text-[12px] font-bold text-surface-300 w-6 text-right shrink-0 tabular-nums">{i + 1}</span>
                <span className="text-base w-7 text-center shrink-0 leading-none">{item.emoji || <span className="text-surface-200 text-[11px]">—</span>}</span>
                <div className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: item.color || "#e5e7eb" }} />
                <span className="flex-1 text-[14px] font-semibold text-text-primary truncate">{item.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingItem(item)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors cursor-pointer" title="Düzenle">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-status-danger-50 text-surface-400 hover:text-status-danger-500 transition-colors cursor-pointer" title="Sil">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}
