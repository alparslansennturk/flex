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

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/app/lib/firebase";
import FlexLogo from "@/app/components/ui/FlexLogo";
import { Item, S, IC, css } from "../../_components/FlexSidebar";
import { useInstallPrompt } from "../../_shared/useInstallPrompt";
import InstallAppModal from "../../_shared/InstallAppModal";
import SafariInstallBanner from "../../_shared/SafariInstallBanner";
import { authHeaders } from "@/app/lib/client/auth-headers";

export default function StudentSidebar({ personId }: { personId: string }) {
  const router = useRouter();
  const pathname = usePathname();

  // Anketlerim bildirimi (2026-08-07) — bekleyen (cevaplanmamış + süresi dolmamış)
  // anket varsa "•" pulse + hover tooltip. Cevaplanınca/süre dolunca sunucu artık bu
  // dispatch'i "answered"/expired döndürür, bir sonraki sidebar mount'unda otomatik söner
  // (ayrı bir "okundu" state'i YOK — kaynak zaten `answered` + `dueAt`).
  const [hasPendingSurvey, setHasPendingSurvey] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/flexos/student/surveys?personId=${personId}`, { headers, cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json() as { items: { dispatch: { dueAt: string }; answered: boolean }[] };
        // `!(dueAt < now)` — bkz. `student/[personId]/page.tsx`'teki AYNI fail-open
        // düzeltmesi (eski dueAt'siz dispatch'ler "süresi dolmuş" sayılmasın).
        const pending = data.items.some((it) => !it.answered && !(new Date(it.dispatch.dueAt) < new Date()));
        if (!cancelled) setHasPendingSurvey(pending);
      } catch {
        // sessiz — sidebar bildirimi kritik değil, sayfa yine çalışır
      }
    })();
    return () => { cancelled = true; };
  }, [personId, pathname]);

  const handleLogout = async () => {
    await signOut(auth);
    document.cookie = "flex-token=; path=/; max-age=0";
    router.push("/login");
  };

  // "Uygulamayı Kur" (2026-08-01) — FlexSidebar'daki AYNI mantık, bkz. orada bıraktığım yorum.
  const { installed, canPrompt, isSafari, promptInstall, markAsInstalled, bannerDismissed, dismissBanner } = useInstallPrompt();
  const [installModalOpen, setInstallModalOpen] = useState(false);

  const isHome = pathname === `/flexos/student/${personId}`;
  const homeHref = `/flexos/student/${personId}`;
  const anketlerHref = `/flexos/student/${personId}/anketler`;
  const isAnketler = pathname?.startsWith(anketlerHref) ?? false;
  const connectHref = `/flexos/student/${personId}/connect`;
  const isConnect = pathname === connectHref;
  const ayarlarHref = `/flexos/student/${personId}/ayarlar`;
  const isAyarlar = pathname === ayarlarHref;

  return (
    <aside className="fs-sidebar" style={S.sidebar}>
      <style>{css}</style>
      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }}
        onClick={() => router.push(homeHref)}
        style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 8px 52px", cursor: "pointer", width: "fit-content" }}
      >
        <FlexLogo variant="white" width={72} />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Item icon={IC.book} label="Ödevlerim" active={isHome} onClick={() => router.push(homeHref)} />
        <Item icon={IC.barChart} label="Anketlerim" active={isAnketler} onClick={() => router.push(anketlerHref)} pulse={hasPendingSurvey} tooltip={hasPendingSurvey ? "Yeni anketiniz var" : undefined} />
        <Item icon={IC.chat} label="Flex Connect" active={isConnect} onClick={() => router.push(connectHref)} />
      </nav>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        <Item icon={IC.settings} label="Ayarlar" active={isAyarlar} onClick={() => router.push(ayarlarHref)} />
        {!installed && !isSafari && <Item icon={IC.download} label="Uygulamayı Kur" onClick={() => setInstallModalOpen(true)} />}
        <div style={{ margin: "4px 8px", borderTop: "1px solid rgba(255,255,255,.1)" }} />
        <Item icon={IC.logout} label="Çıkış" onClick={handleLogout} />
      </div>
      <InstallAppModal open={installModalOpen} onClose={() => setInstallModalOpen(false)} canPrompt={canPrompt} promptInstall={promptInstall} markAsInstalled={markAsInstalled} />
      <SafariInstallBanner isSafari={isSafari} installed={installed} bannerDismissed={bannerDismissed} dismissBanner={dismissBanner} />
    </aside>
  );
}
