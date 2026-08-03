"use client";

/**
 * FlexOS · Öğrenci Ayarları — 2026-07-24. Bildirim Sesi kartı `NotificationSoundSettings`
 * (`../../_components/NotificationSoundSettings`) üzerinden — eğitmen/admin `sistem-ayarlari`
 * sayfasının "Bildirim Ayarları" sekmesiyle AYNI bileşen (kullanıcı isteği: "standart olmalı").
 */

import { useParams } from "next/navigation";
import StudentSidebar from "../../_components/StudentSidebar";
import FlexHeader, { FlexPageContent, FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS } from "../../../_components/FlexHeader";
import NotificationSoundSettings from "../../../_components/NotificationSoundSettings";
import InstallBannerSettings from "../../../_components/InstallBannerSettings";

export default function FlexosStudentAyarlarPage() {
  const { personId } = useParams<{ personId: string }>();

  return (
    <div className="flex h-screen overflow-hidden bg-white font-inter antialiased text-text-primary">
      <StudentSidebar personId={personId} />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <FlexHeader
          title="Ayarlar"
          subtitle="Bildirim tercihlerini yönet."
          roleLabel="Öğrenci"
          maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
          connectPersonId={personId}
        />
        <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          <FlexPageContent className="pt-7 pb-12 space-y-4">
            <NotificationSoundSettings />
            <InstallBannerSettings />
          </FlexPageContent>
        </main>
      </div>
    </div>
  );
}
