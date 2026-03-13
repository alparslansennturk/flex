"use client";

import { useState, useEffect } from "react";

const GROUPS = ["Grup 101", "Grup 102", "Grup 103"];
const LEVELS = ["Seviye-1", "Seviye-2", "Seviye-3", "Seviye-4"];

export interface AssignSelection {
  classId: string;
  level: string;
  endDate: string;
}

export function AssignActivateModal({
  taskName,
  onConfirm,
  onCancel,
}: {
  taskName: string;
  onConfirm: (selections: AssignSelection[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [level, setLevel]                   = useState("");
  const [endDate, setEndDate]               = useState("");
  const [loading, setLoading]               = useState(false);
  const [visible, setVisible]               = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleCancel = () => { setVisible(false); setTimeout(onCancel, 280); };

  const toggleGroup = (g: string) =>
    setSelectedGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  const canSubmit = selectedGroups.length > 0 && !!level && !!endDate;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setLoading(true);
    await onConfirm(selectedGroups.map(classId => ({ classId, level, endDate })));
    setVisible(false);
    setLoading(false);
  };

  return (
    <div className={`fixed inset-0 z-800 flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div
        className={`absolute inset-0 bg-base-primary-900/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleCancel}
      />
      <div className={`relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 flex flex-col gap-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>

        {/* Başlık */}
        <div>
          <p className="text-[17px] font-bold text-base-primary-900 mb-1">Ödevi Aktife Al</p>
          <p className="text-[13px] text-surface-500">
            <span className="font-bold text-base-primary-700">"{taskName}"</span> için grup ve seviye belirleyin.
          </p>
        </div>

        {/* Grup Seçimi */}
        <div>
          <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide mb-2">Grup Seçimi</p>
          <div className="flex flex-wrap gap-2">
            {GROUPS.map(g => (
              <button
                key={g}
                onClick={() => toggleGroup(g)}
                className={`px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all cursor-pointer border ${
                  selectedGroups.includes(g)
                    ? "bg-base-primary-900 text-white border-base-primary-900"
                    : "bg-white border-surface-200 text-surface-600 hover:border-base-primary-400 hover:text-base-primary-700"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          {selectedGroups.length > 1 && (
            <p className="text-[11px] text-base-primary-500 font-semibold mt-1.5">
              {selectedGroups.length} grup için ayrı ödev oluşturulacak
            </p>
          )}
        </div>

        {/* Seviye */}
        <div>
          <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide mb-2">Seviye</p>
          <div className="grid grid-cols-4 gap-2">
            {LEVELS.map(l => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`py-2 rounded-xl text-[12px] font-bold transition-all cursor-pointer border ${
                  level === l
                    ? "bg-base-primary-900 text-white border-base-primary-900"
                    : "bg-white border-surface-200 text-surface-600 hover:border-base-primary-400 hover:text-base-primary-700"
                }`}
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
              `Aktife Al${selectedGroups.length > 1 ? ` (${selectedGroups.length} grup)` : ""}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
