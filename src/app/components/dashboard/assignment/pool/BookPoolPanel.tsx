"use client";

import React, { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import type { BookPool, BookItem } from "./poolTypes";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const EMPTY: Omit<BookItem, "id"> = { bookId: "", title: "", author: "", genre: "", subGenre: "", isbn: "", publisher: "", pageCount: "", dimensions: "", backCover: "" };

function BookRow({
  item,
  onEdit,
  onDelete,
}: {
  item: BookItem;
  onEdit: (item: BookItem) => void;
  onDelete: (item: BookItem) => void;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-surface-100 last:border-0 group hover:bg-surface-50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-text-primary truncate">{item.title || "—"}</p>
        <p className="text-[12px] text-surface-500 truncate">{item.author}</p>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {item.genre && <span className="text-[11px] text-surface-400">{item.genre}{item.subGenre ? ` › ${item.subGenre}` : ""}</span>}
          {item.pageCount && <span className="text-[11px] text-surface-300">·</span>}
          {item.pageCount && <span className="text-[11px] text-surface-400">{item.pageCount}</span>}
          {item.dimensions && <span className="text-[11px] text-surface-300">·</span>}
          {item.dimensions && <span className="text-[11px] text-surface-400">{item.dimensions}</span>}
        </div>
        <p className="text-[11px] text-surface-400 truncate">{item.publisher}{item.isbn ? ` · ${item.isbn}` : ""}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
        <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors cursor-pointer"><Edit2 size={13} /></button>
        <button onClick={() => onDelete(item)} className="p-1.5 rounded-lg hover:bg-status-danger-50 text-surface-400 hover:text-status-danger-500 transition-colors cursor-pointer"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function BookForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: BookItem;
  onSave: (item: BookItem) => Promise<void>;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<Omit<BookItem, "id">>({
    bookId: initial?.bookId ?? "",
    title: initial?.title ?? "",
    author: initial?.author ?? "",
    genre: initial?.genre ?? "",
    subGenre: initial?.subGenre ?? "",
    isbn: initial?.isbn ?? "",
    publisher: initial?.publisher ?? "",
    pageCount: initial?.pageCount ?? "",
    dimensions: initial?.dimensions ?? "",
    backCover: initial?.backCover ?? "",
  });
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields(prev => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    if (!fields.title.trim()) return;
    setLoading(true);
    await onSave({ id: initial?.id ?? generateId(), ...fields });
    setLoading(false);
  };

  return (
    <div className="px-4 py-3 bg-base-primary-50 border-b border-base-primary-100 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={fields.title} onChange={set("title")} placeholder="Kitap adı *" autoFocus
          className="h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400 col-span-2" />
        <input value={fields.author} onChange={set("author")} placeholder="Yazar"
          className="h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400" />
        <input value={fields.publisher} onChange={set("publisher")} placeholder="Yayınevi"
          className="h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400" />
        <input value={fields.genre} onChange={set("genre")} placeholder="Tür (Edebiyat)"
          className="h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400" />
        <input value={fields.subGenre} onChange={set("subGenre")} placeholder="Alt tür (Bilimkurgu)"
          className="h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400" />
        <input value={fields.isbn} onChange={set("isbn")} placeholder="ISBN"
          className="h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400" />
        <input value={fields.pageCount} onChange={set("pageCount")} placeholder="Sayfa sayısı"
          className="h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400" />
        <input value={fields.dimensions} onChange={set("dimensions")} placeholder="Boyutlar (105x175mm)"
          className="h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400" />
        <input value={fields.bookId} onChange={set("bookId")} placeholder="Kitap ID"
          className="h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400" />
      </div>
      <textarea value={fields.backCover} onChange={set("backCover")} placeholder="Arka kapak yazısı" rows={3}
        className="w-full px-3 py-2 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400 resize-none" />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-surface-200 text-[12px] font-bold text-surface-600 hover:bg-surface-50 cursor-pointer">
          <X size={12} /> Vazgeç
        </button>
        <button onClick={handleSave} disabled={!fields.title.trim() || loading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-base-primary-900 text-white text-[12px] font-bold hover:bg-base-primary-800 disabled:opacity-40 cursor-pointer">
          <Check size={12} /> Kaydet
        </button>
      </div>
    </div>
  );
}

export default function BookPoolPanel() {
  const [pool, setPool] = useState<BookPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<BookItem | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "lottery_configs", "book"), snap => {
      setPool(snap.exists() ? (snap.data() as BookPool) : null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAdd = async (item: BookItem) => {
    if (!pool) return;
    await updateDoc(doc(db, "lottery_configs", "book"), {
      items: [...pool.items, item],
    });
    setAdding(false);
  };

  const handleEdit = async (updated: BookItem) => {
    if (!pool) return;
    await updateDoc(doc(db, "lottery_configs", "book"), {
      items: pool.items.map(i => (i.id === updated.id ? updated : i)),
    });
    setEditingItem(null);
  };

  const handleDelete = async (item: BookItem) => {
    if (!pool) return;
    await updateDoc(doc(db, "lottery_configs", "book"), {
      items: pool.items.filter(i => i.id !== item.id),
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
        <p className="text-[14px] font-semibold mb-2">Kitap havuzu henüz yüklenmemiş</p>
        <p className="text-[12px]">Migration sayfasından verileri aktarın.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-surface-500">
          <span className="font-bold text-text-primary">{pool.items.length}</span> kitap
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
          <BookForm onSave={handleAdd} onCancel={() => setAdding(false)} />
        )}
        {pool.items.length === 0 && !adding ? (
          <div className="py-12 text-center text-surface-400 text-[13px]">Henüz kitap yok</div>
        ) : (
          pool.items.map(item =>
            editingItem?.id === item.id ? (
              <BookForm
                key={item.id}
                initial={item}
                onSave={handleEdit}
                onCancel={() => setEditingItem(null)}
              />
            ) : (
              <BookRow
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
