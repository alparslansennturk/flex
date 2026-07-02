"use client";

/**
 * FlexOS · Ana Sayfa (Admin/Full) — GEÇİCİ placeholder.
 * Amaç: Görünüm Anahtarı (Cmd+Alt+Shift+M) Full'a dönünce güvenli, capability-nötr
 * bir sayfaya inilsin (herhangi bir admin-only veri çekmez, asla 403 vermez).
 * İçerik ileride gerçek dashboard ile değiştirilecek.
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import { FlexPageLoader } from "../_components/FlexSpinner";

export default function AnaSayfaPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
    })();
  }, [router]);

  if (authed === null) return <FlexPageLoader />;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#1E222B", fontFamily: "'Inter', system-ui, sans-serif", background: "#EEF0F3" }}>
      <FlexSidebar />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#8E95A3" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1E222B", marginBottom: 6 }}>Ana Sayfa</div>
          <div style={{ fontSize: 14 }}>Dashboard yakında burada olacak.</div>
        </div>
      </main>
    </div>
  );
}
