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

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexLogo from "@/app/components/ui/FlexLogo";
import { Item, S, IC, css } from "../../_components/FlexSidebar";
import { useInstallPrompt } from "../../_shared/useInstallPrompt";
import InstallAppModal from "../../_shared/InstallAppModal";

export default function StudentSidebar({ personId }: { personId: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await signOut(auth);
    document.cookie = "flex-token=; path=/; max-age=0";
    router.push("/login");
  };

  // "Uygulamayı Kur" (2026-08-01) — FlexSidebar'daki AYNI mantık, bkz. orada bıraktığım yorum.
  const { installed, canPrompt, isSafari, promptInstall, markAsInstalled, resetInstalled } = useInstallPrompt();
  const [installModalOpen, setInstallModalOpen] = useState(false);

  const isHome = pathname === `/flexos/student/${personId}`;
  const homeHref = `/flexos/student/${personId}`;
  const connectHref = `/flexos/student/${personId}/connect`;
  const isConnect = pathname === connectHref;
  const ayarlarHref = `/flexos/student/${personId}/ayarlar`;
  const isAyarlar = pathname === ayarlarHref;

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
        <Item icon={IC.chat} label="Flex Connect" active={isConnect} onClick={() => router.push(connectHref)} />
      </nav>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        <Item icon={IC.settings} label="Ayarlar" active={isAyarlar} onClick={() => router.push(ayarlarHref)} />
        {!installed && <Item icon={IC.download} label="Uygulamayı Kur" onClick={() => setInstallModalOpen(true)} />}
        {installed && isSafari && (
          <Item icon={IC.refresh} label="Kurulumu Sıfırla" onClick={() => { resetInstalled(); toast.info("Kurulum durumu sıfırlandı — \"Uygulamayı Kur\" geri geldi."); }} />
        )}
        <div style={{ margin: "4px 8px", borderTop: "1px solid rgba(255,255,255,.1)" }} />
        <Item icon={IC.logout} label="Çıkış" onClick={handleLogout} />
      </div>
      <InstallAppModal open={installModalOpen} onClose={() => setInstallModalOpen(false)} isSafari={isSafari} canPrompt={canPrompt} promptInstall={promptInstall} markAsInstalled={markAsInstalled} />
    </aside>
  );
}
