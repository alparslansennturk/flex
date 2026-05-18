"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ArrowLeft } from "lucide-react";
import AttendancePanel from "../components/dashboard/attendance/AttendancePanel";
import { useUser } from "../context/UserContext";

export default function AttendPage() {
  const router = useRouter();
  const { user } = useUser();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) { router.push("/login"); return; }
      try {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        const data = userDoc.exists() ? userDoc.data() : null;
        const hasAccess = data && (
          data.role === "admin" || data.role === "instructor" ||
          (data.roles && (data.roles.includes("admin") || data.roles.includes("instructor")))
        );
        if (!hasAccess) { router.push("/dashboard"); return; }
      } catch { router.push("/dashboard"); return; }
      setReady(true);
    });
    return () => unsub();
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="w-7 h-7 border-2 border-surface-200 border-t-base-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  const avatarUrl = `/avatars/${user?.gender ?? "male"}/${user?.avatarId ?? 1}.svg`;
  const fullName = [user?.name, user?.surname].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col h-screen w-full bg-white overflow-hidden">

      {/* ── Mini top bar ─────────────────────────────────────────────────── */}
      <div className="h-[52px] shrink-0 flex border-b border-surface-100">

        {/* Sol bölüm — sol panel ile hizalı (260px, nötr gri) */}
        <div className="w-[260px] shrink-0 flex items-center gap-8 px-4 bg-neutral-50 border-r border-surface-100">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-8 h-8 rounded-lg hover:bg-surface-200 flex items-center justify-center text-surface-400 transition-colors cursor-pointer active:scale-95 shrink-0"
          >
            <ArrowLeft size={16} />
          </button>
          <Link href="/dashboard" className="flex items-center select-none">
            <span className="text-[15px] font-semibold text-[#FF8D28]">tasarım</span>
            <span className="text-[15px] font-bold text-base-primary-900">atölyesi</span>
          </Link>
        </div>

        {/* Sağ bölüm — sağ panel ile hizalı */}
        <div className="flex-1 flex items-center justify-end px-8 bg-white">
          <div className="flex items-center gap-2.5">
            {fullName && (
              <span className="text-[12px] font-semibold text-text-secondary">
                {fullName}
              </span>
            )}
            <img
              src={avatarUrl}
              alt=""
              className="w-8 h-8 rounded-full bg-surface-100 object-cover shrink-0"
            />
          </div>
        </div>

      </div>

      {/* ── Panel ────────────────────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <AttendancePanel mode="simple" autoSelectToday />
      </main>

    </div>
  );
}
