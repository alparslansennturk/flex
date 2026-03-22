"use client";

import React, { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import type { SocialMediaPool, SMBrand, SMSector, SMFormat } from "./poolTypes";

type SMTab = "brands" | "sectors" | "formats" | "rule";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Brand ─────────────────────────────────────────────────────────────────

function BrandRow({ item, onEdit, onDelete }: { item: SMBrand & { _id?: string }; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-surface-100 last:border-0 group hover:bg-surface-50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-text-primary">{item.brandName || "—"}</p>
        <p className="text-[12px] text-surface-500">{item.mainSector}{item.subSector ? ` › ${item.subSector}` : ""}</p>
        {item.brandRule && <p className="text-[11px] text-surface-400 truncate italic">{item.brandRule}</p>}
        {item.purposes?.length > 0 && (
          <p className="text-[11px] text-surface-300 mt-0.5">{item.purposes.length} amaç</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 cursor-pointer"><Edit2 size={13} /></button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-status-danger-50 text-surface-400 hover:text-status-danger-500 cursor-pointer"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function BrandForm({ initial, onSave, onCancel }: { initial?: SMBrand; onSave: (b: SMBrand) => Promise<void>; onCancel: () => void }) {
  const [brandName, setBrandName] = useState(initial?.brandName ?? "");
  const [brandRule, setBrandRule] = useState(initial?.brandRule ?? "");
  const [mainSector, setMainSector] = useState(initial?.mainSector ?? "");
  const [subSector, setSubSector] = useState(initial?.subSector ?? "");
  const [purposesStr, setPurposesStr] = useState(initial?.purposes?.join("\n") ?? "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!brandName.trim()) return;
    setLoading(true);
    await onSave({
      brandName: brandName.trim(),
      brandRule: brandRule.trim(),
      mainSector: mainSector.trim(),
      subSector: subSector.trim(),
      purposes: purposesStr.split("\n").map(s => s.trim()).filter(Boolean),
    });
    setLoading(false);
  };

  return (
    <div className="px-4 py-3 bg-base-primary-50 border-b border-base-primary-100 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Marka adı *" autoFocus
          className="h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400 col-span-2" />
        <input value={mainSector} onChange={e => setMainSector(e.target.value)} placeholder="Ana sektör"
          className="h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400" />
        <input value={subSector} onChange={e => setSubSector(e.target.value)} placeholder="Alt sektör"
          className="h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400" />
        <input value={brandRule} onChange={e => setBrandRule(e.target.value)} placeholder="Marka kuralı (opsiyonel)"
          className="h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400 col-span-2" />
      </div>
      <textarea value={purposesStr} onChange={e => setPurposesStr(e.target.value)}
        placeholder="Amaçlar (her satıra bir amaç)" rows={4}
        className="w-full px-3 py-2 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400 resize-none" />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-surface-200 text-[12px] font-bold text-surface-600 hover:bg-surface-50 cursor-pointer"><X size={12} /> Vazgeç</button>
        <button onClick={handleSave} disabled={!brandName.trim() || loading} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-base-primary-900 text-white text-[12px] font-bold hover:bg-base-primary-800 disabled:opacity-40 cursor-pointer"><Check size={12} /> Kaydet</button>
      </div>
    </div>
  );
}

// ─── Sector ────────────────────────────────────────────────────────────────

function SectorRow({ item, onEdit, onDelete }: { item: SMSector; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-100 last:border-0 group hover:bg-surface-50 transition-colors">
      <span className="flex-1 text-[13px] font-medium text-text-primary">{item.name}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 cursor-pointer"><Edit2 size={13} /></button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-status-danger-50 text-surface-400 hover:text-status-danger-500 cursor-pointer"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function SectorForm({ initial, onSave, onCancel }: { initial?: SMSector; onSave: (s: SMSector) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await onSave({ name: name.trim() });
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-base-primary-50 border-b border-base-primary-100">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Sektör adı *" autoFocus
        className="flex-1 h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400" />
      <button onClick={handleSave} disabled={!name.trim() || loading} className="p-1.5 rounded-lg bg-base-primary-600 text-white hover:bg-base-primary-700 disabled:opacity-40 cursor-pointer"><Check size={13} /></button>
      <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 cursor-pointer"><X size={13} /></button>
    </div>
  );
}

// ─── Format ────────────────────────────────────────────────────────────────

function FormatRow({ item, onEdit, onDelete }: { item: SMFormat; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-100 last:border-0 group hover:bg-surface-50 transition-colors">
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-[12px] font-bold px-2 py-0.5 rounded-lg bg-surface-100 text-surface-600">{item.dim}</span>
        <span className="text-[13px] text-text-primary">{item.type}</span>
        <span className="text-surface-400 text-[12px]">·</span>
        <span className="text-[12px] text-surface-500">{item.platform}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 cursor-pointer"><Edit2 size={13} /></button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-status-danger-50 text-surface-400 hover:text-status-danger-500 cursor-pointer"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function FormatForm({ initial, onSave, onCancel }: { initial?: SMFormat; onSave: (f: SMFormat) => Promise<void>; onCancel: () => void }) {
  const [dim, setDim] = useState(initial?.dim ?? "");
  const [type, setType] = useState(initial?.type ?? "");
  const [platform, setPlatform] = useState(initial?.platform ?? "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!type.trim()) return;
    setLoading(true);
    await onSave({ dim: dim.trim(), type: type.trim(), platform: platform.trim() });
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-base-primary-50 border-b border-base-primary-100">
      <input value={dim} onChange={e => setDim(e.target.value)} placeholder="Boyut (1:1)"
        className="w-24 h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400" />
      <input value={type} onChange={e => setType(e.target.value)} placeholder="Tür *" autoFocus
        className="flex-1 h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400" />
      <input value={platform} onChange={e => setPlatform(e.target.value)} placeholder="Platform"
        className="flex-1 h-8 px-3 text-[13px] border border-surface-200 rounded-lg bg-white outline-none focus:border-base-primary-400" />
      <button onClick={handleSave} disabled={!type.trim() || loading} className="p-1.5 rounded-lg bg-base-primary-600 text-white hover:bg-base-primary-700 disabled:opacity-40 cursor-pointer"><Check size={13} /></button>
      <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 cursor-pointer"><X size={13} /></button>
    </div>
  );
}

// ─── ANA COMPONENT ─────────────────────────────────────────────────────────

export default function SocialMediaPoolPanel() {
  const [pool, setPool] = useState<SocialMediaPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [smTab, setSmTab] = useState<SMTab>("brands");
  const [adding, setAdding] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [rule, setRule] = useState("");
  const [ruleSaving, setRuleSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "lottery_configs", "socialMedia"), snap => {
      const data = snap.exists() ? (snap.data() as SocialMediaPool) : null;
      setPool(data);
      if (data) setRule(data.sharedRule ?? "");
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const ref = doc(db, "lottery_configs", "socialMedia");

  // Brands
  const handleAddBrand = async (b: SMBrand) => {
    if (!pool) return;
    await updateDoc(ref, { brands: [...pool.brands, b] });
    setAdding(false);
  };
  const handleEditBrand = async (updated: SMBrand, idx: number) => {
    if (!pool) return;
    const brands = pool.brands.map((b, i) => (i === idx ? updated : b));
    await updateDoc(ref, { brands });
    setEditingIdx(null);
  };
  const handleDeleteBrand = async (idx: number) => {
    if (!pool) return;
    await updateDoc(ref, { brands: pool.brands.filter((_, i) => i !== idx) });
  };

  // Sectors
  const handleAddSector = async (s: SMSector) => {
    if (!pool) return;
    await updateDoc(ref, { sectors: [...pool.sectors, s] });
    setAdding(false);
  };
  const handleEditSector = async (updated: SMSector, idx: number) => {
    if (!pool) return;
    await updateDoc(ref, { sectors: pool.sectors.map((s, i) => (i === idx ? updated : s)) });
    setEditingIdx(null);
  };
  const handleDeleteSector = async (idx: number) => {
    if (!pool) return;
    await updateDoc(ref, { sectors: pool.sectors.filter((_, i) => i !== idx) });
  };

  // Formats
  const handleAddFormat = async (f: SMFormat) => {
    if (!pool) return;
    await updateDoc(ref, { formats: [...pool.formats, f] });
    setAdding(false);
  };
  const handleEditFormat = async (updated: SMFormat, idx: number) => {
    if (!pool) return;
    await updateDoc(ref, { formats: pool.formats.map((f, i) => (i === idx ? updated : f)) });
    setEditingIdx(null);
  };
  const handleDeleteFormat = async (idx: number) => {
    if (!pool) return;
    await updateDoc(ref, { formats: pool.formats.filter((_, i) => i !== idx) });
  };

  // Shared Rule
  const handleSaveRule = async () => {
    setRuleSaving(true);
    await updateDoc(ref, { sharedRule: rule });
    setRuleSaving(false);
  };

  const switchTab = (tab: SMTab) => { setSmTab(tab); setAdding(false); setEditingIdx(null); };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" /></div>;
  }

  if (!pool) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-surface-400">
        <p className="text-[14px] font-semibold mb-2">Sosyal Medya havuzu henüz yüklenmemiş</p>
        <p className="text-[12px]">Migration sayfasından verileri aktarın.</p>
      </div>
    );
  }

  const innerTabs: { id: SMTab; label: string; count?: number }[] = [
    { id: "brands",  label: "Markalar",  count: pool.brands.length  },
    { id: "sectors", label: "Sektörler", count: pool.sectors.length },
    { id: "formats", label: "Formatlar", count: pool.formats.length },
    { id: "rule",    label: "Ortak Kural" },
  ];

  return (
    <div>
      {/* İç sekmeler */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {innerTabs.map(t => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer border ${
              smTab === t.id
                ? "bg-base-primary-900 text-white border-base-primary-900"
                : "border-surface-200 text-surface-500 hover:text-surface-700 hover:border-surface-300"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${smTab === t.id ? "bg-white/20" : "bg-surface-100 text-surface-400"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}

        {smTab !== "rule" && (
          <button
            onClick={() => { setAdding(true); setEditingIdx(null); }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-base-primary-900 text-white rounded-xl text-[12px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={13} /> Ekle
          </button>
        )}
      </div>

      {/* İçerik */}
      <div className="bg-white rounded-16 border border-surface-100 shadow-sm overflow-hidden">
        {smTab === "brands" && (
          <>
            {adding && <BrandForm onSave={handleAddBrand} onCancel={() => setAdding(false)} />}
            {pool.brands.length === 0 && !adding
              ? <div className="py-12 text-center text-surface-400 text-[13px]">Henüz marka yok</div>
              : pool.brands.map((b, i) =>
                  editingIdx === i
                    ? <BrandForm key={i} initial={b} onSave={u => handleEditBrand(u, i)} onCancel={() => setEditingIdx(null)} />
                    : <BrandRow key={i} item={b} onEdit={() => setEditingIdx(i)} onDelete={() => handleDeleteBrand(i)} />
                )
            }
          </>
        )}

        {smTab === "sectors" && (
          <>
            {adding && <SectorForm onSave={handleAddSector} onCancel={() => setAdding(false)} />}
            {pool.sectors.length === 0 && !adding
              ? <div className="py-12 text-center text-surface-400 text-[13px]">Henüz sektör yok</div>
              : pool.sectors.map((s, i) =>
                  editingIdx === i
                    ? <SectorForm key={i} initial={s} onSave={u => handleEditSector(u, i)} onCancel={() => setEditingIdx(null)} />
                    : <SectorRow key={i} item={s} onEdit={() => setEditingIdx(i)} onDelete={() => handleDeleteSector(i)} />
                )
            }
          </>
        )}

        {smTab === "formats" && (
          <>
            {adding && <FormatForm onSave={handleAddFormat} onCancel={() => setAdding(false)} />}
            {pool.formats.length === 0 && !adding
              ? <div className="py-12 text-center text-surface-400 text-[13px]">Henüz format yok</div>
              : pool.formats.map((f, i) =>
                  editingIdx === i
                    ? <FormatForm key={i} initial={f} onSave={u => handleEditFormat(u, i)} onCancel={() => setEditingIdx(null)} />
                    : <FormatRow key={i} item={f} onEdit={() => setEditingIdx(i)} onDelete={() => handleDeleteFormat(i)} />
                )
            }
          </>
        )}

        {smTab === "rule" && (
          <div className="p-4 space-y-3">
            <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide">Ortak Kural Metni</p>
            <textarea
              value={rule}
              onChange={e => setRule(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 text-[13px] border border-surface-200 rounded-xl bg-surface-50 outline-none focus:border-base-primary-400 focus:bg-white transition-colors resize-none"
              placeholder="Tüm öğrenciler için geçerli ortak kural..."
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveRule}
                disabled={ruleSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-base-primary-900 text-white text-[12px] font-bold hover:bg-base-primary-800 disabled:opacity-40 cursor-pointer transition-colors"
              >
                {ruleSaving ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={13} />}
                Kaydet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
