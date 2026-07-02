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
import { ArrowLeft, BarChart2, Bell } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/app/lib/firebase";
import { toast } from "sonner";
import FlexSidebar from "../../_components/FlexSidebar";
import { initials, avatarStyle } from "@/app/flexos/siniflar/_shared/groupDisplay";
import AttendanceCore from "../_shared/AttendanceCore";
import AttendanceDetailList from "../_shared/AttendanceDetailList";

const T = { type: "tween" as const, duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };

export default function YoklamaDetayPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [detailGroupId, setDetailGroupId] = useState<string | null>(null);
  const [detailDate, setDetailDate] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      await auth.authStateReady();
      const u = auth.currentUser;
      if (!u) { router.push("/login"); return; }
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const data = snap.exists() ? (snap.data() as { name?: string; surname?: string }) : null;
        const full = [data?.name, data?.surname].filter(Boolean).join(" ").trim();
        setDisplayName(full || u.displayName || u.email || "");
      } catch {
        setDisplayName(u.displayName ?? u.email ?? "");
      }
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
        <header style={S.header}>
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}
            className="w-full max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px] mx-auto px-4 sm:px-6 lg:px-8 py-5"
          >
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
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <button style={S.bellBtn} onClick={() => toast.info("Bu özellik yakında.")}>
                <Bell size={17} /><span style={S.bellDot} />
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 18, borderLeft: "1px solid #E2E5EA" }}>
                <div style={{ textAlign: "right", lineHeight: 1.3 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B" }}>{displayName}</div>
                  <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500 }}>Yönetici · Eğitmen</div>
                </div>
                <div style={{ ...S.avatar, ...avatarStyle(0) }}>{initials(displayName || "?")}</div>
              </div>
            </div>
          </div>
        </header>

        <div style={S.panelArea}>
          {/* ── Yoklama Detay — landing liste ── */}
          <motion.div animate={{ x: showDetail ? "-100%" : 0 }} transition={T}
            className="absolute inset-0 overflow-y-auto bg-white [scrollbar-gutter:stable]">
            <AttendanceDetailList
              onGroupDetail={(groupId, month) => {
                setDetailGroupId(groupId);
                setDetailDate(`${month}-01`);
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
