"use client";

import { useState, useEffect } from "react";
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import { Check, Users } from "lucide-react";

const LEVELS = ["Seviye 1", "Seviye 2", "Seviye 3"];

export interface AssignSelection {
  classId:     string; // group code (öğrenci sorguları için backward compat)
  groupId:     string; // group Firestore doc ID (benzersiz kimlik)
  groupBranch: string; // gruba ait şube
  groupModule?: "GRAFIK_1" | "GRAFIK_2"; // grubun modülü
  level:       string;
  endDate:     string;
}

interface Group {
  id: string;
  code: string;
  branch?: string;
  instructor?: string;
  instructorId?: string;
  status?: string;
  module?: "GRAFIK_1" | "GRAFIK_2";
}

export function AssignActivateModal({
  taskName,
  templateId,
  templateLevel,
  onConfirm,
  onCancel,
}: {
  taskName: string;
  templateId?: string;
  templateLevel?: string; // şablonda belirlendiyse seçim disabled gelir
  onConfirm: (selections: AssignSelection[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [level,           setLevel]           = useState(templateLevel ?? "");
  const [endDate,         setEndDate]         = useState("");
  const [loading,         setLoading]         = useState(false);
  const [visible,         setVisible]         = useState(false);
  const [groups,          setGroups]          = useState<Group[]>([]);
  const [groupsLoading,   setGroupsLoading]   = useState(true);
  const [busyGroupIds,    setBusyGroupIds]    = useState<string[]>([]);

  const { user } = useUser();

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // Eğitmene ait aktif grupları ve mevcut aktif görevleri çek
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) { setGroupsLoading(false); return; }

    const q = query(collection(db, "groups"), where("instructorId", "==", uid));
    const unsub = onSnapshot(q, async snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Group));
      setGroups(all.filter(g => g.status === "active"));

      // Bu şablon için grubu daha önce almış olanları bul — tek where + JS filtre (composite index sorununu önler)
      const taskSnap = templateId
        ? await getDocs(query(collection(db, "tasks"), where("templateId", "==", templateId)))
        : await getDocs(query(collection(db, "tasks"), where("ownedBy", "==", uid)));
      const busy = taskSnap.docs
        .filter(d => {
          const data = d.data();
          if (data.status !== "active") return false;
          if (templateId) return data.ownedBy === uid;
          return true;
        })
        .map(d => d.data().groupId as string)
        .filter(Boolean);
      setBusyGroupIds(busy);

      setGroupsLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleCancel = () => { setVisible(false); setTimeout(onCancel, 280); };

  const toggleGroup = (id: string) => {
    if (busyGroupIds.includes(id)) return;
    setSelectedGroupIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const today = new Date().toISOString().split("T")[0];
  const canSubmit = selectedGroupIds.length > 0 && !!level && !!endDate;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setLoading(true);
    const selections: AssignSelection[] = selectedGroupIds.map(id => {
      const g = groups.find(gr => gr.id === id)!;
      return { classId: g.code, groupId: g.id, groupBranch: g.branch ?? "", groupModule: g.module, level, endDate };
    });
    await onConfirm(selections);
    setVisible(false);
    setLoading(false);
  };

  return (
    <div className={`fixed inset-0 z-800 flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div
        className={`absolute inset-0 bg-base-primary-900/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleCancel}
      />
      <div className={`relative bg-white rounded-16 shadow-2xl w-full max-w-md p-8 flex flex-col gap-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>

        {/* Başlık */}
        <div>
          <p className="text-[17px] font-bold text-base-primary-900 mb-1">Ödevi Aktife Al</p>
          <p className="text-[13px] text-surface-500">
            <span className="font-bold text-base-primary-700">"{taskName}"</span> için grup ve seviye belirleyin.
          </p>
        </div>

        {/* Grup Listesi */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide">Grup Seçimi</p>
            {selectedGroupIds.length > 1 && (
              <span className="text-[11px] text-base-primary-500 font-semibold">
                {selectedGroupIds.length} grup seçildi
              </span>
            )}
          </div>

          {groupsLoading ? (
            <div className="flex items-center justify-center h-24 bg-surface-50 rounded-12 border border-surface-100">
              <div className="w-5 h-5 border-2 border-surface-200 border-t-base-primary-500 rounded-full animate-spin" />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 bg-surface-50 rounded-12 border border-surface-100 gap-2">
              <Users size={20} className="text-surface-300" />
              <p className="text-[12px] text-surface-400 font-medium text-center">
                Size atanmış aktif grup bulunamadı
              </p>
            </div>
          ) : (
            <div className="max-h-28 overflow-y-auto rounded-12 border border-surface-200 divide-y divide-surface-100">
              {groups.map(g => {
                const isSelected = selectedGroupIds.includes(g.id);
                const isBusy    = busyGroupIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleGroup(g.id)}
                    disabled={isBusy}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isBusy
                        ? "bg-surface-50 cursor-not-allowed opacity-50"
                        : isSelected
                        ? "bg-base-primary-50 cursor-pointer"
                        : "bg-white hover:bg-surface-50 cursor-pointer"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? "bg-base-primary-900 border-base-primary-900"
                        : "border-surface-300"
                    }`}>
                      {isSelected && <Check size={9} className="text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="w-20 text-[11px] font-medium text-surface-400 shrink-0 truncate">
                        {g.branch ?? ""}
                      </span>
                      <span className="text-surface-200 text-[10px] shrink-0">—</span>
                      <span className={`text-[12px] font-bold truncate ${
                        isSelected ? "text-base-primary-900" : isBusy ? "text-surface-400" : "text-surface-700"
                      }`}>
                        {g.code}
                      </span>
                      {isBusy && (
                        <span className="text-[10px] text-surface-400 font-medium ml-auto shrink-0">✓</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Seviye */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide">Seviye</p>
            {templateLevel && (
              <span className="text-[10px] font-semibold text-base-primary-500 bg-base-primary-50 px-2 py-0.5 rounded-full">
                Şablonda belirlendi
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map(l => (
              <button
                key={l}
                onClick={() => !templateLevel && setLevel(l)}
                disabled={!!templateLevel}
                className={`py-2 rounded-xl text-[12px] font-bold border transition-all ${
                  level === l
                    ? templateLevel
                      ? "bg-base-primary-700 text-white border-base-primary-700"
                      : "bg-base-primary-900 text-white border-base-primary-900"
                    : templateLevel
                      ? "bg-surface-100 border-surface-200 text-surface-400"
                      : "bg-white border-surface-200 text-surface-600 cursor-pointer hover:border-base-primary-400 hover:text-base-primary-700"
                } ${templateLevel ? "cursor-not-allowed" : ""}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Bitiş Tarihi */}
        <div>
          <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide mb-2">Bitiş Tarihi</p>
          <input
            type="date"
            value={endDate}
            min={today}
            onChange={e => setEndDate(e.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-surface-200 bg-surface-50 text-[14px] text-text-primary font-medium outline-none focus:border-base-primary-500 focus:bg-white transition-all cursor-pointer"
          />
        </div>

        {/* Butonlar */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 h-11 rounded-xl border border-surface-200 text-[13px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer"
          >
            Vazgeç
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit || loading}
            className="flex-1 h-11 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              `Aktife Al${selectedGroupIds.length > 1 ? ` (${selectedGroupIds.length} grup)` : ""}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
