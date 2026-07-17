"use client";

/**
 * Öğrenci Detay — gömülebilir panel (modal DEĞİL, sayfa içi kayan panel). Admin/eğitim-op
 * bir öğrenciye tıkladığında Yoklama Detay'daki "liste → grup detayı" kayma deseniyle
 * AYNI şekilde açılır (bkz. `yoklama/detay/page.tsx` — sidebar sabit, sadece içerik kayar,
 * sol üstte geri butonu host sayfanın kendi `FlexHeader` `left` prop'unda). Bu bileşen
 * SADECE içerik — kendi sidebar/header'ı yok, host sayfa `panelArea` kayma yapısını kurar.
 *
 * `StudentDetailModal` ile aynı veri/alt bileşenleri kullanır (Genel+Eğitim, `compact=false`)
 * — Ödeme burada da yok (host bağlamı ödeme değil, sertifika/yoklama).
 */

import { Mail, Phone, MapPin } from "lucide-react";
import { useStudentDetail } from "./useStudentDetail";
import { StudentGenelBilgiler } from "./StudentGenelBilgiler";
import { StudentEgitimBilgileri } from "./StudentEgitimBilgileri";
import { FlexPageContent } from "../../_components/FlexHeader";
import { FlexPageLoader } from "../../_components/FlexSpinner";
import { initials, avatarGradient, statusMeta } from "./studentShared";

export function StudentDetailPanel({ personId, className }: { personId: string | null; className: string }) {
  const { person, trainings, poolStatus, subeler, loading } = useStudentDetail(personId);
  const fullName = person ? `${person.firstName} ${person.lastName}`.trim() : "";
  const [c1, c2] = avatarGradient(personId ?? "x");
  const status = statusMeta(poolStatus);

  return (
    <FlexPageContent className={className}>
      {!personId || (loading && !person) ? (
        <FlexPageLoader />
      ) : !person ? (
        <div className="py-20 text-center text-[13px] text-[#8E95A3]">Öğrenci bulunamadı.</div>
      ) : (
        <>
          {/* HERO */}
          <div className="bg-white border border-[#E2E5EA] rounded-[18px] p-6 shadow-[0_1px_3px_rgba(15,31,61,.05)] mb-4.5">
            <div className="flex items-center gap-5 flex-wrap">
              <div
                className="w-[68px] h-[68px] rounded-full shrink-0 flex items-center justify-center text-white text-[24px] font-extrabold"
                style={{ background: `linear-gradient(135deg,${c1},${c2})`, boxShadow: "0 10px 22px -10px rgba(15,31,61,.35)" }}
              >
                {initials(fullName)}
              </div>
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="m-0 text-[22px] font-extrabold tracking-tight text-[#1E222B]">
                    {fullName}
                    {person?.isOnlineStudent && <span className="ml-1.5 text-[14px] font-bold text-blue-500">(O)</span>}
                  </h2>
                  <span className="inline-flex items-center px-4 py-1 rounded-full text-[12.5px] font-bold" style={{ color: status.color, background: status.background }}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-4.5 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-[#414B59] font-semibold"><Phone size={14} className="text-[#8E95A3]" />{person.pii?.phone || "—"}</span>
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-[#414B59] font-semibold"><Mail size={14} className="text-[#8E95A3]" />{person.pii?.email || "—"}</span>
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-[#414B59] font-semibold"><MapPin size={14} className="text-[#8E95A3]" />{subeler.length > 0 ? `${subeler.join(", ")} Şubesi` : "Şube atanmadı"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 items-start" style={{ gridTemplateColumns: "minmax(0,340px) minmax(0,1fr)" }}>
            <div>
              <div className="text-[12px] font-extrabold text-[#414B59] uppercase tracking-wide mb-3">Genel Bilgiler</div>
              <StudentGenelBilgiler person={person} poolStatus={poolStatus} subeler={subeler} />
            </div>
            <div>
              <div className="text-[12px] font-extrabold text-[#414B59] uppercase tracking-wide mb-3">Eğitim Bilgileri</div>
              {loading && trainings.length === 0 ? <FlexPageLoader /> : <StudentEgitimBilgileri trainings={trainings} />}
            </div>
          </div>
        </>
      )}
    </FlexPageContent>
  );
}
