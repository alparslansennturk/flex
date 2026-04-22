"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Download, CheckSquare, Square, AlertCircle } from "lucide-react";
import SubmissionStatusBadge from "./SubmissionStatusBadge";
import type { Submission, SubmissionStatus } from "@/app/types/submission";

interface GradingRow extends Submission {
  studentName: string;
  groupCode: string;
  taskName: string;
}

interface Props {
  rows: GradingRow[];
  onGradeUpdate: (submissionId: string, grade: number) => Promise<void>;
  onBulkApprove?: (ids: string[]) => void;
  onExportCsv?: () => void;
  loading?: boolean;
}

const STATUS_OPTIONS: { label: string; value: SubmissionStatus | "all" }[] = [
  { label: "Tümü", value: "all" },
  { label: "Teslim Edildi", value: "submitted" },
  { label: "İnceleniyor", value: "reviewing" },
  { label: "Revizyon", value: "revision" },
  { label: "Tamamlandı", value: "completed" },
];

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
}

export default function GradingTable({ rows, onGradeUpdate, onBulkApprove, onExportCsv, loading }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "all">("all");
  const [pendingGrades, setPendingGrades] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const inputRefs = useRef<Record<string, HTMLInputElement>>({});

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const filtered = useMemo(() =>
    rows.filter(r => statusFilter === "all" || r.status === statusFilter),
    [rows, statusFilter]
  );

  const allSelected = filtered.length > 0 && filtered.every(r => selected.includes(r.id));
  const toggleAll = () => setSelected(allSelected ? [] : filtered.map(r => r.id));

  const handleGradeBlur = async (submissionId: string) => {
    const val = pendingGrades[submissionId];
    if (val === undefined) return;
    const num = parseFloat(val);
    if (isNaN(num) || num < 0 || num > 100) {
      setPendingGrades(prev => { const n = { ...prev }; delete n[submissionId]; return n; });
      return;
    }
    setSavingIds(prev => new Set(prev).add(submissionId));
    try {
      await onGradeUpdate(submissionId, num);
      setPendingGrades(prev => { const n = { ...prev }; delete n[submissionId]; return n; });
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(submissionId); return n; });
    }
  };

  // Ortalama
  const gradedRows = rows.filter(r => r.grade != null);
  const avg = gradedRows.length > 0
    ? Math.round(gradedRows.reduce((s, r) => s + (r.grade ?? 0), 0) / gradedRows.length)
    : null;

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-12 rounded-xl bg-surface-100 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-surface-50 rounded-xl p-1 border border-surface-200">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value as any)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                statusFilter === opt.value
                  ? "bg-white text-base-primary-700 shadow-sm"
                  : "text-surface-500 hover:text-surface-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {avg !== null && (
            <span className="text-[12px] font-bold text-surface-500">
              Ort: <span className="text-base-primary-700">{avg}</span>/100
            </span>
          )}
          {onExportCsv && (
            <button
              onClick={onExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-200 text-[12px] font-bold text-surface-600 hover:bg-surface-50 transition-colors cursor-pointer"
            >
              <Download size={13} /> CSV
            </button>
          )}
          {selected.length > 0 && onBulkApprove && (
            <button
              onClick={() => { onBulkApprove(selected); setSelected([]); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-[12px] font-bold hover:bg-emerald-600 transition-colors cursor-pointer"
            >
              <CheckSquare size={13} /> {selected.length} Onayla
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 border border-dashed border-surface-200 rounded-2xl">
          <AlertCircle size={20} className="text-surface-300" />
          <p className="text-[13px] font-bold text-surface-400">Kayıt bulunamadı</p>
        </div>
      ) : (
        <div className="border border-surface-200 rounded-2xl overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-surface-100 bg-surface-50">
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleAll} className="text-surface-400 hover:text-base-primary-600 transition-colors cursor-pointer">
                    {allSelected ? <CheckSquare size={16} className="text-base-primary-600" /> : <Square size={16} />}
                  </button>
                </th>
                <th className="px-4 py-3 text-[12px] font-bold text-surface-500">Öğrenci</th>
                <th className="px-4 py-3 text-[12px] font-bold text-surface-500">Grup</th>
                <th className="px-4 py-3 text-[12px] font-bold text-surface-500">Ödev</th>
                <th className="px-4 py-3 text-[12px] font-bold text-surface-500">Durum</th>
                <th className="px-4 py-3 text-[12px] font-bold text-surface-500">Tarih</th>
                <th className="px-4 py-3 text-[12px] font-bold text-surface-500">Puan</th>
                <th className="px-4 py-3 text-[12px] font-bold text-surface-500 text-right">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const isSaving = savingIds.has(row.id);
                const gradeVal = pendingGrades[row.id] ?? (row.grade != null ? String(row.grade) : "");
                return (
                  <tr key={row.id} className="border-b border-surface-50 last:border-0 hover:bg-surface-50/50 transition-colors">
                    <td className="px-4 py-3" onClick={() => toggleSelect(row.id)}>
                      <div className="cursor-pointer text-surface-300 hover:text-base-primary-600 transition-colors">
                        {selected.includes(row.id) ? <CheckSquare size={15} className="text-base-primary-600" /> : <Square size={15} />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-bold text-text-primary">{row.studentName}</td>
                    <td className="px-4 py-3 text-[12px] text-surface-600 font-medium">{row.groupCode}</td>
                    <td className="px-4 py-3 text-[12px] text-surface-600 font-medium max-w-[160px] truncate">{row.taskName}</td>
                    <td className="px-4 py-3"><SubmissionStatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-[12px] text-surface-500">{formatDate(row.submittedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <input
                          ref={el => { if (el) inputRefs.current[row.id] = el; }}
                          type="number"
                          min={0}
                          max={100}
                          value={gradeVal}
                          onChange={e => setPendingGrades(prev => ({ ...prev, [row.id]: e.target.value }))}
                          onBlur={() => handleGradeBlur(row.id)}
                          placeholder="—"
                          className="w-16 h-8 px-2 rounded-lg border border-surface-200 text-[13px] font-bold text-center
                            text-text-primary focus:border-base-primary-400 focus:outline-none focus:ring-1 focus:ring-base-primary-100
                            transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        {isSaving && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                            <div className="w-3 h-3 border-2 border-base-primary-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => router.push(`/dashboard/assignment-test/${row.groupId}/${row.taskId}/${row.id}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-surface-200 text-[11px] font-bold text-surface-600 hover:bg-surface-50 transition-colors cursor-pointer"
                      >
                        <ExternalLink size={11} /> Detay
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
