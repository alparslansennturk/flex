"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, CheckSquare, Square, FileText, AlertCircle } from "lucide-react";
import SubmissionStatusBadge from "./SubmissionStatusBadge";
import type { Submission, SubmissionStatus } from "@/app/types/submission";

interface Row extends Submission {
  studentName: string;
}

interface Props {
  rows: Row[];
  basePath: string; // navigate to basePath/[submissionId]
  onBulkRevision?: (ids: string[]) => void;
  onBulkApprove?: (ids: string[]) => void;
  loading?: boolean;
}

type SortKey = "studentName" | "status" | "submittedAt" | "iteration";
type SortDir = "asc" | "desc";

const STATUS_FILTER_OPTIONS: { label: string; value: SubmissionStatus | "all" }[] = [
  { label: "Tümü", value: "all" },
  { label: "Teslim Edildi", value: "submitted" },
  { label: "İnceleniyor", value: "reviewing" },
  { label: "Revizyon", value: "revision" },
  { label: "Tamamlandı", value: "completed" },
];

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
}

export default function SubmissionTable({ rows, basePath, onBulkRevision, onBulkApprove, loading }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("submittedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAll = (ids: string[]) =>
    setSelected(prev => prev.length === ids.length ? [] : ids);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() =>
    rows.filter(r => statusFilter === "all" || r.status === statusFilter),
    [rows, statusFilter]
  );

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: any = a[sortKey as keyof Row];
      let vb: any = b[sortKey as keyof Row];
      if (sortKey === "submittedAt") { va = new Date(va).getTime(); vb = new Date(vb).getTime(); }
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const filteredIds = sorted.map(r => r.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selected.includes(id));

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-xl bg-surface-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status filter */}
        <div className="flex items-center gap-1 bg-surface-50 rounded-xl p-1 border border-surface-200">
          {STATUS_FILTER_OPTIONS.map(opt => (
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

        {/* Bulk actions */}
        {selected.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[12px] font-bold text-surface-500">{selected.length} seçili</span>
            {onBulkRevision && (
              <button
                onClick={() => { onBulkRevision(selected); setSelected([]); }}
                className="px-3 py-1.5 rounded-xl border border-orange-200 text-orange-600 text-[12px] font-bold hover:bg-orange-50 transition-colors cursor-pointer"
              >
                Revizyon İste
              </button>
            )}
            {onBulkApprove && (
              <button
                onClick={() => { onBulkApprove(selected); setSelected([]); }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-[12px] font-bold hover:bg-emerald-600 transition-colors cursor-pointer"
              >
                Onayla
              </button>
            )}
            <button
              onClick={() => setSelected([])}
              className="px-3 py-1.5 rounded-xl border border-surface-200 text-surface-500 text-[12px] font-bold hover:bg-surface-50 transition-colors cursor-pointer"
            >
              Temizle
            </button>
          </div>
        )}
      </div>

      {/* Tablo */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 border border-dashed border-surface-200 rounded-2xl">
          <AlertCircle size={20} className="text-surface-300" />
          <p className="text-[13px] font-bold text-surface-400">Teslim bulunamadı</p>
        </div>
      ) : (
        <div className="border border-surface-200 rounded-2xl overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-surface-100 bg-surface-50">
                <th className="px-4 py-3 w-10">
                  <button
                    onClick={() => toggleAll(filteredIds)}
                    className="text-surface-400 hover:text-base-primary-600 transition-colors cursor-pointer"
                  >
                    {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </th>
                <SortTh label="Öğrenci" sortKey="studentName" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="Durum" sortKey="status" current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 text-[12px] font-bold text-surface-500">Dosya</th>
                <SortTh label="Tarih" sortKey="submittedAt" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="İterasyon" sortKey="iteration" current={sortKey} dir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`${basePath}/${row.id}`)}
                  className="border-b border-surface-50 last:border-0 hover:bg-surface-50/70 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleSelect(row.id); }}>
                    <div className="text-surface-300 hover:text-base-primary-600 transition-colors cursor-pointer">
                      {selected.includes(row.id) ? <CheckSquare size={15} className="text-base-primary-600" /> : <Square size={15} />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[13px] font-bold text-text-primary">{row.studentName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <SubmissionStatusBadge status={row.status} />
                    {row.isLate && (
                      <span className="ml-1.5 text-[10px] font-bold text-status-danger-500">
                        {row.daysLate}g geç
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <FileText size={13} className="text-surface-400" />
                      <span className="text-[12px] text-surface-600 truncate max-w-[160px]">{row.file.fileName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-surface-500">{formatDate(row.submittedAt)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-surface-100 text-[11px] font-black text-surface-500">
                      #{row.iteration}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SortTh({ label, sortKey, current, dir, onSort }: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th className="px-4 py-3">
      <button
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 text-[12px] font-bold transition-colors cursor-pointer
          ${active ? "text-base-primary-600" : "text-surface-500 hover:text-surface-700"}`}
      >
        {label}
        <ArrowUpDown size={11} className={active ? "text-base-primary-500" : "text-surface-300"} />
      </button>
    </th>
  );
}
