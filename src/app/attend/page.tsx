"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import AttendancePanel from "../components/dashboard/attendance/AttendancePanel";
import { onAuthStateChanged } from "firebase/auth";

export default function AttendPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login");
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        const data = userDoc.exists() ? userDoc.data() : null;
        const hasAccess = data && (
          data.role === "admin" ||
          data.role === "instructor" ||
          (data.roles && (data.roles.includes("admin") || data.roles.includes("instructor")))
        );
        if (!hasAccess) {
          router.push("/dashboard");
          return;
        }
      } catch {
        router.push("/dashboard");
        return;
      }
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

  return (
    <div className="flex h-screen w-full flex-col bg-white overflow-hidden">
      {/* Minimal üst bar */}
      <div className="h-[52px] border-b border-surface-100 flex items-center px-6 shrink-0 bg-white justify-between">
        <span
          className="text-[22px] font-semibold text-base-primary-500 leading-none"
          style={{ fontFamily: "DM Sans, var(--font-main), sans-serif" }}
        >
          flex
        </span>
        <Link
          href="/dashboard"
          className="text-[12px] font-medium text-text-placeholder hover:text-text-primary transition-colors"
        >
          Dashboard →
        </Link>
      </div>

      <main className="flex-1 min-h-0 overflow-hidden">
        <AttendancePanel mode="simple" autoSelectToday />
      </main>
    </div>
  );
}
