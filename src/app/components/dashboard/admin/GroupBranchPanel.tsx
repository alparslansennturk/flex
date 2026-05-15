"use client";
import React, { useState, useEffect } from "react";
import {
  Plus, Trash2, GitBranch, Clock, BookOpen, Building2,
  ChevronUp, ChevronDown, CalendarDays, CalendarOff, Layers, GraduationCap,
  AlertCircle, ToggleLeft, ToggleRight, FolderOpen,
} from "lucide-react";
import { db } from "@/app/lib/firebase";
import {
  collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc,
  serverTimestamp, query, orderBy, writeBatch, getDocs,
} from "firebase/firestore";

interface Category    { id: string; name: string; slug: string; order: number; isActive: boolean; }
interface Branch      { id: string; name: string; slug: string; sessionHours?: number; categoryId?: string; }
interface BranchModule { id: string; name: string; totalHours: number; sessionHours?: number; order: number; isActive: boolean; }
interface SessionTemplate { id: string; label: string; order: number; isActive: boolean; }

const SEED_SESSIONS = [
  "Pts - Çar | 19.00 - 21.30",
  "Sal - Per | 19.00 - 21.30",
  "Cts - Paz | 09.00 - 12.00",
  "Cts - Paz | 12.00 - 15.00",
  "Cts - Paz | 15.00 - 18.00",
  "Özel Grup Tanımla",
];

type Section = "branches" | "sessions" | "holidays" | "special";

interface Holiday {
  id: string;
  name: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  createdAt?: any;
}

export default function GroupBranchPanel() {
  const [section, setSection] = useState<Section>("branches");

  // Categories
  const [categories, setCategories]       = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [categoryLoading, setCategoryLoading] = useState(false);

  // Branches
  const [branches, setBranches]           = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState("");
  const [branchError, setBranchError]     = useState("");
  const [branchLoading, setBranchLoading] = useState(false);

  // Modules
  const [modules, setModules]             = useState<BranchModule[]>([]);
  const [newModName, setNewModName]       = useState("");
  const [newModHours, setNewModHours]     = useState("");
  const [newModSessionHours, setNewModSessionHours] = useState("");
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleError, setModuleError]     = useState("");

  // Sessions
  const [sessions, setSessions]           = useState<SessionTemplate[]>([]);
  const [newSessionLabel, setNewSessionLabel] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);
  const [seeded, setSeeded]               = useState(false);

  // Holidays
  const [holidays, setHolidays]           = useState<Holiday[]>([]);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayStart, setNewHolidayStart] = useState("");
  const [newHolidayEnd, setNewHolidayEnd] = useState("");
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [holidayError, setHolidayError]   = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "categories"), orderBy("order", "asc")),
      snap => setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)))
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "branches"), snap => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "holidays"), orderBy("startDate", "asc")),
      snap => setHolidays(snap.docs.map(d => ({ id: d.id, ...d.data() } as Holiday)))
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedBranchId) { setModules([]); return; }
    const unsub = onSnapshot(
      query(collection(db, "branches", selectedBranchId, "modules"), orderBy("order", "asc")),
      snap => setModules(snap.docs.map(d => ({ id: d.id, ...d.data() } as BranchModule)))
    );
    return () => unsub();
  }, [selectedBranchId]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "sessions"), orderBy("order", "asc")),
      async snap => {
        if (snap.empty && !seeded) {
          setSeeded(true);
          const batch = writeBatch(db);
          SEED_SESSIONS.forEach((label, i) => {
            batch.set(doc(collection(db, "sessions")), { label, order: i, isActive: true, createdAt: serverTimestamp() });
          });
          await batch.commit();
          return;
        }
        setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionTemplate)));
      }
    );
    return () => unsub();
  }, [seeded]);

  const slugify = (t: string) =>
    t.toLowerCase()
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
      .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // ── Category handlers ──────────────────────────────────────────────────────

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const slug = slugify(trimmed);
    if (categories.some(c => c.slug === slug)) { setCategoryError("Bu kategori zaten mevcut."); return; }
    setCategoryLoading(true);
    try {
      await addDoc(collection(db, "categories"), {
        name: trimmed, slug, order: categories.length, isActive: true, createdAt: serverTimestamp(),
      });
      setNewCategoryName(""); setCategoryError("");
    } finally { setCategoryLoading(false); }
  };

  const handleDeleteCategory = async (c: Category) => {
    const hasBranches = branches.some(b => b.categoryId === c.id);
    if (hasBranches) { setCategoryError(`"${c.name}" kategorisinde branşlar var. Önce branşları silin veya taşıyın.`); return; }
    setCategoryError("");
    if (selectedCategoryId === c.id) { setSelectedCategoryId(null); setSelectedBranchId(null); }
    await deleteDoc(doc(db, "categories", c.id));
  };

  const handleSelectCategory = (id: string) => {
    setSelectedCategoryId(id);
    setSelectedBranchId(null);
    setBranchError("");
  };

  // ── Branch handlers ────────────────────────────────────────────────────────

  const handleAddBranch = async () => {
    if (!selectedCategoryId) { setBranchError("Önce sol taraftan bir kategori seçin."); return; }
    const trimmed = newBranchName.trim();
    if (!trimmed) return;
    const slug = slugify(trimmed);
    const existing = branches.find(b => b.slug === slug);
    if (existing) {
      if (existing.categoryId === selectedCategoryId) {
        setBranchError("Bu branş zaten bu kategoride mevcut.");
        return;
      }
      // Kategorisiz veya başka kategorideki branşı bu kategoriye taşı
      setBranchLoading(true);
      try {
        await updateDoc(doc(db, "branches", existing.id), { categoryId: selectedCategoryId });
        setNewBranchName(""); setBranchError("");
      } finally { setBranchLoading(false); }
      return;
    }
    setBranchLoading(true);
    try {
      await addDoc(collection(db, "branches"), {
        name: trimmed, slug, categoryId: selectedCategoryId, createdAt: serverTimestamp(),
      });
      setNewBranchName(""); setBranchError("");
    } finally { setBranchLoading(false); }
  };

  const handleDeleteBranch = async (b: Branch) => {
    const modSnap = await getDocs(collection(db, "branches", b.id, "modules"));
    if (!modSnap.empty) { setBranchError(`"${b.name}" branşının modülleri var. Önce modülleri silin.`); return; }
    setBranchError("");
    if (selectedBranchId === b.id) setSelectedBranchId(null);
    await deleteDoc(doc(db, "branches", b.id));
  };

  const handleUpdateBranchHours = async (b: Branch, hours: number) => {
    if (isNaN(hours) || hours < 1) return;
    await updateDoc(doc(db, "branches", b.id), { sessionHours: hours });
  };

  // ── Module handlers ────────────────────────────────────────────────────────

  const handleAddModule = async () => {
    if (!selectedBranchId) return;
    const name = newModName.trim();
    const totalHours = parseInt(newModHours, 10);
    const sessionHours = parseInt(newModSessionHours, 10);
    if (!name || isNaN(totalHours) || totalHours < 1) { setModuleError("Modül adı ve toplam saat zorunludur."); return; }
    if (isNaN(sessionHours) || sessionHours < 1) { setModuleError("Seans süresi zorunludur."); return; }
    setModuleLoading(true);
    try {
      await addDoc(collection(db, "branches", selectedBranchId, "modules"), {
        name, totalHours, sessionHours,
        order: modules.length, isActive: true, createdAt: serverTimestamp(),
      });
      setNewModName(""); setNewModHours(""); setNewModSessionHours(""); setModuleError("");
    } finally { setModuleLoading(false); }
  };

  const handleDeleteModule = async (modId: string) => {
    if (!selectedBranchId) return;
    await deleteDoc(doc(db, "branches", selectedBranchId, "modules", modId));
  };

  const handleUpdateModuleField = async (modId: string, field: string, value: unknown) => {
    if (!selectedBranchId) return;
    await updateDoc(doc(db, "branches", selectedBranchId, "modules", modId), { [field]: value });
  };

  const handleMoveModule = async (index: number, dir: -1 | 1) => {
    if (!selectedBranchId) return;
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= modules.length) return;
    const batch = writeBatch(db);
    batch.update(doc(db, "branches", selectedBranchId, "modules", modules[index].id), { order: newIndex });
    batch.update(doc(db, "branches", selectedBranchId, "modules", modules[newIndex].id), { order: index });
    await batch.commit();
  };

  // ── Session handlers ───────────────────────────────────────────────────────

  const handleAddSession = async () => {
    const label = newSessionLabel.trim();
    if (!label) return;
    setSessionLoading(true);
    try {
      await addDoc(collection(db, "sessions"), { label, order: sessions.length, isActive: true, createdAt: serverTimestamp() });
      setNewSessionLabel("");
    } finally { setSessionLoading(false); }
  };

  const handleDeleteSession = async (id: string) => {
    await deleteDoc(doc(db, "sessions", id));
  };

  const handleToggleSession = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "sessions", id), { isActive: !current });
  };

  // ── Holiday handlers ───────────────────────────────────────────────────────

  const handleAddHoliday = async () => {
    const name = newHolidayName.trim();
    if (!name || !newHolidayStart) { setHolidayError("Tatil adı ve başlangıç tarihi zorunludur."); return; }
    const end = newHolidayEnd || newHolidayStart;
    if (end < newHolidayStart) { setHolidayError("Bitiş tarihi başlangıçtan önce olamaz."); return; }
    setHolidayLoading(true);
    try {
      await addDoc(collection(db, "holidays"), {
        name, startDate: newHolidayStart, endDate: end, createdAt: serverTimestamp(),
      });
      setNewHolidayName(""); setNewHolidayStart(""); setNewHolidayEnd(""); setHolidayError("");
    } finally { setHolidayLoading(false); }
  };

  const handleDeleteHoliday = async (id: string) => {
    await deleteDoc(doc(db, "holidays", id));
  };

  const holidayDayCount = (h: Holiday) => {
    const s = new Date(h.startDate + "T12:00:00");
    const e = new Date(h.endDate   + "T12:00:00");
    return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  };

  const formatHolidayDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });


  const filteredBranches = selectedCategoryId
    ? branches.filter(b => b.categoryId === selectedCategoryId)
    : [];

  const selectedBranch  = branches.find(b => b.id === selectedBranchId);
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  return (
    <div className="max-w-[1920px] mx-auto px-8 py-8 xl:px-14">
      {/* Section buttons */}
      <div className="flex items-center gap-1 bg-surface-100/60 w-fit p-1 rounded-[14px] border border-surface-100 mb-8">
        {([
          { id: "branches" as Section, label: "Branş & Modüller", icon: <GitBranch size={13} /> },
          { id: "sessions" as Section, label: "Seans Şablonları", icon: <CalendarDays size={13} /> },
          { id: "holidays" as Section, label: "Tatiller & İptaller", icon: <CalendarOff size={13} /> },
          { id: "special"  as Section, label: "Özel Tanımlar",    icon: <Layers size={13} /> },
        ]).map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-bold transition-all cursor-pointer ${
              section === s.id
                ? "bg-white text-base-primary-700 shadow-sm"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {s.icon}{s.label}
          </button>
        ))}
      </div>

      {/* ── Branş & Modüller ── */}
      {section === "branches" && (
        <div className="grid grid-cols-[200px_260px_1fr] gap-0 min-h-[500px]">

          {/* Col 1: Categories */}
          <div className="pr-5 border-r border-neutral-100 space-y-3">
            <h3 className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">Kategoriler</h3>
            <div className="flex gap-2">
              <input
                value={newCategoryName}
                onChange={e => { setNewCategoryName(e.target.value); setCategoryError(""); }}
                onKeyDown={e => e.key === "Enter" && handleAddCategory()}
                placeholder="Yeni kategori"
                className="flex-1 h-9 border border-neutral-200 bg-neutral-50 rounded-xl px-3 outline-none focus:border-base-primary-400 text-[12px] font-bold text-base-primary-900 placeholder:font-normal placeholder:text-neutral-400 min-w-0"
              />
              <button
                onClick={handleAddCategory}
                disabled={categoryLoading || !newCategoryName.trim()}
                className="h-9 px-2.5 bg-base-primary-600 text-white rounded-xl font-bold flex items-center gap-1 hover:bg-base-primary-700 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                <Plus size={14} />
              </button>
            </div>
            {categoryError && <p className="text-[11px] font-bold text-red-500">{categoryError}</p>}

            <div className="space-y-1">
              {categories.map(c => {
                const count = branches.filter(b => b.categoryId === c.id).length;
                const isSelected = selectedCategoryId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCategory(c.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer transition-all group ${
                      isSelected
                        ? "bg-base-primary-50 border-base-primary-200 shadow-sm"
                        : "bg-white border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderOpen size={13} className={isSelected ? "text-base-primary-500 shrink-0" : "text-neutral-300 shrink-0"} />
                      <span className={`text-[12px] font-bold truncate ${isSelected ? "text-base-primary-700" : "text-base-primary-900"}`}>
                        {c.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        isSelected ? "bg-base-primary-100 text-base-primary-600" : "bg-neutral-100 text-neutral-400"
                      }`}>
                        {count}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteCategory(c); }}
                        className="w-5 h-5 flex items-center justify-center rounded-md text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {categories.length === 0 && (
                <div className="text-center py-10 text-neutral-300">
                  <FolderOpen size={28} strokeWidth={1} className="mx-auto mb-2" />
                  <p className="text-[11px] font-bold">Henüz kategori yok</p>
                </div>
              )}
            </div>
          </div>

          {/* Col 2: Branches */}
          <div className="px-5 border-r border-neutral-100 space-y-3">
            <h3 className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
              {selectedCategory ? selectedCategory.name : "Branşlar"}
            </h3>

            {!selectedCategoryId ? (
              <div className="flex flex-col items-center justify-center py-16 text-neutral-300">
                <GitBranch size={28} strokeWidth={1} className="mb-2" />
                <p className="text-[11px] font-bold text-center">Sol taraftan kategori seçin</p>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    value={newBranchName}
                    onChange={e => { setNewBranchName(e.target.value); setBranchError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleAddBranch()}
                    placeholder="Yeni branş"
                    className="flex-1 h-9 border border-neutral-200 bg-neutral-50 rounded-xl px-3 outline-none focus:border-base-primary-400 text-[12px] font-bold text-base-primary-900 placeholder:font-normal placeholder:text-neutral-400 min-w-0"
                  />
                  <button
                    onClick={handleAddBranch}
                    disabled={branchLoading || !newBranchName.trim()}
                    className="h-9 px-2.5 bg-base-primary-600 text-white rounded-xl font-bold flex items-center gap-1 hover:bg-base-primary-700 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {branchError && <p className="text-[11px] font-bold text-red-500">{branchError}</p>}

                <div className="space-y-1">
                  {filteredBranches.map(b => {
                    const isSelected = selectedBranchId === b.id;
                    return (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBranchId(b.id)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer transition-all group ${
                          isSelected
                            ? "bg-base-primary-50 border-base-primary-200 shadow-sm"
                            : "bg-white border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] font-bold truncate ${isSelected ? "text-base-primary-700" : "text-base-primary-900"}`}>
                            {b.name}
                          </p>
                          <span className="text-[10px] text-neutral-400 font-medium flex items-center gap-1 mt-0.5">
                            <Clock size={9} />{b.sessionHours ?? "—"} saat/seans
                          </span>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteBranch(b); }}
                          className="w-5 h-5 flex items-center justify-center rounded-md text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    );
                  })}
                  {filteredBranches.length === 0 && (
                    <div className="text-center py-10 text-neutral-300">
                      <GitBranch size={28} strokeWidth={1} className="mx-auto mb-2" />
                      <p className="text-[11px] font-bold">Bu kategoride branş yok</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Col 3: Modules */}
          <div className="pl-5">
            {!selectedBranchId ? (
              <div className="flex flex-col items-center justify-center py-24 text-neutral-300">
                <BookOpen size={40} strokeWidth={1} className="mb-3" />
                <p className="text-[14px] font-bold">Ortadan bir branş seçin</p>
                <p className="text-[12px] mt-1">Branşın modüllerini buradan yönetebilirsiniz</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Branch header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[16px] font-bold text-base-primary-900">{selectedBranch?.name}</h3>
                    <p className="text-[12px] text-neutral-400 mt-0.5">
                      {selectedCategory?.name} · Modüller ve saat bilgileri
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2">
                    <Clock size={13} className="text-neutral-400" />
                    <span className="text-[12px] text-neutral-500 font-medium">Varsayılan seans:</span>
                    <input
                      key={selectedBranchId}
                      type="number" min={1} max={12}
                      defaultValue={selectedBranch?.sessionHours ?? ""}
                      placeholder="—"
                      onBlur={e => selectedBranch && handleUpdateBranchHours(selectedBranch, parseInt(e.target.value, 10))}
                      onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      className="w-10 text-center text-[13px] font-bold text-base-primary-900 border border-neutral-200 rounded-lg py-0.5 outline-none focus:border-base-primary-400 bg-white"
                    />
                    <span className="text-[12px] text-neutral-400">saat</span>
                  </div>
                </div>

                {/* Module table */}
                {modules.length > 0 && (
                  <div className="bg-white border border-neutral-100 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-100 bg-neutral-50/50">
                          <th className="w-8 px-3 py-3" />
                          <th className="text-left px-5 py-3 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Modül Adı</th>
                          <th className="text-left px-4 py-3 text-[11px] font-bold text-neutral-400 uppercase tracking-wider w-36">Toplam Saat</th>
                          <th className="text-left px-4 py-3 text-[11px] font-bold text-neutral-400 uppercase tracking-wider w-36">Seans Süresi</th>
                          <th className="text-center px-4 py-3 text-[11px] font-bold text-neutral-400 uppercase tracking-wider w-20">Aktif</th>
                          <th className="px-4 py-3 w-16" />
                        </tr>
                      </thead>
                      <tbody>
                        {modules.map((m, i) => (
                          <tr key={m.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/40 group">
                            <td className="px-3 py-3">
                              <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleMoveModule(i, -1)} disabled={i === 0} className="w-5 h-5 flex items-center justify-center rounded hover:bg-neutral-100 disabled:opacity-30 cursor-pointer">
                                  <ChevronUp size={12} className="text-neutral-400" />
                                </button>
                                <button onClick={() => handleMoveModule(i, 1)} disabled={i === modules.length - 1} className="w-5 h-5 flex items-center justify-center rounded hover:bg-neutral-100 disabled:opacity-30 cursor-pointer">
                                  <ChevronDown size={12} className="text-neutral-400" />
                                </button>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <input
                                key={`name-${m.id}`}
                                defaultValue={m.name}
                                onBlur={e => { const v = e.target.value.trim(); if (v && v !== m.name) handleUpdateModuleField(m.id, "name", v); }}
                                onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                                className="w-full text-[14px] font-bold text-base-primary-900 bg-transparent outline-none focus:bg-white focus:border focus:border-base-primary-200 focus:rounded-lg focus:px-2 focus:py-1 transition-all"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number" min={1}
                                  key={`hours-${m.id}`}
                                  defaultValue={m.totalHours}
                                  onBlur={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v > 0) handleUpdateModuleField(m.id, "totalHours", v); }}
                                  onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                                  className="w-16 text-center text-[13px] font-bold text-base-primary-900 border border-neutral-200 rounded-lg py-1 outline-none focus:border-base-primary-400 bg-neutral-50"
                                />
                                <span className="text-[11px] text-neutral-400">saat</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number" min={1} max={12}
                                  key={`sh-${m.id}`}
                                  defaultValue={m.sessionHours ?? ""}
                                  placeholder={`${selectedBranch?.sessionHours ?? "—"}`}
                                  onBlur={e => {
                                    const v = parseInt(e.target.value, 10);
                                    handleUpdateModuleField(m.id, "sessionHours", isNaN(v) ? null : v);
                                  }}
                                  onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                                  className="w-16 text-center text-[13px] font-bold text-base-primary-900 border border-neutral-200 rounded-lg py-1 outline-none focus:border-base-primary-400 bg-neutral-50 placeholder:text-neutral-300"
                                />
                                <span className="text-[11px] text-neutral-400">saat</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => handleUpdateModuleField(m.id, "isActive", !m.isActive)} className={`transition-colors cursor-pointer ${m.isActive ? "text-emerald-500" : "text-neutral-300"}`}>
                                {m.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleDeleteModule(m.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer opacity-0 group-hover:opacity-100 ml-auto"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {modules.length === 0 && (
                  <div className="text-center py-10 text-neutral-300 bg-white border border-neutral-100 rounded-2xl">
                    <BookOpen size={36} strokeWidth={1} className="mx-auto mb-2" />
                    <p className="text-[13px] font-bold">Bu branşa henüz modül eklenmedi</p>
                  </div>
                )}

                {/* Add module form */}
                <div className="bg-neutral-50 border border-neutral-200 border-dashed rounded-2xl p-5">
                  <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-3">Yeni Modül Ekle</h4>
                  <div className="flex gap-3 items-end flex-wrap">
                    <div className="flex-1 min-w-[160px]">
                      <label className="text-[11px] font-bold text-neutral-400 ml-1 mb-1 block">Modül Adı</label>
                      <input
                        value={newModName}
                        onChange={e => { setNewModName(e.target.value); setModuleError(""); }}
                        onKeyDown={e => e.key === "Enter" && handleAddModule()}
                        placeholder="Örn: Grafik-1"
                        className="w-full h-10 border border-neutral-200 bg-white rounded-xl px-3 outline-none focus:border-base-primary-400 text-[13px] font-bold text-base-primary-900 placeholder:font-normal placeholder:text-neutral-400"
                      />
                    </div>
                    <div className="w-28">
                      <label className="text-[11px] font-bold text-neutral-400 ml-1 mb-1 block">Toplam Saat</label>
                      <input
                        type="number" min={1}
                        value={newModHours}
                        onChange={e => { setNewModHours(e.target.value); setModuleError(""); }}
                        placeholder="81"
                        className="w-full h-10 border border-neutral-200 bg-white rounded-xl px-3 outline-none focus:border-base-primary-400 text-[13px] font-bold text-base-primary-900 placeholder:font-normal placeholder:text-neutral-400"
                      />
                    </div>
                    <div className="w-40">
                      <label className="text-[11px] font-bold text-neutral-400 ml-1 mb-1 block">Seans Süresi (saat)</label>
                      <input
                        type="number" min={1} max={12}
                        value={newModSessionHours}
                        onChange={e => { setNewModSessionHours(e.target.value); setModuleError(""); }}
                        placeholder="2.5"
                        className="w-full h-10 border border-neutral-200 bg-white rounded-xl px-3 outline-none focus:border-base-primary-400 text-[13px] font-bold text-base-primary-900 placeholder:font-normal placeholder:text-neutral-400"
                      />
                    </div>
                    <button
                      onClick={handleAddModule}
                      disabled={moduleLoading || !newModName.trim() || !newModHours || !newModSessionHours}
                      className="h-10 px-5 bg-base-primary-600 text-white rounded-xl font-bold text-[13px] flex items-center gap-2 hover:bg-base-primary-700 transition-all active:scale-95 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                    >
                      <Plus size={14} /> Ekle
                    </button>
                  </div>
                  {moduleError && <p className="text-[12px] font-bold text-red-500 mt-2">{moduleError}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Seans Şablonları ── */}
      {section === "sessions" && (
        <div className="max-w-xl space-y-6">
          <div>
            <h3 className="text-[16px] font-bold text-base-primary-900">Seans Şablonları</h3>
            <p className="text-[13px] text-neutral-400 mt-1">Grup oluştururken görünen seans seçenekleri.</p>
          </div>
          <div className="flex gap-3">
            <input
              value={newSessionLabel}
              onChange={e => setNewSessionLabel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddSession()}
              placeholder="Örn: Pts - Çar | 19.00 - 21.30"
              className="flex-1 h-10 border border-neutral-200 bg-neutral-50 rounded-xl px-4 outline-none focus:border-base-primary-400 text-[13px] font-bold text-base-primary-900 placeholder:font-normal placeholder:text-neutral-400"
            />
            <button
              onClick={handleAddSession}
              disabled={sessionLoading || !newSessionLabel.trim()}
              className="h-10 px-5 bg-base-primary-600 text-white rounded-xl font-bold text-[13px] flex items-center gap-2 hover:bg-base-primary-700 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
            >
              <Plus size={14} /> Ekle
            </button>
          </div>
          <div className="bg-white border border-neutral-100 rounded-2xl overflow-hidden shadow-sm">
            {sessions.map((s, i) => (
              <div key={s.id} className={`flex items-center gap-4 px-5 py-3.5 group ${i < sessions.length - 1 ? "border-b border-neutral-50" : ""} hover:bg-neutral-50/50`}>
                <span className={`flex-1 text-[13px] font-bold ${s.isActive ? "text-base-primary-900" : "text-neutral-300 line-through"}`}>
                  {s.label}
                </span>
                <button onClick={() => handleToggleSession(s.id, s.isActive)} className={`transition-colors cursor-pointer shrink-0 ${s.isActive ? "text-emerald-500" : "text-neutral-300"}`}>
                  {s.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <button
                  onClick={() => handleDeleteSession(s.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="text-center py-10 text-neutral-300">
                <p className="text-[13px] font-bold">Yükleniyor...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tatiller & İptaller ── */}
      {section === "holidays" && (
        <div className="max-w-2xl space-y-6">
          <div>
            <h3 className="text-[16px] font-bold text-base-primary-900">Tatiller & İptaller</h3>
            <p className="text-[13px] text-neutral-400 mt-1">
              Resmi tatiller ve uzun dönem kapanışlar. Bu günlerde tüm gruplar için yoklama devre dışı kalır.
              Anlık ders iptali için Yoklama panelindeki "Ders Olmadı" butonunu kullanın.
            </p>
          </div>

          {/* Yeni tatil formu */}
          <div className="bg-neutral-50 border border-neutral-200 border-dashed rounded-2xl p-5 space-y-4">
            <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Tatil Ekle</h4>
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-[180px] space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 ml-1">Tatil Adı</label>
                <input
                  value={newHolidayName}
                  onChange={e => { setNewHolidayName(e.target.value); setHolidayError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleAddHoliday()}
                  placeholder="Örn: Kurban Bayramı"
                  className="w-full h-10 border border-neutral-200 bg-white rounded-xl px-3 outline-none focus:border-base-primary-400 text-[13px] font-bold text-base-primary-900 placeholder:font-normal placeholder:text-neutral-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 ml-1">Başlangıç</label>
                <input
                  type="date"
                  value={newHolidayStart}
                  onChange={e => { setNewHolidayStart(e.target.value); setHolidayError(""); }}
                  className="h-10 border border-neutral-200 bg-white rounded-xl px-3 outline-none focus:border-base-primary-400 text-[13px] font-bold text-base-primary-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 ml-1">Bitiş (tek günse boş bırak)</label>
                <input
                  type="date"
                  value={newHolidayEnd}
                  min={newHolidayStart}
                  onChange={e => setNewHolidayEnd(e.target.value)}
                  className="h-10 border border-neutral-200 bg-white rounded-xl px-3 outline-none focus:border-base-primary-400 text-[13px] font-bold text-base-primary-900"
                />
              </div>
              <button
                onClick={handleAddHoliday}
                disabled={holidayLoading || !newHolidayName.trim() || !newHolidayStart}
                className="h-10 px-5 bg-base-primary-600 text-white rounded-xl font-bold text-[13px] flex items-center gap-2 hover:bg-base-primary-700 transition-all active:scale-95 disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                <Plus size={14} /> Ekle
              </button>
            </div>
            {holidayError && <p className="text-[12px] font-bold text-red-500">{holidayError}</p>}
          </div>

          {/* Tatil listesi */}
          {holidays.length > 0 ? (
            <div className="bg-white border border-neutral-100 rounded-2xl overflow-hidden shadow-sm">
              {holidays.map((h, i) => {
                const days = holidayDayCount(h);
                const isPast = h.endDate < new Date().toISOString().slice(0, 10);
                return (
                  <div key={h.id} className={`flex items-center gap-4 px-5 py-4 group ${i < holidays.length - 1 ? "border-b border-neutral-50" : ""} ${isPast ? "opacity-50" : ""}`}>
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                      <CalendarOff size={16} className="text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-base-primary-900">{h.name}</p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        {formatHolidayDate(h.startDate)}
                        {h.startDate !== h.endDate && <> — {formatHolidayDate(h.endDate)}</>}
                        <span className="ml-2 font-bold text-neutral-500">{days} gün</span>
                      </p>
                    </div>
                    {isPast && <span className="text-[10px] font-bold text-neutral-300 shrink-0">Geçmiş</span>}
                    <button
                      onClick={() => handleDeleteHoliday(h.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-neutral-300">
              <CalendarOff size={36} strokeWidth={1} className="mx-auto mb-3" />
              <p className="text-[13px] font-bold">Henüz tatil eklenmedi</p>
            </div>
          )}
        </div>
      )}

      {/* ── Özel Tanımlar ── */}
      {section === "special" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
          <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <GraduationCap size={18} className="text-violet-500" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-base-primary-900">Özel Ders</h4>
                <p className="text-[11px] text-neutral-400 font-medium">Bireysel eğitim</p>
              </div>
            </div>
            <p className="text-[13px] text-neutral-500 leading-relaxed">
              Öğrenciye özel, standart müfredata bağlı olmayan eğitim. Saat sayısı grup oluşturulurken manuel tanımlanır (10, 20, 30 saat). Seans bilgisi de özel girilir.
            </p>
            <div className="mt-4 flex items-start gap-2 bg-violet-50 rounded-xl px-3 py-2">
              <AlertCircle size={13} className="text-violet-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-violet-600 font-medium">Modül sistemi dışında. Sertifika hesaplaması ayrıca yapılır.</p>
            </div>
          </div>

          <div className="bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <Building2 size={18} className="text-blue-500" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-base-primary-900">Kurumsal Eğitim</h4>
                <p className="text-[11px] text-neutral-400 font-medium">B2B eğitim</p>
              </div>
            </div>
            <p className="text-[13px] text-neutral-500 leading-relaxed">
              Bir şirkete verilen toplu eğitim. Çalışanlar öğrenci olarak eklenir. Saat ve içerik müşteriye özel belirlenir. Fatura şirkete kesilir.
            </p>
            <div className="mt-4 flex items-start gap-2 bg-blue-50 rounded-xl px-3 py-2">
              <AlertCircle size={13} className="text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-600 font-medium">Şirket bilgisi ileride Flex-CRM&apos;e bağlanacak. Şimdilik şirket adı alanı yeterli.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
