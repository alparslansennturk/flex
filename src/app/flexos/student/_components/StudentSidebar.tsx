"use client";

/**
 * FlexOS · Öğrenci portalı — sidebar.
 * 2026-07-13 kararı: eğitmen/admin sidebar'ıyla (`FlexSidebar.tsx`) BİREBİR aynı görsel
 * dil — aynı gradient arkaplan, aynı responsive genişlik (`fs-sidebar` CSS sınıfı),
 * aynı `Item` bileşeni/aktif-durum vurgusu. Önceki ayrı Tailwind-tabanlı stil farklı
 * yükseklik/hizalama/renklere sahipti. Kendi kendine yeterli (`fs-sidebar` genişliği
 * kendi içinde yönetir) — çağıran sayfa artık ayrı bir `<aside w-[280px]>` sarmalayıcısı
 * KULLANMAMALI (FlexSidebar'ın kullanıldığı sayfalarla aynı desen).
 */

import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/app/lib/firebase";
import FlexLogo from "@/app/components/ui/FlexLogo";
import { Item, S, IC, css } from "../../_components/FlexSidebar";

export default function StudentSidebar({ personId }: { personId: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await signOut(auth);
    document.cookie = "flex-token=; path=/; max-age=0";
    router.push("/login");
  };

  const isHome = pathname === `/flexos/student/${personId}`;
  const homeHref = `/flexos/student/${personId}`;

  return (
    <aside className="fs-sidebar" style={S.sidebar}>
      <style>{css}</style>
      <div
        onClick={() => router.push(homeHref)}
        style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 8px 52px", cursor: "pointer", width: "fit-content" }}
      >
        <FlexLogo variant="white" width={72} />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Item icon={IC.book} label="Ödevlerim" active={isHome} onClick={() => router.push(homeHref)} />
      </nav>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        <Item icon={IC.logout} label="Çıkış" onClick={handleLogout} />
      </div>
    </aside>
  );
}
