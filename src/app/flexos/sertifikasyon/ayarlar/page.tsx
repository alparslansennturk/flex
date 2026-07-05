"use client";

/**
 * FlexOS · Sertifika Ayarları — Claude Design çıktısından (`Sertifika Ayarları.dc.html`)
 * BİREBİR UI portu. "Ödev notu sertifika hesabına dahil edilsin mi" toggle'ı + (açıksa)
 * Sertifika/Ödev ağırlık slider'ları (bağlı, toplam hep %100) + hızlı ön ayarlar + örnek
 * hesaplama kartı. Kapalıysa dashed bilgi kutusu.
 *
 * Kullanıcı notu (Sertifika Notu sayfasından): bu ayar oraya OTOMATİK yansıyacak — açık/
 * kapalı değeri burada değişince Sertifika Notu'ndaki "Ödev Notu" sütunu görünür/gizlenecek.
 * Backend henüz YOK (Grade domain'i kurulmadı) — "Ayarları Kaydet" şimdilik "yakında" toast'ı,
 * ayarlar sayfa yenilenince sıfırlanır. Sertifika Notu/Ödev Notu sayfalarıyla AYNI desen.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Award, Check, AlertCircle, BarChart3 } from "lucide-react";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";

const PRESETS = [
  { label: "Sertifika %100", pct: 100 },
  { label: "%70 / %30", pct: 70 },
  { label: "%60 / %40", pct: 60 },
  { label: "%50 / %50", pct: 50 },
];

export default function SertifikaAyarlariPage() {
  const [odevAktif, setOdevAktif] = useState(true);
  const [sertifikaPct, setSertifikaPct] = useState(70);
  const odevPct = 100 - sertifikaPct;

  const ornSertifika = Math.round((80 * sertifikaPct) / 100);
  const ornOdev = Math.round((90 * odevPct) / 100);
  const ornToplam = ornSertifika + ornOdev;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#EEF0F3" }}>
      <FlexSidebar active="sertifika-ayarlari" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<Award size={20} color="#fff" />}
          title="Sertifika Ayarları"
          subtitle="Sertifika notu nasıl hesaplanacağını belirleyin."
          roleLabel="Yönetici"
        />

        <div style={{ padding: "26px 30px 48px", maxWidth: 1240, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }} className="font-inter flex flex-col gap-5">

          {/* 1. Ödev notu kullanımı */}
          <div className="bg-white border border-[#E2E5EA] rounded-[20px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)] overflow-hidden">
            <div className="flex items-center justify-between gap-5 py-[22px] px-[26px]">
              <div className="flex items-start gap-[15px] min-w-0">
                <div className="w-[46px] h-[46px] rounded-[13px] shrink-0 bg-[#DDE8F8] text-[#205297] flex items-center justify-center">
                  <BarChart3 size={22} />
                </div>
                <div className="min-w-0">
                  <div className="text-[16px] font-extrabold text-[#1E222B] tracking-tight">Ödev notu sertifika hesabında kullanılsın</div>
                  <div className="text-[12.5px] text-[#8E95A3] font-medium mt-[3px] leading-relaxed max-w-[560px]">
                    Açık olduğunda sertifika notu, sertifika sınavı ve ödev notunun ağırlıklı ortalamasıyla hesaplanır. Kapalıysa yalnızca sertifika sınav notu esas alınır.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOdevAktif((v) => !v)}
                className="relative rounded-full cursor-pointer border-none p-0 shrink-0 transition-colors"
                style={{ width: 50, height: 28, background: odevAktif ? "#1F9D57" : "#CDD2DA" }}
              >
                <span className="absolute rounded-full bg-white shadow transition-all" style={{ top: 3, left: odevAktif ? 25 : 3, width: 22, height: 22 }} />
              </button>
            </div>
            <div className="flex items-center gap-[9px] py-[13px] px-[26px] border-t border-[#EEF0F3]" style={{ background: odevAktif ? "#F0FAF4" : "#F7F8FA" }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: odevAktif ? "#1F9D57" : "#AEB4C0" }} />
              <span className="text-[12.5px] font-bold" style={{ color: odevAktif ? "#0E7A3E" : "#8E95A3" }}>
                {odevAktif ? "Ödev notu hesaba dahil ediliyor" : "Ödev notu hesaba dahil değil — sertifika notu %100 sınavdan"}
              </span>
            </div>
          </div>

          {odevAktif && (
            <>
              {/* 2. Ağırlık ayarı */}
              <div className="bg-white border border-[#E2E5EA] rounded-[20px] p-[26px] shadow-[0_4px_20px_-14px_rgba(15,31,61,0.22)]">
                <div className="flex items-center gap-[11px] mb-1.5">
                  <div className="w-[38px] h-[38px] rounded-[11px] shrink-0 bg-[#EDE4FB] text-[#6B29A8] flex items-center justify-center">
                    <BarChart3 size={19} />
                  </div>
                  <div>
                    <div className="text-[16px] font-extrabold text-[#1E222B] tracking-tight">Not Ağırlıkları</div>
                    <div className="text-[12px] text-[#8E95A3] font-medium mt-0.5">Sertifika ve ödev notunun toplam içindeki payını belirleyin</div>
                  </div>
                </div>

                {/* oran görsel bar */}
                <div className="flex rounded-[14px] overflow-hidden border border-[#EEF0F3]" style={{ height: 52, margin: "22px 0 8px" }}>
                  <div className="flex items-center justify-center text-white whitespace-nowrap transition-all" style={{ width: `${sertifikaPct}%`, background: "linear-gradient(135deg,#3A7BD5,#205297)" }}>
                    {sertifikaPct >= 12 && <span className="text-[13px] font-extrabold">Sertifika %{sertifikaPct}</span>}
                  </div>
                  <div className="flex items-center justify-center text-white whitespace-nowrap transition-all" style={{ width: `${odevPct}%`, background: "linear-gradient(135deg,#FF8D28,#D66500)" }}>
                    {odevPct >= 12 && <span className="text-[13px] font-extrabold">Ödev %{odevPct}</span>}
                  </div>
                </div>

                {/* sertifika slider */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-[9px]">
                      <span className="w-3 h-3 rounded-[4px]" style={{ background: "#205297" }} />
                      <span className="text-[13.5px] font-bold text-[#1E222B]">Sertifika Sınav Notu</span>
                    </div>
                    <span className="inline-flex items-baseline gap-0.5 py-1 px-3 rounded-full bg-[#DDE8F8]">
                      <span className="text-[16px] font-extrabold text-[#205297] tracking-tight">%{sertifikaPct}</span>
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={100} step={5}
                    value={sertifikaPct}
                    onChange={(e) => setSertifikaPct(Number(e.target.value))}
                    className="wSlider w-full"
                    style={{ background: `linear-gradient(90deg,#205297 0%,#205297 ${sertifikaPct}%,#E2E5EA ${sertifikaPct}%,#E2E5EA 100%)` }}
                  />
                </div>

                {/* ödev slider */}
                <div className="mt-[26px]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-[9px]">
                      <span className="w-3 h-3 rounded-[4px]" style={{ background: "#FF8D28" }} />
                      <span className="text-[13.5px] font-bold text-[#1E222B]">Ödev Notu</span>
                    </div>
                    <span className="inline-flex items-baseline gap-0.5 py-1 px-3 rounded-full bg-[#FFEAD7]">
                      <span className="text-[16px] font-extrabold text-[#C2410C] tracking-tight">%{odevPct}</span>
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={100} step={5}
                    value={odevPct}
                    onChange={(e) => setSertifikaPct(100 - Number(e.target.value))}
                    className="wSlider w-full"
                    style={{ background: `linear-gradient(90deg,#FF8D28 0%,#FF8D28 ${odevPct}%,#E2E5EA ${odevPct}%,#E2E5EA 100%)` }}
                  />
                </div>

                {/* toplam uyarı (slider'lar bağlı olduğu için hep geçerli) */}
                <div className="inline-flex items-center gap-2 mt-[22px] py-2.5 px-[15px] rounded-[11px]" style={{ background: "#F0FAF4", border: "1px solid #BFE6CF" }}>
                  <Check size={17} color="#0E7A3E" strokeWidth={2.4} />
                  <span className="text-[12.5px] font-bold text-[#0E7A3E]">Toplam ağırlık: %{sertifikaPct + odevPct} — geçerli</span>
                </div>

                {/* hızlı ön ayarlar */}
                <div className="mt-[22px] pt-5 border-t border-[#EEF0F3]">
                  <div className="text-[12px] font-bold text-[#8E95A3] mb-[11px]">Hızlı Ayar</div>
                  <div className="flex gap-2.5 flex-wrap">
                    {PRESETS.map((p) => {
                      const active = p.pct === sertifikaPct;
                      return (
                        <button
                          key={p.label}
                          onClick={() => setSertifikaPct(p.pct)}
                          className="py-[9px] px-[15px] rounded-[10px] text-[12.5px] font-bold cursor-pointer transition-all"
                          style={{ border: `1px solid ${active ? "#205297" : "#E2E5EA"}`, background: active ? "#EFF5FE" : "#fff", color: active ? "#205297" : "#6F7B87" }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* örnek hesaplama */}
              <div className="rounded-[20px] py-6 px-[26px]" style={{ background: "linear-gradient(135deg,#0f1f3d,#102a4e)", boxShadow: "0 12px 28px -16px rgba(15,31,61,.5)" }}>
                <div className="text-[12px] font-bold text-[#9fb2cd] tracking-wide mb-4">ÖRNEK HESAPLAMA</div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex flex-col gap-[3px]">
                    <span className="text-[11.5px] text-[#9fb2cd] font-semibold">Sertifika: 80 × %{sertifikaPct}</span>
                    <span className="text-[22px] font-extrabold text-white tracking-tight">{ornSertifika}</span>
                  </div>
                  <span className="text-[22px] font-bold text-[#5b7aa8]">+</span>
                  <div className="flex flex-col gap-[3px]">
                    <span className="text-[11.5px] text-[#9fb2cd] font-semibold">Ödev: 90 × %{odevPct}</span>
                    <span className="text-[22px] font-extrabold text-white tracking-tight">{ornOdev}</span>
                  </div>
                  <span className="text-[22px] font-bold text-[#5b7aa8]">=</span>
                  <div className="flex flex-col gap-[3px]">
                    <span className="text-[11.5px] text-[#FBBF77] font-semibold">Sertifika Notu</span>
                    <span className="text-[28px] font-extrabold text-[#FBBF77] tracking-tight">{ornToplam}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {!odevAktif && (
            <div className="bg-white rounded-[20px] py-7 px-[26px] flex items-center gap-[15px]" style={{ border: "1px dashed #D3D8E0" }}>
              <div className="w-[46px] h-[46px] rounded-[13px] shrink-0 bg-[#F2F4F7] text-[#8E95A3] flex items-center justify-center">
                <AlertCircle size={22} />
              </div>
              <div>
                <div className="text-[14.5px] font-extrabold text-[#1E222B]">Sertifika notu yalnızca sınav notundan hesaplanıyor</div>
                <div className="text-[12.5px] text-[#8E95A3] font-medium mt-[3px]">Ödev ağırlığı devre dışı — sertifika notu doğrudan sertifika sınav notuna eşittir (%100).</div>
              </div>
            </div>
          )}

          {/* kaydet barı */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              onClick={() => { setOdevAktif(true); setSertifikaPct(70); toast.success("Varsayılana dönüldü."); }}
              className="py-3 px-5 rounded-xl border border-[#E2E5EA] bg-white text-[#414B59] text-[13.5px] font-bold cursor-pointer hover:bg-[#F7F8FA] transition-colors"
            >
              Varsayılana Dön
            </button>
            <button
              onClick={() => toast.info("Bu özellik yakında.")}
              className="inline-flex items-center gap-2 py-3 px-6 rounded-xl border-none text-white text-[13.5px] font-extrabold cursor-pointer transition-transform hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg,#1F9D57,#0E7A3E)", boxShadow: "0 10px 20px -8px rgba(14,122,62,.5)" }}
            >
              <Check size={17} strokeWidth={2.3} />
              Ayarları Kaydet
            </button>
          </div>
        </div>

        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>

      <style jsx global>{`
        input[type="range"].wSlider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 8px;
          border-radius: 999px;
          outline: none;
          cursor: pointer;
        }
        input[type="range"].wSlider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #fff;
          border: 3px solid #205297;
          box-shadow: 0 2px 6px rgba(15, 31, 61, 0.25);
          cursor: pointer;
        }
        input[type="range"].wSlider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #fff;
          border: 3px solid #205297;
          box-shadow: 0 2px 6px rgba(15, 31, 61, 0.25);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
