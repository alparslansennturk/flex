"use client";

/**
 * FlexOS · Yoklama Detay — `/flexos/yoklama/detay`.
 * Canlıdaki `/dashboard/attendance-detail` (`AttendanceDetailContent.tsx`, Sidebar+Header
 * içinde) karşılığı. DÜZELTME (2026-07-02): ilk halinde yanlışlıkla Yoklama Al'ın
 * BAĞIMSIZ sayfa deseni (FlexSidebar yok, mini topbar) kopyalanmıştı — ama canlıda
 * Yoklama Detay standalone DEĞİL, normal Sidebar+Header'lı bir sayfa (kullanıcı fark etti,
 * canlı kaynağı tekrar kontrol edildi). Artık diğer FlexOS sayfalarıyla (ör. Yoklama
 * Raporu) AYNI FlexSidebar+header deseni kullanıyor.
 */

import React, { useEffect, useState, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, BarChart2 } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import AttendanceCore from "../_shared/AttendanceCore";
import AttendanceDetailList from "../_shared/AttendanceDetailList";

const T = { type: "tween" as const, duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };

/**
 * 2026-07-13 fix — GERÇEK BUG: grup detayına girerken tarih HER ZAMAN seçili ayın
 * 1'ine sabitleniyordu (`${month}-01`) — bugün o ayın içindeyse bile takvimde
 * yanlışlıkla 1'i seçili görünüyordu (kullanıcı bulgusu: "1 Temmuz seçiliydi, günün
 * tarihi seçili olmalı"). Artık bugün seçilen ayın içindeyse GERÇEKTEN bugünün
 * tarihi kullanılıyor; başka bir ay taranıyorsa (bugün o ayda değilse) o ayın 1'ine
 * düşülüyor — `AttendanceCore` zaten "bu tarihte ders yoksa 'bugün ders yok'"
 * mesajını kendi mantığıyla gösteriyor.
 */
function detailDateFor(month: string): string {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (month === currentMonthKey) {
    return `${currentMonthKey}-${String(now.getDate()).padStart(2, "0")}`;
  }
  return `${month}-01`;
}

export default function YoklamaDetayPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailGroupId, setDetailGroupId] = useState<string | null>(null);
  const [detailDate, setDetailDate] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      await auth.authStateReady();
      const u = auth.currentUser;
      if (!u) { router.push("/login"); return; }
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return (
      <div style={S.root}>
        <FlexSidebar active="yoklama-detay" />
        <main style={{ ...S.main, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="w-7 h-7 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <FlexSidebar active="yoklama-detay" />
      <main style={S.main}>
        <FlexHeader
          roleLabel="Yönetici · Eğitmen"
          left={
            <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
              {/* Canlıdaki Header.tsx onBack deseni — sadece grup detayı açıkken görünür,
                  listeye döner (AttendanceCore'un kendi "Yoklama Al" linki DEĞİL — bu sayfaya
                  doğrudan Yoklama Detay'dan girildiyse "Yoklama Al"a dönmek anlamsız olurdu). */}
              {showDetail && (
                <button onClick={() => setShowDetail(false)} style={S.backBtn}>
                  <ArrowLeft size={18} />
                </button>
              )}
              <div style={S.headerIcon}><BarChart2 size={22} color="#fff" /></div>
              <div>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.4px", color: "#1E222B" }}>Yoklama Detay</h1>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6F7B87", fontWeight: 500 }}>Grup bazlı ders saati özeti, arama ve tekil yoklama geçmişi.</p>
              </div>
            </div>
          }
        />

        <div style={S.panelArea}>
          {/* ── Yoklama Detay — landing liste ── */}
          <motion.div animate={{ x: showDetail ? "-100%" : 0 }} transition={T}
            className="absolute inset-0 overflow-y-auto bg-white [scrollbar-gutter:stable]">
            <AttendanceDetailList
              containerClassName="w-full max-w-[1920px] mx-auto px-9 py-8 space-y-5"
              onGroupDetail={(groupId, month) => {
                setDetailGroupId(groupId);
                setDetailDate(detailDateFor(month));
                setShowDetail(true);
              }}
            />
          </motion.div>

          {/* ── Grup detayı: sağdan gelir ── */}
          <motion.div initial={false} animate={{ x: showDetail ? 0 : "100%" }} transition={T}
            className="absolute inset-0 overflow-y-auto bg-white">
            {detailGroupId && (
              <AttendanceCore
                mode="detail"
                preSelectedGroupId={detailGroupId}
                initialDate={detailDate}
                allowEdit
                enforceTimeWindow
                containerClassName="flex min-h-full w-full max-w-[1920px] mx-auto px-9"
              />
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif" },
  main: { flex: 1, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff" },
  header: { position: "sticky", top: 0, zIndex: 30, background: "#fff", borderBottom: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)", flexShrink: 0 },
  headerIcon: { width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" },
  backBtn: { width: 40, height: 40, borderRadius: 12, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8E95A3", flexShrink: 0 },
  bellBtn: { position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 },
  panelArea: { flex: 1, minHeight: 0, position: "relative", overflow: "hidden" },
};
