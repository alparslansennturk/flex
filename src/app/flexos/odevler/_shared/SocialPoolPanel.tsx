"use client";

/**
 * Havuz Yönetimi — Reklam Tasarımı (Sosyal Medya) sekmesi. `CollagePoolPanel.tsx`/
 * `BookPoolPanel.tsx` ile aynı desen (`/api/flexos/social-pool` GET/PATCH,
 * PAYLAŞIMLI-DEĞİL — her eğitmen sadece kendi bağımsız havuz kopyasını görür/düzenler),
 * ama canlıdaki `SocialMediaPoolPanel.tsx`'in 4 sekmeli yapısı korunuyor: Sektörler
 * (ana/alt sektör ağacı), Markalar (sektöre bağlı, string eşleşmesiyle), Reklam
 * Ölçüleri (düz format listesi), Amaç & Kural (ortak amaç havuzu + paylaşılan kural
 * metni). Her mutasyon PATCH'e TÜM havuzu (brands+sectors+formats+globalPurposes+
 * sharedRule) birlikte gönderir — server-side tüm-alan-rewrite deseni.
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Edit2, Check, X, Smartphone, Loader2, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";

interface SMBrand { id: string; brandName: string; brandRule: string; mainSector: string; subSector: string; purposes: string[] }
interface SMSector { id: string; name: string; subSectors: string[] }
interface SMFormat { id: string; dim: string; type: string; platform: string }
interface SocialPool {
  id: string; tenantId: string; trainerId?: string;
  brands: SMBrand[]; sectors: SMSector[]; formats: SMFormat[]; globalPurposes: string[]; sharedRule: string;
}

type SubTab = "sectors" | "brands" | "formats" | "rule";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

const INPUT_CLS = "w-full h-9 px-3 text-[13px] font-medium border border-surface-200 rounded-xl bg-white outline-none focus:border-base-primary-400 transition-colors text-text-primary placeholder:text-surface-400";
const LABEL_CLS = "block text-[12px] font-bold text-surface-700 mb-1";

// ─── Sektörler ─────────────────────────────────────────────────────────────

function SectorAccordion({ sector, onRename, onDelete, onAddSub, onRenameSub, onDeleteSub }: {
  sector: SMSector;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddSub: (name: string) => void;
  onRenameSub: (oldName: string, newName: string) => void;
  onDeleteSub: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(sector.name);
  const [subDraft, setSubDraft] = useState("");
  const [editingSub, setEditingSub] = useState<string | null>(null);
  const [subEditDraft, setSubEditDraft] = useState("");

  return (
    <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden mb-3">
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={() => setOpen((v) => !v)} className="p-1 rounded-lg hover:bg-surface-100 cursor-pointer text-surface-400 shrink-0">
          {open ? <ChevronDown size={15} /> : <ChevronRightIcon size={15} />}
        </button>
        {editingName ? (
          <div className="flex-1 flex items-center gap-2">
            <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className={INPUT_CLS} autoFocus />
            <button onClick={() => { if (nameDraft.trim()) { onRename(nameDraft.trim()); setEditingName(false); } }} className="p-1.5 rounded-lg hover:bg-surface-100 text-status-success-600 cursor-pointer"><Check size={14} /></button>
            <button onClick={() => { setNameDraft(sector.name); setEditingName(false); }} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 cursor-pointer"><X size={14} /></button>
          </div>
        ) : (
          <>
            <span className="flex-1 text-[14px] font-bold text-text-primary">{sector.name}</span>
            <span className="text-[11px] text-surface-400 mr-1">{sector.subSectors.length} alt sektör</span>
            <button onClick={() => setEditingName(true)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 cursor-pointer"><Edit2 size={13} /></button>
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-status-danger-50 text-surface-400 hover:text-status-danger-500 cursor-pointer"><Trash2 size={13} /></button>
          </>
        )}
      </div>

      {open && (
        <div className="px-5 pb-4 pt-1 border-t border-surface-100 bg-surface-50/50">
          <div className="flex flex-wrap gap-2 mb-3">
            {sector.subSectors.map((sub) => (
              editingSub === sub ? (
                <div key={sub} className="flex items-center gap-1 bg-white border border-surface-200 rounded-lg px-2 py-1">
                  <input value={subEditDraft} onChange={(e) => setSubEditDraft(e.target.value)} className="text-[12px] font-semibold outline-none w-28" autoFocus />
                  <button onClick={() => { if (subEditDraft.trim()) { onRenameSub(sub, subEditDraft.trim()); setEditingSub(null); } }} className="text-status-success-600 cursor-pointer"><Check size={12} /></button>
                  <button onClick={() => setEditingSub(null)} className="text-surface-400 cursor-pointer"><X size={12} /></button>
                </div>
              ) : (
                <button key={sub} onClick={() => { setEditingSub(sub); setSubEditDraft(sub); }}
                  className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold bg-white border border-surface-200 text-surface-600 hover:border-base-primary-300 cursor-pointer transition-colors">
                  {sub}
                  <span onClick={(e) => { e.stopPropagation(); onDeleteSub(sub); }} className="opacity-0 group-hover:opacity-100 text-surface-300 hover:text-status-danger-500">
                    <X size={11} />
                  </span>
                </button>
              )
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input value={subDraft} onChange={(e) => setSubDraft(e.target.value)} placeholder="Yeni alt sektör" className={INPUT_CLS + " max-w-[220px]"}
              onKeyDown={(e) => { if (e.key === "Enter" && subDraft.trim()) { onAddSub(subDraft.trim()); setSubDraft(""); } }} />
            <button onClick={() => { if (subDraft.trim()) { onAddSub(subDraft.trim()); setSubDraft(""); } }}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-base-primary-900 text-white text-[12px] font-bold hover:bg-base-primary-800 cursor-pointer">
              <Plus size={12} /> Ekle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectorsTab({ pool, onSave }: { pool: SocialPool; onSave: (sectors: SMSector[]) => Promise<void> }) {
  const [newSectorName, setNewSectorName] = useState("");

  const addSector = () => {
    if (!newSectorName.trim()) return;
    onSave([...pool.sectors, { id: generateId(), name: newSectorName.trim(), subSectors: [] }]);
    setNewSectorName("");
  };
  const renameSector = (id: string, name: string) => onSave(pool.sectors.map((s) => (s.id === id ? { ...s, name } : s)));
  const deleteSector = (id: string) => onSave(pool.sectors.filter((s) => s.id !== id));
  const addSub = (id: string, sub: string) => onSave(pool.sectors.map((s) => (s.id === id && !s.subSectors.includes(sub) ? { ...s, subSectors: [...s.subSectors, sub] } : s)));
  const renameSub = (id: string, oldSub: string, newSub: string) => onSave(pool.sectors.map((s) => (s.id === id ? { ...s, subSectors: s.subSectors.map((x) => (x === oldSub ? newSub : x)) } : s)));
  const deleteSub = (id: string, sub: string) => onSave(pool.sectors.map((s) => (s.id === id ? { ...s, subSectors: s.subSectors.filter((x) => x !== sub) } : s)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 bg-white rounded-2xl border border-surface-100 shadow-sm p-3">
        <input value={newSectorName} onChange={(e) => setNewSectorName(e.target.value)} placeholder="Yeni ana sektör adı" className={INPUT_CLS}
          onKeyDown={(e) => { if (e.key === "Enter") addSector(); }} />
        <button onClick={addSector} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 cursor-pointer shrink-0">
          <Plus size={14} /> Sektör Ekle
        </button>
      </div>

      {pool.sectors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-surface-100 flex flex-col items-center justify-center py-16 gap-2 text-surface-300">
          <Smartphone size={28} className="opacity-40" />
          <p className="text-[13px] font-bold text-surface-500">Henüz sektör yok</p>
        </div>
      ) : (
        pool.sectors.map((s) => (
          <SectorAccordion
            key={s.id}
            sector={s}
            onRename={(name) => renameSector(s.id, name)}
            onDelete={() => deleteSector(s.id)}
            onAddSub={(sub) => addSub(s.id, sub)}
            onRenameSub={(oldSub, newSub) => renameSub(s.id, oldSub, newSub)}
            onDeleteSub={(sub) => deleteSub(s.id, sub)}
          />
        ))
      )}
    </div>
  );
}

// ─── Markalar ──────────────────────────────────────────────────────────────

const EMPTY_BRAND: Omit<SMBrand, "id"> = { brandName: "", brandRule: "", mainSector: "", subSector: "", purposes: [] };

function BrandForm({ initial, sectors, globalPurposes, onSave, onCancel }: {
  initial?: SMBrand;
  sectors: SMSector[];
  globalPurposes: string[];
  onSave: (brand: SMBrand) => Promise<void>;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<Omit<SMBrand, "id">>(() => initial ? { ...initial } : { ...EMPTY_BRAND, mainSector: sectors[0]?.name ?? "" });
  const [customPurpose, setCustomPurpose] = useState("");
  const [saving, setSaving] = useState(false);

  const currentSector = sectors.find((s) => s.name === fields.mainSector);
  const subOptions = currentSector?.subSectors ?? [];

  const togglePurpose = (p: string) => setFields((f) => ({
    ...f, purposes: f.purposes.includes(p) ? f.purposes.filter((x) => x !== p) : [...f.purposes, p],
  }));
  const addCustomPurpose = () => {
    const p = customPurpose.trim();
    if (!p || fields.purposes.includes(p)) return;
    setFields((f) => ({ ...f, purposes: [...f.purposes, p] }));
    setCustomPurpose("");
  };

  const handleSave = async () => {
    if (!fields.brandName.trim()) return;
    setSaving(true);
    try {
      await onSave({ id: initial?.id ?? generateId(), ...fields });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden mb-5">
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 bg-surface-50/60">
        <p className="text-[15px] font-extrabold text-text-primary">{initial ? "Markayı Düzenle" : "Yeni Marka Ekle"}</p>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 cursor-pointer"><X size={15} /></button>
      </div>

      <div className="px-5 py-5 space-y-4">
        <div>
          <label className={LABEL_CLS}>Marka Adı <span className="text-status-danger-500">*</span></label>
          <input value={fields.brandName} onChange={(e) => setFields((f) => ({ ...f, brandName: e.target.value }))} placeholder="Lassa" className={INPUT_CLS} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLS}>Ana Sektör</label>
            <select value={fields.mainSector} onChange={(e) => setFields((f) => ({ ...f, mainSector: e.target.value, subSector: "" }))} className={INPUT_CLS + " bg-white"}>
              <option value="">Seçin</option>
              {sectors.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Alt Sektör</label>
            <select value={fields.subSector} onChange={(e) => setFields((f) => ({ ...f, subSector: e.target.value }))} className={INPUT_CLS + " bg-white"}>
              <option value="">Seçin</option>
              {subOptions.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL_CLS}>Amaçlar (boşsa ortak Amaç havuzundan seçilir)</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {globalPurposes.map((p) => (
              <button key={p} type="button" onClick={() => togglePurpose(p)}
                className="px-2.5 py-1 rounded-lg text-[11.5px] font-bold cursor-pointer transition-all"
                style={{ border: `1px solid ${fields.purposes.includes(p) ? "#AECBF2" : "#E2E5EA"}`, background: fields.purposes.includes(p) ? "#EFF5FE" : "#fff", color: fields.purposes.includes(p) ? "#205297" : "#6F7B87" }}>
                {p}
              </button>
            ))}
            {fields.purposes.filter((p) => !globalPurposes.includes(p)).map((p) => (
              <button key={p} type="button" onClick={() => togglePurpose(p)}
                className="px-2.5 py-1 rounded-lg text-[11.5px] font-bold cursor-pointer bg-[#EFF5FE] border border-[#AECBF2] text-[#205297]">
                {p} <X size={10} className="inline ml-1" />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input value={customPurpose} onChange={(e) => setCustomPurpose(e.target.value)} placeholder="Özel amaç ekle" className={INPUT_CLS}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomPurpose(); } }} />
            <button onClick={addCustomPurpose} type="button" className="px-3 py-2 rounded-xl border border-surface-200 text-[12px] font-bold text-surface-600 hover:bg-surface-50 cursor-pointer shrink-0">Ekle</button>
          </div>
        </div>

        <div>
          <label className={LABEL_CLS}>Marka Özel Kuralı (boşsa ortak Paylaşılan Kural kullanılır)</label>
          <textarea value={fields.brandRule} onChange={(e) => setFields((f) => ({ ...f, brandRule: e.target.value }))} rows={3}
            className="w-full px-3 py-2.5 text-[13px] font-medium border border-surface-200 rounded-xl bg-white outline-none focus:border-base-primary-400 transition-colors resize-none text-text-primary placeholder:text-surface-400" />
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-surface-300">* zorunlu alan</p>
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 cursor-pointer">
              <X size={13} /> İptal
            </button>
            <button onClick={handleSave} disabled={!fields.brandName.trim() || saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 disabled:opacity-40 cursor-pointer">
              <Check size={13} /> {initial ? "Güncelle" : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandsTab({ pool, onSave }: { pool: SocialPool; onSave: (brands: SMBrand[]) => Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SMBrand | null>(null);

  const handleAdd = async (b: SMBrand) => { await onSave([...pool.brands, b]); setAdding(false); };
  const handleEdit = async (b: SMBrand) => { await onSave(pool.brands.map((x) => (x.id === b.id ? b : x))); setEditing(null); };
  const handleDelete = (b: SMBrand) => onSave(pool.brands.filter((x) => x.id !== b.id));

  return (
    <div className="flex flex-col gap-0">
      {(adding || editing) ? (
        <BrandForm
          initial={editing ?? undefined}
          sectors={pool.sectors}
          globalPurposes={pool.globalPurposes}
          onSave={editing ? handleEdit : handleAdd}
          onCancel={() => { setAdding(false); setEditing(null); }}
        />
      ) : (
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-medium text-surface-400"><span className="font-bold text-text-primary">{pool.brands.length}</span> marka</p>
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 bg-base-primary-900 text-white rounded-xl text-[13px] font-bold hover:bg-base-primary-800 cursor-pointer shadow-sm">
            <Plus size={14} /> Ekle
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
        {pool.brands.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3 text-surface-300">
            <Smartphone size={32} />
            <p className="text-[14px] font-bold text-surface-400">Henüz marka yok</p>
          </div>
        ) : (
          pool.brands.map((b) => (
            <div key={b.id} className="flex items-start gap-3 px-5 py-3.5 border-b border-surface-100 last:border-0 group hover:bg-surface-50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-text-primary truncate leading-tight">{b.brandName}</p>
                <p className="text-[12px] font-medium text-surface-500 truncate mt-0.5">{b.mainSector} {b.subSector ? `› ${b.subSector}` : ""}</p>
                {b.purposes.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    {b.purposes.map((p) => <span key={p} className="text-[11px] font-medium text-surface-400 bg-surface-100 px-2 py-0.5 rounded-lg">{p}</span>)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
                <button onClick={() => setEditing(b)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 cursor-pointer"><Edit2 size={13} /></button>
                <button onClick={() => handleDelete(b)} className="p-1.5 rounded-lg hover:bg-status-danger-50 text-surface-400 hover:text-status-danger-500 cursor-pointer"><Trash2 size={13} /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Reklam Ölçüleri ───────────────────────────────────────────────────────

const EMPTY_FORMAT: Omit<SMFormat, "id"> = { dim: "", type: "", platform: "" };

function FormatsTab({ pool, onSave }: { pool: SocialPool; onSave: (formats: SMFormat[]) => Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Omit<SMFormat, "id">>(EMPTY_FORMAT);

  const startAdd = () => { setFields(EMPTY_FORMAT); setAdding(true); setEditingId(null); };
  const startEdit = (f: SMFormat) => { setFields({ dim: f.dim, type: f.type, platform: f.platform }); setEditingId(f.id); setAdding(false); };
  const cancel = () => { setAdding(false); setEditingId(null); };

  const save = async () => {
    if (!fields.dim.trim() || !fields.platform.trim()) return;
    if (editingId) {
      await onSave(pool.formats.map((f) => (f.id === editingId ? { id: editingId, ...fields } : f)));
    } else {
      await onSave([...pool.formats, { id: generateId(), ...fields }]);
    }
    cancel();
  };
  const remove = (id: string) => onSave(pool.formats.filter((f) => f.id !== id));

  return (
    <div className="flex flex-col gap-4">
      {(adding || editingId) && (
        <div className="bg-white rounded-2xl border border-surface-100 shadow-sm p-5 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL_CLS}>Boyut</label>
              <input value={fields.dim} onChange={(e) => setFields((f) => ({ ...f, dim: e.target.value }))} placeholder="1080x1080" className={INPUT_CLS} autoFocus />
            </div>
            <div>
              <label className={LABEL_CLS}>Tür</label>
              <input value={fields.type} onChange={(e) => setFields((f) => ({ ...f, type: e.target.value }))} placeholder="Kare Gönderi" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Platform</label>
              <input value={fields.platform} onChange={(e) => setFields((f) => ({ ...f, platform: e.target.value }))} placeholder="Instagram" className={INPUT_CLS} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={cancel} className="px-4 py-2 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 cursor-pointer">İptal</button>
            <button onClick={save} disabled={!fields.dim.trim() || !fields.platform.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 disabled:opacity-40 cursor-pointer">
              <Check size={13} /> {editingId ? "Güncelle" : "Kaydet"}
            </button>
          </div>
        </div>
      )}

      {!adding && !editingId && (
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-surface-400"><span className="font-bold text-text-primary">{pool.formats.length}</span> format</p>
          <button onClick={startAdd} className="flex items-center gap-2 px-4 py-2 bg-base-primary-900 text-white rounded-xl text-[13px] font-bold hover:bg-base-primary-800 cursor-pointer shadow-sm">
            <Plus size={14} /> Ekle
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-3 bg-surface-50 border-b border-surface-100">
          <div className="w-32 shrink-0"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Boyut</span></div>
          <div className="flex-1"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Tür</span></div>
          <div className="w-32 shrink-0"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Platform</span></div>
          <div className="w-20 shrink-0" />
        </div>
        {pool.formats.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3 text-surface-300">
            <Smartphone size={32} />
            <p className="text-[14px] font-bold text-surface-400">Henüz format yok</p>
          </div>
        ) : (
          pool.formats.map((f) => (
            <div key={f.id} className="flex items-center gap-4 px-5 py-3 border-b border-surface-50 last:border-0 group hover:bg-surface-50 transition-colors">
              <div className="w-32 shrink-0 text-[13px] font-bold text-text-primary">{f.dim}</div>
              <div className="flex-1 text-[13px] text-surface-500">{f.type || "—"}</div>
              <div className="w-32 shrink-0 text-[13px] font-semibold text-surface-600">{f.platform}</div>
              <div className="w-20 shrink-0 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(f)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 cursor-pointer"><Edit2 size={13} /></button>
                <button onClick={() => remove(f.id)} className="p-1.5 rounded-lg hover:bg-status-danger-50 text-surface-400 hover:text-status-danger-500 cursor-pointer"><Trash2 size={13} /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Amaç & Kural ──────────────────────────────────────────────────────────

function RuleTab({ pool, onSave }: { pool: SocialPool; onSave: (globalPurposes: string[], sharedRule: string) => Promise<void> }) {
  const [purposeDraft, setPurposeDraft] = useState("");
  const [ruleDraft, setRuleDraft] = useState(pool.sharedRule);
  const [saving, setSaving] = useState(false);

  const addPurpose = () => {
    const p = purposeDraft.trim();
    if (!p || pool.globalPurposes.includes(p)) return;
    onSave([...pool.globalPurposes, p], pool.sharedRule);
    setPurposeDraft("");
  };
  const removePurpose = (p: string) => onSave(pool.globalPurposes.filter((x) => x !== p), pool.sharedRule);

  const saveRule = async () => {
    setSaving(true);
    try { await onSave(pool.globalPurposes, ruleDraft); toast.success("Kural kaydedildi."); } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm p-5">
        <p className="text-[14px] font-extrabold text-text-primary mb-1">Ortak Amaç Havuzu</p>
        <p className="text-[12px] text-surface-400 mb-3">Markanın özel amaç listesi boşsa çekilişte buradan seçilir.</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {pool.globalPurposes.map((p) => (
            <span key={p} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-bold bg-surface-100 text-surface-600">
              {p}
              <button onClick={() => removePurpose(p)} className="text-surface-400 hover:text-status-danger-500 cursor-pointer"><X size={11} /></button>
            </span>
          ))}
          {pool.globalPurposes.length === 0 && <span className="text-[12.5px] text-surface-300 italic">Henüz amaç eklenmedi</span>}
        </div>
        <div className="flex items-center gap-2">
          <input value={purposeDraft} onChange={(e) => setPurposeDraft(e.target.value)} placeholder="Yeni amaç ekle" className={INPUT_CLS}
            onKeyDown={(e) => { if (e.key === "Enter") addPurpose(); }} />
          <button onClick={addPurpose} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 cursor-pointer shrink-0">
            <Plus size={14} /> Ekle
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm p-5">
        <p className="text-[14px] font-extrabold text-text-primary mb-1">Paylaşılan Kural (Yapılacaklar)</p>
        <p className="text-[12px] text-surface-400 mb-3">Markanın özel kuralı boşsa PDF/mail'de bu metin gösterilir (her satır bir madde).</p>
        <textarea value={ruleDraft} onChange={(e) => setRuleDraft(e.target.value)} rows={6} placeholder="Her satır ayrı bir madde olarak PDF'e yansır."
          className="w-full px-3 py-2.5 text-[13px] font-medium border border-surface-200 rounded-xl bg-white outline-none focus:border-base-primary-400 transition-colors resize-none text-text-primary placeholder:text-surface-400 mb-3" />
        <button onClick={saveRule} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 disabled:opacity-50 cursor-pointer">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Kaydet
        </button>
      </div>
    </div>
  );
}

// ─── Ana panel ─────────────────────────────────────────────────────────────

export default function SocialPoolPanel() {
  const [pool, setPool] = useState<SocialPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>("sectors");

  const load = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/social-pool", { headers });
      if (res.ok) {
        const data = await res.json() as { pool: SocialPool | null };
        setPool(data.pool);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  async function persist(next: Pick<SocialPool, "brands" | "sectors" | "formats" | "globalPurposes" | "sharedRule">) {
    setSaving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/social-pool", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast.error(json.error ?? "Kaydedilemedi.");
        return;
      }
      const data = await res.json() as { pool: SocialPool };
      setPool(data.pool);
    } finally {
      setSaving(false);
    }
  }

  const tabs = useMemo(() => ([
    { key: "sectors" as const, label: "Sektörler" },
    { key: "brands" as const, label: "Markalar" },
    { key: "formats" as const, label: "Reklam Ölçüleri" },
    { key: "rule" as const, label: "Amaç & Kural" },
  ]), []);

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
        <Smartphone size={32} className="opacity-40" />
        <p className="text-[14px] font-bold text-surface-500">Henüz bir oyunlaştırılmış ödev eklemediniz</p>
        <p className="text-[12.5px] text-surface-400">Global Kütüphane sekmesinden &quot;Reklam Tasarımı&quot;nı kütüphanenize ekleyin.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 bg-surface-50 w-fit p-1 rounded-xl border border-surface-100 shadow-sm">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`px-4 py-2 rounded-[10px] text-[12.5px] font-bold transition-all cursor-pointer outline-none ${
              subTab === t.key ? "bg-white text-base-primary-900 shadow-sm border border-surface-100" : "text-surface-400 hover:text-surface-600 border border-transparent"
            }`}>
            {t.label}
          </button>
        ))}
        {saving && <Loader2 size={14} className="animate-spin text-surface-400 ml-2" />}
      </div>

      {subTab === "sectors" && <SectorsTab pool={pool} onSave={(sectors) => persist({ brands: pool.brands, sectors, formats: pool.formats, globalPurposes: pool.globalPurposes, sharedRule: pool.sharedRule })} />}
      {subTab === "brands" && <BrandsTab pool={pool} onSave={(brands) => persist({ brands, sectors: pool.sectors, formats: pool.formats, globalPurposes: pool.globalPurposes, sharedRule: pool.sharedRule })} />}
      {subTab === "formats" && <FormatsTab pool={pool} onSave={(formats) => persist({ brands: pool.brands, sectors: pool.sectors, formats, globalPurposes: pool.globalPurposes, sharedRule: pool.sharedRule })} />}
      {subTab === "rule" && <RuleTab pool={pool} onSave={(globalPurposes, sharedRule) => persist({ brands: pool.brands, sectors: pool.sectors, formats: pool.formats, globalPurposes, sharedRule })} />}
    </div>
  );
}
