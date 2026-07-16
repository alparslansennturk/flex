"use client";

/**
 * FlexOS · Öğrenci Detay — tam sayfa. Claude Design çıktısından (`Öğrenci Bilgi.dc.html`)
 * BİREBİR UI portu. Eski bottom-sheet'in (havuz/page.tsx) yerini alıyor (2026-07-16) —
 * Öğrenci Havuzu VE Sınıflar roster'ından (admin/op için) buraya yönlendirilir; eğitmen
 * Sınıflar'dan tıklarsa bunun yerine `StudentDetailModal` açılır (bkz. `_shared`).
 *
 * Sadece GÖRÜNTÜLEME (2026-07-16 kullanıcı kararı) — eski sheet'teki kişi düzenleme
 * formu bu turda taşınmadı, ayrı bir işte ele alınacak.
 */

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin } from "lucide-react";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader, { FlexPageContent, FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS, FLEX_PAGE_FOOTER_CLASS } from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { FlexPageLoader } from "../../_components/FlexSpinner";
import { useCapabilities } from "../../_components/useCapabilities";
import { useState } from "react";
import { useStudentDetail } from "../_shared/useStudentDetail";
import { StudentGenelBilgiler } from "../_shared/StudentGenelBilgiler";
import { StudentEgitimBilgileri } from "../_shared/StudentEgitimBilgileri";
import { StudentOdemeBilgileri } from "../_shared/StudentOdemeBilgileri";
import { initials, avatarGradient, statusMeta } from "../_shared/studentShared";

type Tab = "genel" | "odeme" | "egitim";

export default function OgrenciDetayPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const personId = params.id;
  const { caps, loaded } = useCapabilities();
  const [tab, setTab] = useState<Tab>("genel");
  const { person, trainings, poolStatus, subeler, loading } = useStudentDetail(personId);

  if (!loaded) return <FlexPageLoader />;
  const canReadPayment = caps.has("payment.read");

  const fullName = person ? `${person.firstName} ${person.lastName}`.trim() : "";
  const [c1, c2] = avatarGradient(personId ?? "x");
  const status = statusMeta(poolStatus);

  const tabs: { key: Tab; label: string }[] = [
    { key: "genel", label: "Genel Bilgiler" },
    { key: "egitim", label: "Eğitim Bilgileri" },
    ...(canReadPayment ? [{ key: "odeme" as const, label: "Ödeme Bilgileri" }] : []),
  ];

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#EEF0F3" }}>
      <FlexSidebar active="ogrenci-havuzu" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          left={
            <div className="flex items-center gap-[15px]">
              <button
                onClick={() => router.back()}
                className="w-[46px] h-[46px] rounded-[13px] flex items-center justify-center cursor-pointer shrink-0"
                style={{ background: "linear-gradient(135deg,#2867bd,#205297)", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}
              >
                <ArrowLeft size={21} color="#fff" />
              </button>
              <div>
                <h1 className="m-0 text-[18px] font-extrabold tracking-tight text-[#1E222B]">Öğrenci Bilgisi</h1>
                <p className="m-0 mt-0.5 text-[12px] text-[#6F7B87] font-medium">Öğrenci Havuzu / Profil</p>
              </div>
            </div>
          }
          roleLabel="Yönetici · Eğitmen"
          maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
        />

        <FlexPageContent className="font-inter pt-6 pb-14">
          {loading && !person ? (
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
                      <h2 className="m-0 text-[22px] font-extrabold tracking-tight text-[#1E222B]">{fullName}</h2>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12.5px] font-bold" style={{ color: status.color, background: status.background }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />{status.label}
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

              {/* TABS */}
              <div className="flex items-center gap-1 border-b border-[#E2E5EA] mb-5.5">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className="px-4.5 py-3 border-none bg-transparent text-[14.5px] font-semibold cursor-pointer -mb-px"
                    style={{
                      fontWeight: tab === t.key ? 800 : 600,
                      color: tab === t.key ? "#205297" : "#8E95A3",
                      borderBottom: tab === t.key ? "2.5px solid #205297" : "2.5px solid transparent",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === "genel" && <StudentGenelBilgiler person={person} poolStatus={poolStatus} subeler={subeler} />}
              {tab === "odeme" && canReadPayment && (
                <div className="bg-white border border-[#E2E5EA] rounded-[18px] p-6 shadow-[0_1px_3px_rgba(15,31,61,.05)]">
                  <StudentOdemeBilgileri person={person} />
                </div>
              )}
              {tab === "egitim" && (
                loading ? <FlexPageLoader /> : <StudentEgitimBilgileri trainings={trainings} />
              )}
            </>
          )}
        </FlexPageContent>

        <Footer mini containerClassName={FLEX_PAGE_FOOTER_CLASS} />
      </main>
    </div>
  );
}
