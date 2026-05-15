"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

function shiftMonth(d: Date, delta: number) {
  const n = new Date(d);
  n.setDate(1);
  n.setMonth(n.getMonth() + delta);
  return n;
}
function toDateKey(d: Date)  { return d.toISOString().slice(0, 10); }
function toMonthKey(d: Date) { return d.toISOString().slice(0, 7); }

// ── DayCalendarPopover ────────────────────────────────────────────────────────

interface DayCalendarProps {
  value: Date;
  onChange: (d: Date) => void;
  maxDate?: Date;
  holidayDates?: Set<string>;
  children: React.ReactNode;
}

export function DayCalendarPopover({
  value, onChange, maxDate, holidayDates = new Set(), children,
}: DayCalendarProps) {
  const [open, setOpen]           = useState(false);
  const [viewMonth, setViewMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setViewMonth(new Date(value.getFullYear(), value.getMonth(), 1));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const year  = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  // Monday-first grid
  const rawDow    = new Date(year, month, 1).getDay();
  const startOff  = rawDow === 0 ? 6 : rawDow - 1;
  const daysInMon = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startOff).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr    = toDateKey(new Date());
  const selectedStr = toDateKey(value);
  const maxStr      = maxDate ? toDateKey(maxDate) : null;
  const canNext     = !maxStr || toMonthKey(viewMonth) < toMonthKey(maxDate!);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(o => !o)}>{children}</div>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 w-[288px] bg-white rounded-2xl shadow-2xl border border-surface-100 overflow-hidden select-none">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-50">
            <button
              onClick={() => setViewMonth(m => shiftMonth(m, -1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-100 transition-colors cursor-pointer text-text-secondary"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[13px] font-bold text-text-primary capitalize">
              {viewMonth.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
            </span>
            <button
              onClick={() => setViewMonth(m => shiftMonth(m, 1))}
              disabled={!canNext}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-100 transition-colors cursor-pointer text-text-secondary disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Day-of-week labels */}
          <div className="grid grid-cols-7 px-3 pt-3">
            {["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"].map((d, i) => (
              <div key={d} className={`h-7 flex items-center justify-center text-[10px] font-bold
                ${i >= 5 ? "text-base-primary-300" : "text-text-placeholder"}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5 px-3 pb-4">
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;

              const mm      = String(month + 1).padStart(2, "0");
              const dd      = String(day).padStart(2, "0");
              const dateStr = `${year}-${mm}-${dd}`;
              const dow     = new Date(dateStr).getDay(); // 0=Sun
              const isWeekend  = dow === 0 || dow === 6;
              const isSelected = dateStr === selectedStr;
              const isToday    = dateStr === todayStr;
              const isHoliday  = holidayDates.has(dateStr);
              const isDisabled = maxStr ? dateStr > maxStr : false;

              let cls = "h-8 w-full flex items-center justify-center rounded-lg text-[12px] font-semibold transition-colors outline-none ";

              if (isDisabled) {
                cls += "opacity-20 cursor-not-allowed ";
              } else if (isSelected) {
                cls += "bg-[#10294C] text-white cursor-pointer ";
              } else if (isHoliday) {
                cls += "bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer ";
              } else if (isToday) {
                cls += "ring-2 ring-[#10294C]/30 text-[#10294C] font-bold hover:bg-base-primary-50 cursor-pointer ";
              } else if (isWeekend) {
                cls += "text-base-primary-400 hover:bg-surface-100 cursor-pointer ";
              } else {
                cls += "text-text-primary hover:bg-surface-100 cursor-pointer ";
              }

              return (
                <button
                  key={dateStr}
                  disabled={isDisabled}
                  onClick={() => { onChange(new Date(dateStr + "T12:00:00")); setOpen(false); }}
                  className={cls}
                >
                  {day}
                  {isHoliday && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          {maxStr && todayStr <= maxStr && (
            <div className="px-4 pb-3 border-t border-surface-50 pt-2 flex justify-center">
              <button
                onClick={() => { onChange(new Date(todayStr + "T12:00:00")); setOpen(false); }}
                className="text-[11px] font-bold text-base-primary-500 hover:text-base-primary-700 transition-colors cursor-pointer"
              >
                Bugüne git
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── MonthCalendarPopover ──────────────────────────────────────────────────────

const TR_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                   "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const TR_MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz",
                         "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

interface MonthCalendarProps {
  value: Date;
  onChange: (d: Date) => void;
  maxDate?: Date;
  children: React.ReactNode;
}

export function MonthCalendarPopover({ value, onChange, maxDate, children }: MonthCalendarProps) {
  const [open, setOpen]       = useState(false);
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setViewYear(value.getFullYear());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const now      = maxDate ?? new Date();
  const maxYear  = now.getFullYear();
  const maxMonth = now.getMonth();

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(o => !o)}>{children}</div>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-[232px] bg-white rounded-2xl shadow-2xl border border-surface-100 overflow-hidden select-none">

          {/* Year header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-50">
            <button
              onClick={() => setViewYear(y => y - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-100 transition-colors cursor-pointer text-text-secondary"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[14px] font-bold text-text-primary">{viewYear}</span>
            <button
              onClick={() => setViewYear(y => y + 1)}
              disabled={viewYear >= maxYear}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-100 transition-colors cursor-pointer text-text-secondary disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-1.5 p-3">
            {TR_MONTHS_SHORT.map((name, idx) => {
              const isSelected = value.getMonth() === idx && value.getFullYear() === viewYear;
              const isCurrent  = now.getMonth() === idx && now.getFullYear() === viewYear;
              const isDisabled = viewYear > maxYear || (viewYear === maxYear && idx > maxMonth);

              return (
                <button
                  key={name}
                  disabled={isDisabled}
                  title={TR_MONTHS[idx]}
                  onClick={() => {
                    onChange(new Date(viewYear, idx, 1, 12));
                    setOpen(false);
                  }}
                  className={[
                    "h-9 rounded-xl text-[12px] font-semibold transition-colors outline-none",
                    isDisabled ? "opacity-25 cursor-not-allowed" : "cursor-pointer",
                    isSelected
                      ? "bg-[#10294C] text-white"
                      : isCurrent
                        ? "ring-2 ring-[#10294C]/30 text-[#10294C] font-bold hover:bg-base-primary-50"
                        : "text-text-primary hover:bg-surface-100",
                  ].join(" ")}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
