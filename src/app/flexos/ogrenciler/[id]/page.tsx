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
import { ArrowLeft } from "lucide-react";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader, { FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS, FLEX_PAGE_FOOTER_CLASS } from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { useCapabilities } from "../../_components/useCapabilities";
import { FlexPageLoader } from "../../_components/FlexSpinner";
import { StudentDetailTabsPanel } from "../_shared/StudentDetailTabsPanel";

export default function OgrenciDetayPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const personId = params.id;
  const { loaded } = useCapabilities();

  if (!loaded) return <FlexPageLoader />;

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
          maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
        />

        <StudentDetailTabsPanel personId={personId} className="font-inter pt-6 pb-14" />

        <Footer mini containerClassName={FLEX_PAGE_FOOTER_CLASS} />
      </main>
    </div>
  );
}
