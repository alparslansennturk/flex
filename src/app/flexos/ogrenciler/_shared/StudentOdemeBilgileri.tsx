"use client";

/**
 * Öğrenci Detay (sadece SAYFA — modalda Ödeme tab'ı yok) — "Ödeme Bilgileri". Mevcut
 * bottom-sheet'in "Ödeme & Satış" tab'ının (havuz/page.tsx, salt-okunur) birebir portu.
 */

import { useState } from "react";
import { ChevronDown, Wallet, Lock, Banknote } from "lucide-react";
import type { PersonDetail } from "./useStudentDetail";
import { tl, fmtDate, PAY_METHOD_LABEL, PAY_STATUS_BADGE, ROLLUP_BADGE, clientRollup } from "./studentShared";

export function StudentOdemeBilgileri({ person }: { person: PersonDetail }) {
  const { sales, payments } = person;
  const [selectedSaleId, setSelectedSaleId] = useState(sales[0]?.id ?? "");

  if (sales.length === 0 && payments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 py-12 text-center">
        <div className="w-[58px] h-[58px] rounded-2xl bg-[#f1f5f9] text-[#8E95A3] flex items-center justify-center"><Wallet size={24} /></div>
        <div className="text-[14.5px] font-bold text-[#414B59]">Ödeme/satış kaydı yok</div>
        <div className="text-[13px] text-[#8E95A3] max-w-[300px]">Bu öğrenciye ait ödeme planı bulunmuyor veya görüntüleme yetkiniz yok.</div>
      </div>
    );
  }

  const sel = sales.find((s) => s.id === selectedSaleId) ?? sales[0];
  const selPayments = sel ? payments.filter((p) => p.saleId === sel.id) : [];
  const expected = (sel?.soldPrice ?? 0) + (sel?.financingFee ?? 0);
  const paid = selPayments.filter((p) => p.paidAt).reduce((a, p) => a + p.amount, 0);
  const remaining = Math.max(0, expected - paid);
  const rb = ROLLUP_BADGE[clientRollup(selPayments, expected)];
  const single = sales.length <= 1;

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-4.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-bold text-[#8E95A3] tracking-wide">Satın aldığı eğitim{single ? "" : `ler (${sales.length})`}</span>
          <div className="relative">
            <select
              value={sel?.id ?? ""}
              disabled={single}
              onChange={(e) => setSelectedSaleId(e.target.value)}
              className="appearance-none min-w-[280px] pr-10 pl-3.5 py-2.5 rounded-[11px] border border-[#E2E5EA] text-[14px] font-semibold"
              style={{ background: single ? "#EEF0F3" : "#fff", color: single ? "#6F7B87" : "#1E222B", cursor: single ? "default" : "pointer" }}
            >
              {sales.map((s) => <option key={s.id} value={s.id}>{s.educationName}{s.status === "cancelled" ? " (İptal)" : ""}</option>)}
            </select>
            <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#8E95A3]" style={{ opacity: single ? 0.4 : 1 }} />
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EEF0F3] text-[#6F7B87] text-[12px] font-semibold">
          <Lock size={13} /> Salt görüntüleme
        </div>
      </div>

      {sel && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-[#E2E5EA] bg-white mb-3.5">
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-[#1E222B] truncate">{sel.educationName}</div>
            <div className="text-[12px] text-[#8E95A3] font-medium mt-0.5">{fmtDate(sel.date)}{sel.status === "cancelled" ? " · İptal edildi" : ""}</div>
          </div>
          <div className="text-right whitespace-nowrap">
            <div className={`text-[14.5px] font-extrabold ${sel.status === "cancelled" ? "line-through" : ""}`} style={{ color: sel.status === "cancelled" ? "#B42318" : "#1E222B" }}>{tl(sel.soldPrice)}</div>
            {sel.financingFee > 0 && <div className="text-[11.5px] text-[#8A5A00] font-semibold">+{tl(sel.financingFee)} vade farkı</div>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-3.5">
        <div className="bg-[#F7F8FA] border border-[#EEF0F3] rounded-xl p-3.5"><div className="text-[11.5px] font-semibold text-[#8E95A3]">Toplam</div><div className="text-[18px] font-extrabold text-[#1E222B] mt-1">{tl(expected)}</div></div>
        <div className="bg-[#F7F8FA] border border-[#EEF0F3] rounded-xl p-3.5"><div className="text-[11.5px] font-semibold text-[#8E95A3]">Ödenen</div><div className="text-[18px] font-extrabold text-[#007A30] mt-1">{tl(paid)}</div></div>
        <div className="bg-[#F7F8FA] border border-[#EEF0F3] rounded-xl p-3.5"><div className="text-[11.5px] font-semibold text-[#8E95A3]">Kalan</div><div className="text-[18px] font-extrabold mt-1" style={{ color: remaining > 0 ? "#B42318" : "#007A30" }}>{tl(remaining)}</div></div>
      </div>

      {rb && (
        <div className="mb-5">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-bold" style={{ color: rb.color, background: rb.background }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: rb.color }} />Ödeme durumu: {rb.label}
          </span>
        </div>
      )}

      <div>
        <div className="text-[13px] font-extrabold text-[#414B59] uppercase tracking-wide mb-3">Ödeme Planı</div>
        {selPayments.length === 0 ? (
          <div className="py-4.5 px-4 rounded-xl border border-dashed border-[#E2E5EA] bg-white text-[13px] text-[#8E95A3] text-center">Bu eğitim için ödeme planı girilmemiş.</div>
        ) : (
          <div className="border border-[#E2E5EA] rounded-xl overflow-hidden bg-white">
            {selPayments.map((p, i) => {
              const b = PAY_STATUS_BADGE[p.status] ?? PAY_STATUS_BADGE.planned;
              const isInst = p.installmentNo != null;
              return (
                <div key={p.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? "border-t border-[#EEF0F3]" : ""}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-[30px] h-[30px] rounded-lg shrink-0 flex items-center justify-center bg-[#f1f5f9] text-[#6F7B87] text-[12px] font-bold">
                      {isInst ? p.installmentNo : <Banknote size={14} />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-bold text-[#1E222B]">{PAY_METHOD_LABEL[p.method] ?? p.method}{isInst ? ` · ${p.installmentNo}/${p.installmentTotal}. taksit` : ""}</div>
                      <div className="text-[11.5px] text-[#8E95A3] font-medium mt-0.5">{p.paidAt ? `Ödendi: ${fmtDate(p.paidAt)}` : p.dueDate ? `Vade: ${fmtDate(p.dueDate)}` : "—"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 whitespace-nowrap">
                    <span className="text-[14px] font-extrabold text-[#1E222B]">{tl(p.amount)}</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-bold" style={{ color: b.color, background: b.background }}>{b.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
