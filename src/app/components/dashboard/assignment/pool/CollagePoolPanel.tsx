"use client";

import React, { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import type { CollagePool, CollageItem } from "./poolTypes";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const EMPTY_ITEM: Omit<CollageItem, "id"> = { name: "", category: "", color: "#6366f1", emoji: "" };

function ItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: CollageItem;
  onEdit: (item: CollageItem) => void;
  onDelete: (item: CollageItem) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-100 last:border-0 group hover:bg-surface-50 transition-colors">
      <span className="text-xl w-8 text-center shrink-0">{item.emoji || "—"}</span>
      <div
        className="w-4 h-4 rounded-full shrink-0 border border-surface-200"
        style={{ backgroundColor: item.color || "#e5e7eb" }}
      />
      <span className="flex-1 text-[13px] font-medium text-text-primary truncate">{item.name}</span>
      {item.category && (
        <span className="text-[11px] text-surface-400 shrink-0 px-2 py-0.5 bg-surface-100 rounded-lg">{item.category}</span>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(item)}
          className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors cursor-pointer"
        >
          <Edit2 size={13} />
        </button>
        <button
          onClick={() => onDelete(item)}
          className="p-1.5 rounded-lg hover:bg-status-danger-50 text-surface-400 hover:text-status-danger-500 transition-colors cursor-pointer"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function ItemForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: CollageItem;
  onSave: (item: CollageItem) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [color, setColor] = useState(initial?.color ?? "#6366f1");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await onSave({ id: initial?.id ?? generateId(), name: name.trim(), category: category.trim(), color, emoji: emoji.trim() });
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-base-primary-50 border-b border-base-primary-100">
      <input
        value={emoji}
        onChange={e => setEmoji(e.target.value)}
        placeholder="🌸"
        maxLength={2}
        className="w-10 text-center text-xl border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400 transition-colors"
      />
      <input
        type="color"
        value={color}
        onChange={e => setColor(e.target.value)}
        className="w-8 h-8 rounded-lg border border-surface-200 cursor-pointer shrink-0"
      />
      <input
        value={category}
        onChange={e => setCategory(e.target.value)}
        placeholder="Kategori (Gök)"
        className="w-28 h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400 transition-colors"
      />
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="İsim"
        autoFocus
        className="flex-1 h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400 transition-colors"
      />
      <button
        onClick={handleSave}
        disabled={!name.trim() || loading}
        className="p-1.5 rounded-lg bg-base-primary-600 text-white hover:bg-base-primary-700 disabled:opacity-40 cursor-pointer transition-colors"
      >
        <Check size={13} />
      </button>
      <button
        onClick={onCancel}
        className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 cursor-pointer transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export default function CollagePoolPanel() {
  const [pool, setPool] = useState<CollagePool | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<CollageItem | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "lottery_configs", "collage"), snap => {
      setPool(snap.exists() ? (snap.data() as CollagePool) : null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAdd = async (item: CollageItem) => {
    await updateDoc(doc(db, "lottery_configs", "collage"), {
      items: [...(pool?.items ?? []), item],
    });
    setAdding(false);
  };

  const handleEdit = async (updated: CollageItem) => {
    if (!pool) return;
    const items = pool.items.map(i => (i.id === updated.id ? updated : i));
    await updateDoc(doc(db, "lottery_configs", "collage"), { items });
    setEditingItem(null);
  };

  const handleDelete = async (item: CollageItem) => {
    await updateDoc(doc(db, "lottery_configs", "collage"), {
      items: arrayRemove(item),
    });
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
      <div className="flex flex-col items-center justify-center py-16 text-surface-400">
        <p className="text-[14px] font-semibold mb-2">Kolaj havuzu henüz yüklenmemiş</p>
        <p className="text-[12px]">Migration sayfasından verileri aktarın.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-surface-500">
          <span className="font-bold text-text-primary">{pool.items.length}</span> öğe
        </p>
        <button
          onClick={() => { setAdding(true); setEditingItem(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-base-primary-900 text-white rounded-xl text-[12px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={13} /> Ekle
        </button>
      </div>

      <div className="bg-white rounded-16 border border-surface-100 shadow-sm overflow-hidden">
        {adding && (
          <ItemForm
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
          />
        )}
        {pool.items.length === 0 && !adding ? (
          <div className="py-12 text-center text-surface-400 text-[13px]">Henüz öğe yok</div>
        ) : (
          pool.items.map(item =>
            editingItem?.id === item.id ? (
              <ItemForm
                key={item.id}
                initial={item}
                onSave={handleEdit}
                onCancel={() => setEditingItem(null)}
              />
            ) : (
              <ItemRow
                key={item.id}
                item={item}
                onEdit={setEditingItem}
                onDelete={handleDelete}
              />
            )
          )
        )}
      </div>
    </div>
  );
}
