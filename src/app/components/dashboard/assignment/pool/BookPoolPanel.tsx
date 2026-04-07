"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import {
  Plus, Trash2, Edit2, Check, X,
  ChevronLeft, ChevronRight, BookOpen,
} from "lucide-react";
import type { BookPool, BookItem } from "./poolTypes";

const PAGE_SIZE = 10;

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

/** "1" → "01", "12" → "12" */
function formatBookId(raw: string) {
  const s = raw.trim();
  return s.length === 1 ? "0" + s : s;
}

/** "135x195" / "135 x195" → "135 x 195" */
function formatDimensions(raw: string) {
  return raw.trim().replace(/\s*x\s*/gi, " x ");
}

// ─── FormSlide ────────────────────────────────────────────────────────────────
// Her zaman DOM'da, sadece görünürlük animasyonla değişir.
// Unmount/remount yerine daima mount → CSS transition güvenilir çalışır.
function FormSlide({ show, children }: { show: boolean; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) { setVisible(false); return; }
    // 20ms: browser "0fr" state'ini paint etsin, sonra transition başlasın
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <div style={{
      display: "grid",
      gridTemplateRows: visible ? "1fr" : "0fr",
      opacity: visible ? 1 : 0,
      pointerEvents: visible ? "auto" : "none",
      transition: "grid-template-rows 0.65s cubic-bezier(0.22,1,0.36,1), opacity 0.45s ease",
    }}>
      <div style={{ overflow: "hidden" }}>{children}</div>
    </div>
  );
}

// ─── Form alanı ──────────────────────────────────────────────────────────────
const EMPTY_FIELDS: Omit<BookItem, "id"> = {
  bookId: "", isbn: "", title: "", author: "",
  publisher: "", pageCount: "", dimensions: "",
  genre: "", subGenre: "", backCover: "",
};

const INPUT_CLS = "w-full h-9 px-3 text-[13px] font-medium border border-surface-200 rounded-xl bg-white outline-none focus:border-base-primary-400 transition-colors text-text-primary placeholder:text-surface-400";
const LABEL_CLS = "block text-[12px] font-bold text-surface-700 mb-1";

function BookForm({
  initial,
  defaultBookId,
  onSave,
  onCancel,
}: {
  initial?: BookItem;
  defaultBookId?: string;
  onSave: (item: BookItem) => Promise<void>;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<Omit<BookItem, "id">>(() =>
    initial
      ? { bookId: initial.bookId, isbn: initial.isbn, title: initial.title, author: initial.author, publisher: initial.publisher, pageCount: initial.pageCount, dimensions: initial.dimensions, genre: initial.genre, subGenre: initial.subGenre, backCover: initial.backCover }
      : { ...EMPTY_FIELDS, bookId: defaultBookId ?? "" }
  );
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields(p => ({ ...p, [key]: e.target.value }));

  const handleSave = async () => {
    if (!fields.title.trim() || !fields.author.trim()) return;
    setLoading(true);
    await onSave({
      id: initial?.id ?? generateId(),
      ...fields,
      bookId: formatBookId(fields.bookId),
      dimensions: formatDimensions(fields.dimensions),
    });
    setLoading(false);
  };

  const isEdit = !!initial;

  return (
    <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden mb-5">
      {/* Başlık */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 bg-surface-50/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-base-primary-900 flex items-center justify-center">
            <BookOpen size={15} className="text-white" />
          </div>
          <p className="text-[15px] font-extrabold text-text-primary">
            {isEdit ? "Kitabı Düzenle" : "Yeni Kitap Ekle"}
          </p>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors cursor-pointer">
          <X size={15} />
        </button>
      </div>

      {/* Alanlar */}
      <div className="px-5 py-5 space-y-4">

        {/* Satır 1: Kitap ID + ISBN */}
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <div>
            <label className={LABEL_CLS}>Kitap ID</label>
            <input value={fields.bookId} onChange={set("bookId")} placeholder="01"
              className={INPUT_CLS} autoFocus={!isEdit} />
          </div>
          <div>
            <label className={LABEL_CLS}>ISBN No</label>
            <input value={fields.isbn} onChange={set("isbn")} placeholder="9781234567890"
              className={INPUT_CLS} />
          </div>
        </div>

        {/* Satır 2: Kitap Adı */}
        <div>
          <label className={LABEL_CLS}>Kitap Adı <span className="text-status-danger-500">*</span></label>
          <input value={fields.title} onChange={set("title")} placeholder="Sefiller"
            className={INPUT_CLS} autoFocus={isEdit} />
        </div>

        {/* Satır 3: Yazar + Yayınevi */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLS}>Yazar Adı <span className="text-status-danger-500">*</span></label>
            <input value={fields.author} onChange={set("author")} placeholder="Victor Hugo"
              className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Yayınevi</label>
            <input value={fields.publisher} onChange={set("publisher")} placeholder="Can Yayınları"
              className={INPUT_CLS} />
          </div>
        </div>

        {/* Satır 4: Sayfa Sayısı + Boyutlar */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLS}>Sayfa Sayısı</label>
            <input value={fields.pageCount} onChange={set("pageCount")} placeholder="480"
              className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Boyutlar (En x Boy)</label>
            <input value={fields.dimensions} onChange={set("dimensions")} placeholder="135 x 195"
              className={INPUT_CLS} />
          </div>
        </div>

        {/* Satır 5: Tür + Alt Tür */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLS}>Kitap Türü</label>
            <input value={fields.genre} onChange={set("genre")} placeholder="Roman"
              className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Alt Tür</label>
            <input value={fields.subGenre} onChange={set("subGenre")} placeholder="Tarihi Roman"
              className={INPUT_CLS} />
          </div>
        </div>

        {/* Satır 6: Arka Kapak */}
        <div>
          <label className={LABEL_CLS}>Arka Kapak Yazısı</label>
          <textarea value={fields.backCover} onChange={set("backCover")}
            placeholder="Kitabın kısa özeti..." rows={4}
            className="w-full px-3 py-2.5 text-[13px] font-medium border border-surface-200 rounded-xl bg-white outline-none focus:border-base-primary-400 transition-colors resize-none text-text-primary placeholder:text-surface-400" />
        </div>

        {/* Butonlar */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-surface-300">* zorunlu alan</p>
          <div className="flex gap-2">
            <button onClick={onCancel}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 cursor-pointer transition-colors">
              <X size={13} /> İptal
            </button>
            <button onClick={handleSave} disabled={!fields.title.trim() || !fields.author.trim() || loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 disabled:opacity-40 cursor-pointer transition-colors">
              <Check size={13} /> {isEdit ? "Güncelle" : "Kaydet"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Kitap satırı ─────────────────────────────────────────────────────────────
function BookRow({
  item,
  index,
  onEdit,
  onDelete,
}: {
  item: BookItem;
  index: number;
  onEdit: (item: BookItem) => void;
  onDelete: (item: BookItem) => void;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5 border-b border-surface-100 last:border-0 group hover:bg-surface-50 transition-colors">
      {/* ID badge */}
      <div className="w-9 h-9 rounded-xl bg-base-primary-50 border border-base-primary-100 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[12px] font-extrabold text-base-primary-700 tabular-nums">{item.bookId || "—"}</span>
      </div>
      {/* Bilgi */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-text-primary truncate leading-tight">{item.title || "—"}</p>
        <p className="text-[12px] font-medium text-surface-500 truncate mt-0.5">{item.author}</p>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          {item.genre && (
            <span className="text-[11px] font-medium text-surface-400 bg-surface-100 px-2 py-0.5 rounded-lg">
              {item.genre}{item.subGenre ? ` › ${item.subGenre}` : ""}
            </span>
          )}
          {item.publisher && (
            <span className="text-[11px] text-surface-400">{item.publisher}</span>
          )}
          {item.pageCount && (
            <span className="text-[11px] text-surface-300">· {item.pageCount} s.</span>
          )}
          {item.dimensions && (
            <span className="text-[11px] text-surface-300">· {item.dimensions}</span>
          )}
        </div>
      </div>
      {/* Aksiyon */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
        <button onClick={() => onEdit(item)}
          className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors cursor-pointer" title="Düzenle">
          <Edit2 size={13} />
        </button>
        <button onClick={() => onDelete(item)}
          className="p-1.5 rounded-lg hover:bg-status-danger-50 text-surface-400 hover:text-status-danger-500 transition-colors cursor-pointer" title="Sil">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const count = Math.ceil(total / PAGE_SIZE);
  if (count <= 1) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-surface-100 bg-surface-50/60">
      <p className="text-[12px] font-medium text-surface-400">
        <span className="font-bold text-text-primary">{total}</span> kitap · Sayfa{" "}
        <span className="font-bold text-text-primary">{page + 1}</span> / {count}
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 0}
          className="p-1.5 rounded-lg border border-surface-200 hover:bg-white disabled:opacity-30 cursor-pointer transition-colors">
          <ChevronLeft size={14} />
        </button>
        {Array.from({ length: count }).map((_, i) => (
          <button key={i} onClick={() => onChange(i)}
            className={`w-8 h-8 rounded-lg text-[12px] font-bold border cursor-pointer transition-all ${
              i === page ? "bg-base-primary-900 text-white border-base-primary-900" : "border-surface-200 text-surface-500 hover:bg-white"
            }`}>
            {i + 1}
          </button>
        ))}
        <button onClick={() => onChange(page + 1)} disabled={page === count - 1}
          className="p-1.5 rounded-lg border border-surface-200 hover:bg-white disabled:opacity-30 cursor-pointer transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Ana bileşen ─────────────────────────────────────────────────────────────
export default function BookPoolPanel() {
  const [pool,        setPool]        = useState<BookPool | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [adding,      setAdding]      = useState(false);
  const [editingItem, setEditingItem] = useState<BookItem | null>(null);
  const [page,        setPage]        = useState(0);
  const formContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "lottery_configs", "book"), snap => {
      setPool(snap.exists() ? (snap.data() as BookPool) : null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const showForm = adding || !!editingItem;

  // Click-outside: 50ms gecikme ile aynı click'in formu kapatmasını önler
  useEffect(() => {
    if (!showForm) return;
    const handle = (e: MouseEvent) => {
      if (formContainerRef.current && !formContainerRef.current.contains(e.target as Node)) {
        setAdding(false);
        setEditingItem(null);
      }
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handle), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handle); };
  }, [showForm]);

  // Bir sonraki bookId: mevcut max + 1, 2 haneli
  const nextBookId = useMemo(() => {
    if (!pool?.items.length) return "01";
    const max = Math.max(...pool.items.map(i => parseInt(i.bookId) || 0));
    const next = max + 1;
    return next < 10 ? "0" + next : String(next);
  }, [pool]);

  const handleAdd = async (item: BookItem) => {
    if (!pool) return;
    await updateDoc(doc(db, "lottery_configs", "book"), { items: [...pool.items, item] });
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
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-surface-400">
        <BookOpen size={36} className="text-surface-200" />
        <p className="text-[15px] font-bold">Kitap havuzu henüz yüklenmemiş</p>
        <p className="text-[13px]">Migration sayfasından verileri aktarın.</p>
      </div>
    );
  }

  // bookId'ye göre sırala
  const sorted = [...pool.items].sort((a, b) =>
    (parseInt(a.bookId) || 0) - (parseInt(b.bookId) || 0)
  );
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-0 relative">

      {/* Form */}
      <div ref={formContainerRef}>
        <FormSlide show={adding}>
          <BookForm defaultBookId={nextBookId} onSave={handleAdd} onCancel={() => setAdding(false)} />
        </FormSlide>
        <FormSlide show={!!editingItem}>
          {editingItem && (
            <BookForm initial={editingItem} onSave={handleEdit} onCancel={() => setEditingItem(null)} />
          )}
        </FormSlide>
      </div>

      {/* Liste başlığı */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-medium text-surface-400">
          <span className="font-bold text-text-primary">{pool.items.length}</span> kitap · ID sıralı
        </p>
        <button
          onClick={() => { setAdding(true); setEditingItem(null); }}
          disabled={adding}
          className="flex items-center gap-2 px-4 py-2 bg-base-primary-900 text-white rounded-xl text-[13px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
        >
          <Plus size={14} /> Ekle
        </button>
      </div>

      {/* Liste kartı */}
      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
        {paged.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3 text-surface-300">
            <BookOpen size={32} />
            <p className="text-[14px] font-bold text-surface-400">Henüz kitap yok</p>
          </div>
        ) : (
          paged.map((item, i) =>
            editingItem?.id === item.id ? null : (
              <BookRow
                key={item.id}
                item={item}
                index={page * PAGE_SIZE + i}
                onEdit={item => { setEditingItem(item); setAdding(false); }}
                onDelete={handleDelete}
              />
            )
          )
        )}
        <Pagination page={page} total={sorted.length} onChange={setPage} />
      </div>

    </div>
  );
}
