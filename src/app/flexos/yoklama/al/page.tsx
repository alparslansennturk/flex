"use client";

/**
 * FlexOS · Yoklama Al — `/flexos/yoklama/al`.
 *
 * BİLEREK bağımsız sayfa (FlexSidebar YOK) — canlıdaki `/attend` deseniyle aynı:
 * kendi başlık çubuğu, sidebar menüden YENİ SEKMEDE açılır (2026-07-02 kullanıcı
 * kararı — "geri çıkıp bir şeye bakmak zorunda kalmasam" — ders başladıktan sonra
 * yanlışlıkla başka sayfaya geçip yoklamayı yarım bırakmasın).
 *
 * İki panel (Yoklama Al ↔ Yoklama Detay) aynı sayfada, canlıdaki gibi framer-motion
 * ile yatay slide (`showDetail` state'i — route değişimi DEĞİL, aynı sayfa içi geçiş).
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/app/lib/firebase";
import FlexLogo from "@/app/components/ui/FlexLogo";
import { initials, avatarStyle } from "@/app/flexos/siniflar/_shared/groupDisplay";
import AttendanceCore from "../_shared/AttendanceCore";

const T = { type: "tween" as const, duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };
const PANEL_SHADOW = { boxShadow: "-8px 0 24px rgba(0,0,0,0.08)" };

export default function YoklamaAlPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [detailGroupId, setDetailGroupId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await auth.authStateReady();
      const u = auth.currentUser;
      if (!u) { router.push("/login"); return; }
      // İsim canlı ile aynı kaynaktan (users/{uid}.name+surname) — Auth displayName
      // genelde boş (hiç set edilmemiş), o yüzden email'e düşerdi. Kullanıcılar/
      // Eğitmenler modülüyle ilgisi yok, eski kayıt zaten var.
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
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="w-7 h-7 border-2 border-surface-200 border-t-base-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  const topBar = () => (
    <div className="h-[64px] shrink-0 border-b border-surface-100 bg-white">
      <div className="w-full max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px] mx-auto h-full flex pl-4 sm:pl-6 lg:pl-8">
        <div className="w-[260px] shrink-0 flex items-center px-6 bg-neutral-50 border-r border-surface-100">
          <Link href="/flexos/anasayfa" className="select-none">
            <FlexLogo variant="dark" />
          </Link>
        </div>
        <div className="flex-1 min-w-0 flex items-center justify-end px-8">
          <div className="flex items-center gap-3">
            {displayName && <span className="text-[13px] font-semibold text-text-secondary">{displayName}</span>}
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0" style={avatarStyle(0)}>
              {initials(displayName || "?")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative w-full h-screen overflow-hidden bg-neutral-50">

      {/* ── Yoklama Al ───────────────────────────────────────────────────── */}
      <motion.div animate={{ x: showDetail ? "-100%" : 0 }} transition={T} style={PANEL_SHADOW}
        className="absolute inset-0 flex flex-col bg-white">
        {topBar()}
        <main className="flex-1 overflow-y-auto">
          <AttendanceCore
            mode="simple"
            autoSelectToday
            allowEdit
            enforceTimeWindow
            onViewDetail={(gid) => { setDetailGroupId(gid); setShowDetail(true); }}
          />
        </main>
      </motion.div>

      {/* ── Yoklama Detay: sağdan gelir ──────────────────────────────────── */}
      <motion.div initial={false} animate={{ x: showDetail ? 0 : "100%" }} transition={T} style={PANEL_SHADOW}
        className="absolute inset-0 flex flex-col bg-white">
        {topBar()}
        <main className="flex-1 overflow-y-auto">
          {detailGroupId && (
            <AttendanceCore
              mode="detail"
              preSelectedGroupId={detailGroupId}
              allowEdit
              enforceTimeWindow
              onBackToAttend={() => setShowDetail(false)}
            />
          )}
        </main>
      </motion.div>

    </div>
  );
}
