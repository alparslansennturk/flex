'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useUser } from '@/app/context/UserContext';
import { NotificationService } from '@/app/lib/services/NotificationService';
import { NotificationRealtimeService } from '@/app/lib/services/NotificationRealtimeService';
import { playNotificationSound } from '@/app/lib/notificationSound';
import type { NotificationPayload } from '@/app/lib/notifications/types';

const TYPE_ICON: Record<NotificationPayload['type'], string> = {
  message:      '💬',
  announcement: '📢',
  assignment:   '📋',
  system:       '🔔',
};

export default function NotificationToastListener() {
  const { user }    = useUser();
  const pathname    = usePathname();
  const router      = useRouter();
  const seenIds       = useRef(new Set<string>());
  const isInitialLoad = useRef(true);
  // Ref'ler: subscription closure'ı her navigasyonda yeniden kurulmadan
  // her zaman güncel pathname ve router'a erişebilsin.
  const pathnameRef = useRef(pathname);
  const routerRef   = useRef(router);

  // Ref'leri her render'da güncelle (subscription'ı kesmeden)
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  useEffect(() => { routerRef.current = router; }, [router]);

  useEffect(() => {
    if (!user?.uid) return;

    // seenIds sadece kullanıcı değişince sıfırlanır — navigasyon kesmez.
    // isInitialLoad: ilk snapshot'taki mevcut bildirimler sessizce seenIds'e eklenir,
    // toast gösterilmez. Sonraki snapshot'larda sadece YENİ olanlar toast tetikler.
    // subscribeAt/saat karşılaştırması YOK — sunucu/tarayıcı saat farkından etkilenmez.
    seenIds.current.clear();
    isInitialLoad.current = true;

    const unsub = NotificationRealtimeService.subscribe(user.uid, (notifications) => {
      // İlk snapshot (isInitialLoad=true): eski bildirimler bastırılır ama
      // son 30 saniyede oluşanlar toast gösterir (API hızlı yazarsa ilk snapshot'a düşebilir).
      // 30s penceresi sunucu/tarayıcı saat farkından etkilenmez.
      const recentCutoff = Date.now() - 30_000;
      let hasNew = false;

      for (const n of notifications) {
        if (seenIds.current.has(n.id)) continue;
        seenIds.current.add(n.id);
        if (n.isRead) continue;

        // İlk snapshot'ta sadece çok yeni bildirimler toast gösterir
        if (isInitialLoad.current) {
          const notifMs = n.createdAt?.toMillis();
          if (!notifMs || notifMs <= recentCutoff) continue;
        }

        // Sadece mesaj tipinde: zaten o sayfadaysa toast bastır (badge değişmez)
        // markAsRead çağrılmaz — badge bell'e tıklayınca kullanıcı tarafından okunur.
        if (n.type === 'message') {
          const targetPath = n.actionUrl?.split('?')[0] ?? '/';
          if (pathnameRef.current === targetPath) continue;
        }

        hasNew = true;
        const icon = TYPE_ICON[n.type] ?? '🔔';
        toast(`${icon} ${n.title}`, {
          description: n.preview,
          duration: 6000,
          ...(n.actionUrl && n.actionUrl !== '/' ? {
            action: { label: 'Git →', onClick: () => routerRef.current.push(n.actionUrl) },
          } : {}),
        });
      }

      if (hasNew) playNotificationSound();
      // Her snapshot'tan sonra false olur — ilk çağrıdan itibaren kalıcı
      isInitialLoad.current = false;
    });

    return unsub;
  }, [user?.uid]); // Sadece user.uid değişince yeniden kur — pathname/router navigasyonu kesmez

  return null;
}
