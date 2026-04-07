"use client";

import React, { useEffect, useState, useMemo } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import {
  Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronRight, ChevronUp,
  Building2, Tag, Smartphone, FileText, Globe, Layers,
} from "lucide-react";
import type { SocialMediaPool, SMBrand, SMSector, SMFormat } from "./poolTypes";

type SMTab = "sectors" | "brands" | "formats" | "rule";

function genId() { return Math.random().toString(36).slice(2, 10); }

const inputCls = "h-9 px-3 text-[13px] border border-surface-200 rounded-xl bg-white outline-none focus:border-base-primary-400 transition-colors";
const labelCls = "text-[11px] font-bold text-surface-500 uppercase tracking-wide mb-1";

// ─── Sektörler Sekmesi ────────────────────────────────────────────────────────

// Alt sektör chip — isme tıklayınca aşağıdaki input'a taşır (düzenleme için)
function SubChip({ value, active, onSelect, onDelete }: {
  value: string;
  active: boolean;
  onSelect: () => void;
  onDelete: () => Promise<void>;
}) {
  return (
    <div className={`flex items-center gap-1.5 pl-3 pr-1.5 py-1 border rounded-full text-[12px] font-semibold transition-colors ${
      active
        ? "bg-base-primary-600 border-base-primary-600 text-white"
        : "bg-base-primary-50 border-base-primary-100 text-base-primary-700 hover:border-base-primary-300"
    }`}>
      <button onClick={onSelect} className="cursor-pointer">{value}</button>
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className={`w-4 h-4 flex items-center justify-center rounded-full cursor-pointer transition-colors ${
          active ? "hover:bg-base-primary-500 text-white/70 hover:text-white" : "hover:bg-base-primary-200 text-base-primary-400 hover:text-base-primary-700"
        }`}
      >
        <X size={10} strokeWidth={2.5} />
      </button>
    </div>
  );
}

function SectorAccordion({
  sector, onRename, onDelete, onAddSub, onRenameSub, onDeleteSub,
}: {
  sector: SMSector;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddSub: (sub: string) => Promise<void>;
  onRenameSub: (old: string, next: string) => Promise<void>;
  onDeleteSub: (sub: string) => Promise<void>;
}) {
  const [open, setOpen]           = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName]           = useState(sector.name);
  const [subInput, setSubInput]   = useState("");
  const [editingSub, setEditingSub] = useState<string | null>(null); // hangi alt sektör düzenleniyor
  const [saving, setSaving]       = useState(false);

  const saveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onRename(name.trim());
    setSaving(false);
    setEditingName(false);
  };

  // Alt sektör ekleme veya güncelleme
  const submitSub = async () => {
    if (!subInput.trim()) return;
    setSaving(true);
    if (editingSub !== null) {
      await onRenameSub(editingSub, subInput.trim());
      setEditingSub(null);
    } else {
      await onAddSub(subInput.trim());
    }
    setSaving(false);
    setSubInput("");
  };

  // Chip'e tıklanınca input'a taşı
  const selectSub = (sub: string) => {
    setEditingSub(sub);
    setSubInput(sub);
  };

  const cancelSubEdit = () => {
    setEditingSub(null);
    setSubInput("");
  };

  const enterEdit = (e: React.MouseEvent) => { e.stopPropagation(); setEditingName(true); };

  return (
    <div className="border border-surface-100 rounded-2xl overflow-hidden bg-white">
      {/* Header — genel alan accordion toggle, başlık & düzenle butonu edit mode */}
      <div
        onClick={() => !editingName && setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-3 bg-surface-50 border-b border-surface-100 cursor-pointer hover:bg-surface-100/60 transition-colors group"
      >
        <span className="text-surface-400 shrink-0">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>

        {editingName ? (
          <>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setName(sector.name); setEditingName(false); } }}
              onClick={e => e.stopPropagation()}
              autoFocus
              className={`flex-1 ${inputCls}`}
            />
            <button onClick={e => { e.stopPropagation(); saveName(); }} disabled={!name.trim() || saving}
              className="p-1.5 rounded-lg bg-base-primary-600 text-white hover:bg-base-primary-700 disabled:opacity-40 cursor-pointer shrink-0"><Check size={13} /></button>
            <button onClick={e => { e.stopPropagation(); setName(sector.name); setEditingName(false); }}
              className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 cursor-pointer shrink-0"><X size={13} /></button>
          </>
        ) : (
          <>
            {/* Boş alan — accordion toggle için tıklanabilir, flex-1 ile genişler */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
              {/* Başlık — sadece metin kadar yer kaplar */}
              <button
                onClick={enterEdit}
                className="text-[14px] font-bold text-text-primary hover:text-base-primary-700 cursor-pointer transition-colors truncate"
              >
                {sector.name}
              </button>
              <span className="text-[11px] font-semibold text-surface-400 bg-surface-100 px-2 py-0.5 rounded-full shrink-0">
                {sector.subSectors.length} alt sektör
              </span>
            </div>
            {/* Düzenle butonu — her zaman görünür, sağ köşede */}
            <button
              onClick={enterEdit}
              className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-400 hover:text-surface-700 cursor-pointer transition-colors shrink-0"
              title="Düzenle"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded-lg hover:bg-status-danger-50 text-surface-400 hover:text-status-danger-500 cursor-pointer transition-colors shrink-0"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>

      {/* Body */}
      {open && (
        <div className="px-4 py-3 space-y-3">
          {/* Sub-sector chips */}
          {sector.subSectors.length === 0 ? (
            <p className="text-[12px] text-surface-300 italic">Henüz alt sektör eklenmemiş.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sector.subSectors.map(sub => (
                <SubChip
                  key={sub}
                  value={sub}
                  active={editingSub === sub}
                  onSelect={() => selectSub(sub)}
                  onDelete={() => onDeleteSub(sub)}
                />
              ))}
            </div>
          )}

          {/* Add / edit sub input */}
          <div className="flex items-center gap-2 pt-1 border-t border-surface-100">
            <div className="flex-1 relative">
              <input
                value={subInput}
                onChange={e => setSubInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitSub(); if (e.key === "Escape") cancelSubEdit(); }}
                placeholder={editingSub ? `"${editingSub}" düzenleniyor...` : "Alt sektör ekle..."}
                className={`w-full ${inputCls} ${editingSub ? "border-base-primary-400 bg-base-primary-50" : ""}`}
              />
              {editingSub && (
                <button onClick={cancelSubEdit} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 cursor-pointer">
                  <X size={12} />
                </button>
              )}
            </div>
            <button onClick={submitSub} disabled={!subInput.trim() || saving}
              className="h-9 px-4 rounded-xl bg-base-primary-600 text-white text-[12px] font-bold hover:bg-base-primary-700 disabled:opacity-40 cursor-pointer transition-colors shrink-0 flex items-center gap-1.5">
              {editingSub ? <><Check size={12} /> Güncelle</> : <><Plus size={12} /> Ekle</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectorsTab({ pool, onUpdate }: { pool: SocialMediaPool; onUpdate: (sectors: SMSector[]) => Promise<void> }) {
  const [newMain, setNewMain] = useState("");
  const [saving, setSaving]   = useState(false);

  const addMain = async () => {
    if (!newMain.trim()) return;
    setSaving(true);
    const updated = [...pool.sectors, { id: genId(), name: newMain.trim(), subSectors: [] }];
    await onUpdate(updated);
    setNewMain("");
    setSaving(false);
  };

  const rename = async (id: string, name: string) => {
    const updated = pool.sectors.map(s => s.id === id ? { ...s, name } : s);
    await onUpdate(updated);
  };

  const deleteSector = async (id: string) => {
    await onUpdate(pool.sectors.filter(s => s.id !== id));
  };

  const addSub = async (id: string, sub: string) => {
    const updated = pool.sectors.map(s =>
      s.id === id && !s.subSectors.includes(sub)
        ? { ...s, subSectors: [...s.subSectors, sub] }
        : s
    );
    await onUpdate(updated);
  };

  const renameSub = async (id: string, old: string, next: string) => {
    const updated = pool.sectors.map(s =>
      s.id === id
        ? { ...s, subSectors: s.subSectors.map(ss => ss === old ? next : ss) }
        : s
    );
    await onUpdate(updated);
  };

  const deleteSub = async (id: string, sub: string) => {
    const updated = pool.sectors.map(s =>
      s.id === id ? { ...s, subSectors: s.subSectors.filter(ss => ss !== sub) } : s
    );
    await onUpdate(updated);
  };

  return (
    <div className="space-y-5">
      {/* Add main sector */}
      <div className="bg-white rounded-2xl border border-surface-100 p-5 shadow-sm space-y-3">
        <p className="text-[13px] font-bold text-text-primary flex items-center gap-2">
          <Layers size={15} className="text-base-primary-500" />
          Yeni Ana Sektör Ekle
        </p>
        <div className="flex items-center gap-2">
          <input
            value={newMain}
            onChange={e => setNewMain(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addMain(); }}
            placeholder="ör. Yeme & İçme, Teknoloji, Moda..."
            className={`flex-1 ${inputCls}`}
          />
          <button onClick={addMain} disabled={!newMain.trim() || saving} className="h-9 px-5 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 disabled:opacity-40 cursor-pointer transition-colors shrink-0 flex items-center gap-2">
            <Plus size={14} /> Ekle
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-[13px] font-bold text-text-primary">{pool.sectors.length} ana sektör</span>
        <span className="text-surface-300">·</span>
        <span className="text-[12px] text-surface-500">{pool.sectors.reduce((a, s) => a + s.subSectors.length, 0)} alt sektör</span>
      </div>

      {/* Sector list */}
      {pool.sectors.length === 0 ? (
        <div className="py-12 text-center text-surface-300 text-[13px] bg-white rounded-2xl border border-surface-100">
          Henüz sektör eklenmemiş.
        </div>
      ) : (
        <div className="space-y-2">
          {pool.sectors.map(s => (
            <SectorAccordion
              key={s.id}
              sector={s}
              onRename={name => rename(s.id, name)}
              onDelete={() => deleteSector(s.id)}
              onAddSub={sub => addSub(s.id, sub)}
              onRenameSub={(old, next) => renameSub(s.id, old, next)}
              onDeleteSub={sub => deleteSub(s.id, sub)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Markalar Sekmesi ─────────────────────────────────────────────────────────

function BrandForm({
  initial, sectors, globalPurposes, onSave, onCancel, autoFocus = true,
}: {
  initial?: SMBrand;
  sectors: SMSector[];
  globalPurposes: string[];
  onSave: (b: SMBrand) => Promise<void>;
  onCancel: () => void;
  autoFocus?: boolean;
}) {
  const [brandName,  setBrandName]  = useState(initial?.brandName  ?? "");
  const [mainSector, setMainSector] = useState(initial?.mainSector ?? "");
  const [subSector,  setSubSector]  = useState(initial?.subSector  ?? "");
  const [brandRule,  setBrandRule]  = useState(initial?.brandRule  ?? "");
  const [purposes,   setPurposes]   = useState<string[]>(initial?.purposes ?? []);
  const [customInput, setCustomInput] = useState("");
  const [loading, setLoading] = useState(false);

  const subOptions = sectors.find(s => s.name === mainSector)?.subSectors ?? [];

  const addFromPool = (p: string) => {
    if (purposes.includes(p)) return;
    setPurposes(ps => [...ps, p]);
  };

  const addCustom = () => {
    const v = customInput.trim();
    if (!v || purposes.includes(v)) return;
    setPurposes(ps => [...ps, v]);
    setCustomInput("");
  };

  const save = async () => {
    if (!brandName.trim()) return;
    setLoading(true);
    await onSave({
      id:         initial?.id ?? genId(),
      brandName:  brandName.trim(),
      mainSector: mainSector.trim(),
      subSector:  subSector.trim(),
      brandRule:  brandRule.trim(),
      purposes,
    });
    setLoading(false);
  };

  return (
    <div className="bg-base-primary-50 border border-base-primary-100 rounded-2xl p-5 space-y-4">
      <p className="text-[13px] font-bold text-base-primary-900">{initial ? "Markayı Düzenle" : "Yeni Marka Ekle"}</p>

      {/* Brand name */}
      <div>
        <p className={labelCls}>Marka Adı *</p>
        <input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="ör. Burger King"
          className={`w-full ${inputCls}`} autoFocus={autoFocus} />
      </div>

      {/* Sector selects */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className={labelCls}>Ana Sektör</p>
          <select value={mainSector} onChange={e => { setMainSector(e.target.value); setSubSector(""); }}
            className={`w-full ${inputCls} cursor-pointer`}>
            <option value="">— Seçiniz —</option>
            {sectors.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <p className={labelCls}>Alt Sektör</p>
          <select value={subSector} onChange={e => setSubSector(e.target.value)}
            disabled={!mainSector || subOptions.length === 0}
            className={`w-full ${inputCls} disabled:opacity-50 cursor-pointer`}>
            <option value="">— Seçiniz —</option>
            {subOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Purposes */}
      <div className="space-y-3">
        <p className={labelCls}>Amaçlar ({purposes.length})</p>

        {/* Eklenen amaçlar */}
        {purposes.length > 0 && (
          <div className="space-y-1.5">
            {purposes.map((p, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-surface-100 rounded-xl text-[13px] text-text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-base-primary-300 shrink-0" />
                <span className="flex-1">{p}</span>
                <button onClick={() => setPurposes(ps => ps.filter(x => x !== p))}
                  className="shrink-0 text-surface-300 hover:text-status-danger-500 cursor-pointer transition-colors p-0.5">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Ortak havuzdan seç */}
        {globalPurposes.length > 0 && (
          <div className="bg-white border border-surface-100 rounded-xl p-3 space-y-2">
            <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wide">Ortak Havuzdan Seç</p>
            <div className="flex flex-wrap gap-1.5">
              {globalPurposes.map((p, i) => {
                const added = purposes.includes(p);
                return (
                  <button
                    key={i}
                    onClick={() => added ? setPurposes(ps => ps.filter(x => x !== p)) : addFromPool(p)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold border cursor-pointer transition-colors ${
                      added
                        ? "bg-base-primary-600 border-base-primary-600 text-white"
                        : "bg-base-primary-50 border-base-primary-100 text-base-primary-700 hover:border-base-primary-400"
                    }`}
                  >
                    {added ? <Check size={10} /> : <Plus size={10} />}
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Özel amaç ekle */}
        <div>
          <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wide mb-1.5">Özel Amaç Ekle</p>
          <div className="flex items-center gap-2">
            <input value={customInput} onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
              placeholder="Bu markaya özel amaç..."
              className={`flex-1 ${inputCls}`} />
            <button onClick={addCustom} disabled={!customInput.trim()}
              className="h-9 px-3 rounded-xl bg-surface-100 text-surface-600 text-[12px] font-bold hover:bg-surface-200 disabled:opacity-40 cursor-pointer transition-colors">
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Brand rule */}
      <div>
        <p className={labelCls}>Marka Özel Kuralı (opsiyonel)</p>
        <textarea value={brandRule} onChange={e => setBrandRule(e.target.value)}
          placeholder="Bu markaya özel kural veya brief notu..."
          rows={2}
          className="w-full px-3 py-2 text-[13px] border border-surface-200 rounded-xl bg-white outline-none focus:border-base-primary-400 transition-colors resize-none" />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="h-9 px-4 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 cursor-pointer transition-colors">Vazgeç</button>
        <button onClick={save} disabled={!brandName.trim() || loading} className="h-9 px-5 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 disabled:opacity-40 cursor-pointer transition-colors flex items-center gap-1.5">
          <Check size={14} /> Kaydet
        </button>
      </div>
    </div>
  );
}

function BrandCard({
  brand, sectors, globalPurposes, onSave, onDelete,
}: {
  brand: SMBrand;
  sectors: SMSector[];
  globalPurposes: string[];
  onSave: (b: SMBrand) => Promise<void>;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-surface-100 last:border-0">
      {/* Header — tıklayınca açılır */}
      <div
        onClick={() => setOpen(o => !o)}
        className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-surface-50 transition-colors group"
      >
        <div className="w-9 h-9 rounded-xl bg-base-primary-50 flex items-center justify-center shrink-0 mt-0.5">
          <Building2 size={16} className="text-base-primary-500" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-text-primary leading-snug">{brand.brandName}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {brand.mainSector && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-base-primary-600 bg-base-primary-50 border border-base-primary-100 px-2 py-0.5 rounded-full">
                <Layers size={9} /> {brand.mainSector}
              </span>
            )}
            {brand.subSector && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-surface-600 bg-surface-100 px-2 py-0.5 rounded-full">
                <Tag size={9} /> {brand.subSector}
              </span>
            )}
            {brand.brandRule && (
              <span className="text-[11px] text-designstudio-secondary-500 font-medium flex items-center gap-1">
                <FileText size={9} /> Özel kural
              </span>
            )}
            {brand.purposes.length > 0 && (
              <span className="text-[11px] text-surface-400">{brand.purposes.length} amaç</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          {open ? (
            <span className="p-1.5 rounded-lg bg-surface-100 text-surface-500">
              <ChevronUp size={14} />
            </span>
          ) : (
            <>
              <button
                onClick={e => { e.stopPropagation(); onDelete(); }}
                className="p-1.5 rounded-lg hover:bg-status-danger-50 text-surface-400 hover:text-status-danger-500 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={13} />
              </button>
              <span className="p-1.5 text-surface-300"><ChevronDown size={14} /></span>
            </>
          )}
        </div>
      </div>

      {/* Expandable edit form with transition */}
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: open ? "800px" : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="px-5 pb-5 pt-1">
          <BrandForm
            initial={brand}
            sectors={sectors}
            globalPurposes={globalPurposes}
            onSave={async b => { await onSave(b); setOpen(false); }}
            onCancel={() => setOpen(false)}
            autoFocus={false}
          />
        </div>
      </div>
    </div>
  );
}

function BrandsTab({ pool, onUpdate }: { pool: SocialMediaPool; onUpdate: (brands: SMBrand[]) => Promise<void> }) {
  const [adding,     setAdding]     = useState(false);
  const [filterMain, setFilterMain] = useState("all");

  const filtered = useMemo(() =>
    filterMain === "all" ? pool.brands : pool.brands.filter(b => b.mainSector === filterMain),
    [pool.brands, filterMain]
  );

  const mainSectors = useMemo(() =>
    [...new Set(pool.sectors.map(s => s.name))].sort(),
    [pool.sectors]
  );

  const save = async (b: SMBrand) => {
    const exists = pool.brands.some(x => x.id === b.id);
    const updated = exists
      ? pool.brands.map(x => x.id === b.id ? b : x)
      : [...pool.brands, b];
    await onUpdate(updated);
    setAdding(false);
  };

  const del = async (id: string) => {
    await onUpdate(pool.brands.filter(b => b.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <select
          value={filterMain}
          onChange={e => setFilterMain(e.target.value)}
          className="h-9 px-3 text-[13px] font-semibold border border-surface-200 rounded-xl bg-white outline-none focus:border-base-primary-400 cursor-pointer transition-colors"
        >
          <option value="all">Tüm Sektörler ({pool.brands.length})</option>
          {mainSectors.map(s => {
            const cnt = pool.brands.filter(b => b.mainSector === s).length;
            return <option key={s} value={s}>{s} ({cnt})</option>;
          })}
        </select>

        <button
          onClick={() => setAdding(a => !a)}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer shadow-sm"
        >
          {adding ? <><X size={14} /> Kapat</> : <><Plus size={14} /> Yeni Marka</>}
        </button>
      </div>

      {/* Add form with transition */}
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: adding ? "900px" : "0px", opacity: adding ? 1 : 0 }}
      >
        <BrandForm sectors={pool.sectors} globalPurposes={pool.globalPurposes} onSave={save} onCancel={() => setAdding(false)} />
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-14 text-center text-surface-300 text-[13px]">
            {filterMain === "all" ? "Henüz marka eklenmemiş." : "Bu sektörde marka yok."}
          </div>
        ) : (
          filtered.map((b, i) => (
            <BrandCard
              key={b.id || `brand-${i}`}
              brand={b}
              sectors={pool.sectors}
              globalPurposes={pool.globalPurposes}
              onSave={save}
              onDelete={() => del(b.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Reklam Ölçüleri Sekmesi ──────────────────────────────────────────────────

function FormatRow({ fmt, onEdit, onDelete }: { fmt: SMFormat; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-surface-100 last:border-0 group hover:bg-surface-50 transition-colors">
      <span className="w-28 shrink-0 text-[12px] font-bold text-base-primary-700 bg-base-primary-50 border border-base-primary-100 px-2.5 py-1 rounded-lg text-center">{fmt.dim || "—"}</span>
      <span className="flex-1 text-[13px] font-semibold text-text-primary truncate">{fmt.type || "—"}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <Globe size={12} className="text-surface-400" />
        <span className="text-[12px] text-surface-500">{fmt.platform || "—"}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 cursor-pointer transition-colors"><Pencil size={13} /></button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-status-danger-50 text-surface-400 hover:text-status-danger-500 cursor-pointer transition-colors"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function FormatFormRow({ initial, onSave, onCancel }: { initial?: SMFormat; onSave: (f: SMFormat) => Promise<void>; onCancel: () => void }) {
  const [dim, setDim]         = useState(initial?.dim ?? "");
  const [type, setType]       = useState(initial?.type ?? "");
  const [platform, setPlatform] = useState(initial?.platform ?? "");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!dim.trim() && !type.trim()) return;
    setLoading(true);
    await onSave({ id: initial?.id ?? genId(), dim: dim.trim(), type: type.trim(), platform: platform.trim() });
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2 px-5 py-3 bg-base-primary-50 border-b border-base-primary-100">
      <input value={dim} onChange={e => setDim(e.target.value)} placeholder="1080×1080" autoFocus
        className={`w-28 shrink-0 ${inputCls}`} />
      <input value={type} onChange={e => setType(e.target.value)} placeholder="Kare Gönderi"
        className={`flex-1 ${inputCls}`} />
      <input value={platform} onChange={e => setPlatform(e.target.value)} placeholder="Instagram"
        className={`flex-1 ${inputCls}`} />
      <button onClick={save} disabled={(!dim.trim() && !type.trim()) || loading} className="h-9 w-9 flex items-center justify-center rounded-xl bg-base-primary-600 text-white hover:bg-base-primary-700 disabled:opacity-40 cursor-pointer transition-colors shrink-0"><Check size={14} /></button>
      <button onClick={onCancel} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-surface-100 text-surface-400 cursor-pointer transition-colors shrink-0"><X size={14} /></button>
    </div>
  );
}

function FormatsTab({ pool, onUpdate }: { pool: SocialMediaPool; onUpdate: (formats: SMFormat[]) => Promise<void> }) {
  const [adding,    setAdding]    = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const save = async (f: SMFormat) => {
    const exists = pool.formats.some(x => x.id === f.id);
    const updated = exists ? pool.formats.map(x => x.id === f.id ? f : x) : [...pool.formats, f];
    await onUpdate(updated);
    setAdding(false);
    setEditingId(null);
  };

  const del = async (id: string) => {
    await onUpdate(pool.formats.filter(f => f.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Header with add */}
      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-4 px-5 py-2.5 bg-surface-50 border-b border-surface-100">
          <span className="w-28 shrink-0 text-[11px] font-bold text-surface-500 uppercase tracking-wide">Boyut</span>
          <span className="flex-1 text-[11px] font-bold text-surface-500 uppercase tracking-wide">Tür</span>
          <span className="w-32 shrink-0 text-[11px] font-bold text-surface-500 uppercase tracking-wide">Platform</span>
          <button onClick={() => { setAdding(a => !a); setEditingId(null); }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-base-primary-900 text-white text-[12px] font-bold hover:bg-base-primary-800 cursor-pointer transition-all active:scale-95">
            <Plus size={12} /> Ekle
          </button>
        </div>

        {adding && <FormatFormRow onSave={save} onCancel={() => setAdding(false)} />}

        {pool.formats.length === 0 && !adding ? (
          <div className="py-12 text-center text-surface-300 text-[13px]">Henüz format eklenmemiş.</div>
        ) : (
          pool.formats.map(f =>
            editingId === f.id ? (
              <FormatFormRow key={f.id} initial={f} onSave={save} onCancel={() => setEditingId(null)} />
            ) : (
              <FormatRow key={f.id} fmt={f} onEdit={() => { setEditingId(f.id); setAdding(false); }} onDelete={() => del(f.id)} />
            )
          )
        )}
      </div>

      {/* Summary */}
      {pool.formats.length > 0 && (
        <p className="text-[12px] text-surface-400 px-1">
          Toplam <span className="font-bold text-text-primary">{pool.formats.length}</span> reklam ölçüsü
          {" · "}
          {[...new Set(pool.formats.map(f => f.platform).filter(Boolean))].join(", ")}
        </p>
      )}
    </div>
  );
}

// ─── Ortak Amaç & Kural Sekmesi ──────────────────────────────────────────────

function RuleTab({
  pool,
  onUpdateRule,
  onUpdatePurposes,
}: {
  pool: SocialMediaPool;
  onUpdateRule: (rule: string) => Promise<void>;
  onUpdatePurposes: (purposes: string[]) => Promise<void>;
}) {
  const [rule, setRule]           = useState(pool.sharedRule ?? "");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [purposeInput, setPurposeInput] = useState("");
  const [savingP, setSavingP]     = useState(false);

  const saveRule = async () => {
    setSaving(true);
    await onUpdateRule(rule);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addPurpose = async () => {
    const v = purposeInput.trim();
    if (!v || pool.globalPurposes.includes(v)) return;
    setSavingP(true);
    await onUpdatePurposes([...pool.globalPurposes, v]);
    setSavingP(false);
    setPurposeInput("");
  };

  const deletePurpose = async (p: string) => {
    await onUpdatePurposes(pool.globalPurposes.filter(x => x !== p));
  };

  return (
    <div className="space-y-5">
      {/* ── Ortak Amaç Havuzu ── */}
      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm p-6 space-y-4">
        <div>
          <p className="text-[14px] font-bold text-text-primary mb-1">Ortak Amaç Havuzu</p>
          <p className="text-[12px] text-surface-500">Marka eklerken bu listeden seçim yapılabilir.</p>
        </div>

        {pool.globalPurposes.length > 0 && (
          <div className="space-y-1.5">
            {pool.globalPurposes.map((p, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-surface-50 border border-surface-100 rounded-xl text-[13px] text-text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-base-primary-300 shrink-0" />
                <span className="flex-1">{p}</span>
                <button onClick={() => deletePurpose(p)} className="shrink-0 text-surface-300 hover:text-status-danger-500 cursor-pointer transition-colors p-0.5">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            value={purposeInput}
            onChange={e => setPurposeInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPurpose(); } }}
            placeholder="Yeni ortak amaç ekle..."
            className={`flex-1 ${inputCls}`}
          />
          <button onClick={addPurpose} disabled={!purposeInput.trim() || savingP}
            className="h-9 px-4 rounded-xl bg-base-primary-600 text-white text-[12px] font-bold hover:bg-base-primary-700 disabled:opacity-40 cursor-pointer transition-colors flex items-center gap-1.5 shrink-0">
            <Plus size={12} /> Ekle
          </button>
        </div>
      </div>

      {/* ── Ortak Kural ── */}
      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm p-6 space-y-4">
        <div>
          <p className="text-[14px] font-bold text-text-primary mb-1">Ortak Temel Kural</p>
          <p className="text-[12px] text-surface-500">Markalara özel kural yoksa bu metin brief'te gösterilir.</p>
        </div>
        <textarea
          value={rule}
          onChange={e => setRule(e.target.value)}
          rows={6}
          placeholder="ör. Verilen sektör ve markaya uygun, hedef kitleyi göz önünde bulundurarak bir sosyal medya reklam tasarımı yapılacak..."
          className="w-full px-4 py-3 text-[13px] border border-surface-200 rounded-xl bg-surface-50 outline-none focus:border-base-primary-400 focus:bg-white transition-colors resize-none"
        />
        <div className="flex justify-end">
          <button onClick={saveRule} disabled={saving}
            className="flex items-center gap-2 h-10 px-6 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 disabled:opacity-50 cursor-pointer transition-all active:scale-95">
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : saved
              ? <><Check size={14} /> Kaydedildi</>
              : <><Check size={14} /> Kaydet</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

export default function SocialMediaPoolPanel() {
  const [pool,    setPool]    = useState<SocialMediaPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<SMTab>("sectors");

  const ref = doc(db, "lottery_configs", "socialMedia");

  useEffect(() => {
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const raw = snap.data() as Record<string, unknown>;
        // Normalize sectors: add id and subSectors if missing
        const rawSectors = (raw.sectors as SMSector[] | undefined) ?? [];
        const sectors: SMSector[] = rawSectors.map(s => ({
          id:         (s as SMSector).id    || genId(),
          name:       (s as SMSector).name  || "",
          subSectors: (s as SMSector).subSectors ?? [],
        }));
        // Normalize brands: add id if missing, purposes may be object
        const rawBrands = (raw.brands as SMBrand[] | undefined) ?? [];
        const brands: SMBrand[] = rawBrands.map(b => {
          let purposes = (b as SMBrand).purposes ?? [];
          // Old format stored purposes as object {key: {name: string}}
          if (!Array.isArray(purposes)) {
            purposes = Object.values(purposes as Record<string, {name?: string}>).map(p => p?.name ?? String(p)).filter(Boolean);
          }
          return {
            id:         (b as SMBrand).id || genId(),
            brandName:  (b as SMBrand).brandName  ?? "",
            brandRule:  (b as SMBrand).brandRule  ?? "",
            mainSector: (b as SMBrand).mainSector ?? "",
            subSector:  (b as SMBrand).subSector  ?? "",
            purposes,
          };
        });
        // Normalize formats
        const rawFormats = (raw.formats as SMFormat[] | undefined) ?? [];
        const formats: SMFormat[] = rawFormats.map(f => ({
          id:       (f as SMFormat).id       || genId(),
          dim:      (f as SMFormat).dim      ?? "",
          type:     (f as SMFormat).type     ?? "",
          platform: (f as SMFormat).platform ?? "",
        }));
        setPool({
          ...(raw as unknown as SocialMediaPool),
          sectors,
          brands,
          formats,
          globalPurposes: (raw.globalPurposes as string[] | undefined) ?? [],
          sharedRule:     (raw.sharedRule as string | undefined)        ?? "",
        });
      } else {
        setPool(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

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
        <Smartphone size={36} className="text-surface-200" />
        <p className="text-[14px] font-bold">Sosyal Medya havuzu henüz yüklenmemiş</p>
        <p className="text-[12px]">Migration sayfasından verileri aktarın.</p>
      </div>
    );
  }

  const tabs: { id: SMTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "sectors", label: "Sektörler",       icon: <Layers size={14} />,    count: pool.sectors.length },
    { id: "brands",  label: "Markalar",        icon: <Building2 size={14} />, count: pool.brands.length },
    { id: "rule",    label: "Amaç & Kural",    icon: <FileText size={14} />,  count: pool.globalPurposes.length },
    { id: "formats", label: "Reklam Ölçüleri", icon: <Smartphone size={14} />, count: pool.formats.length },
  ];

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface-100/70 p-1 rounded-2xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all cursor-pointer ${
              tab === t.id
                ? "bg-white text-base-primary-900 shadow-sm border border-surface-100"
                : "text-surface-500 hover:text-text-primary"
            }`}
          >
            <span className={tab === t.id ? "text-base-primary-500" : "text-surface-400"}>{t.icon}</span>
            {t.label}
            {t.count !== undefined && (
              <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-full tabular-nums ${
                tab === t.id ? "bg-base-primary-100 text-base-primary-600" : "bg-surface-200 text-surface-400"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "sectors" && (
        <SectorsTab pool={pool} onUpdate={sectors => updateDoc(ref, { sectors })} />
      )}
      {tab === "brands" && (
        <BrandsTab pool={pool} onUpdate={brands => updateDoc(ref, { brands })} />
      )}
      {tab === "formats" && (
        <FormatsTab pool={pool} onUpdate={formats => updateDoc(ref, { formats })} />
      )}
      {tab === "rule" && (
        <RuleTab
          pool={pool}
          onUpdateRule={sharedRule => updateDoc(ref, { sharedRule })}
          onUpdatePurposes={globalPurposes => updateDoc(ref, { globalPurposes })}
        />
      )}

      {/* Footer summary */}
      <div className="flex items-center gap-3 px-1 flex-wrap pt-1">
        {[
          { label: "Ana sektör",   value: pool.sectors.length,                                     color: "text-base-primary-600 bg-base-primary-50 border-base-primary-100" },
          { label: "Alt sektör",   value: pool.sectors.reduce((a, s) => a + s.subSectors.length, 0), color: "text-base-primary-500 bg-base-primary-50 border-base-primary-100" },
          { label: "Marka",        value: pool.brands.length,                                       color: "text-designstudio-secondary-600 bg-designstudio-secondary-50 border-designstudio-secondary-100" },
          { label: "Reklam ölçüsü", value: pool.formats.length,                                    color: "text-accent-turquoise-600 bg-accent-turquoise-50 border-accent-turquoise-100" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[12px] font-semibold ${color}`}>
            {label}: <span className="font-extrabold tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
