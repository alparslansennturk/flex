'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useUser } from '@/app/context/UserContext';
import { NotificationService } from '@/app/lib/services/NotificationService';
import { NotificationRealtimeService } from '@/app/lib/services/NotificationRealtimeService';
import type { NotificationPayload } from '@/app/lib/notifications/types';

const TYPE_ICON: Record<NotificationPayload['type'], string> = {
  message:      '💬',
  announcement: '📢',
  assignment:   '📋',
  system:       '🔔',
};

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Ses API desteklenmiyorsa sessiz devam et
  }
}

export default function NotificationToastListener() {
  const { user }   = useUser();
  const pathname   = usePathname();
  const router     = useRouter();
  const seenIds    = useRef(new Set<string>());
  const subscribeAt = useRef(0);

  useEffect(() => {
    if (!user?.uid) return;

    seenIds.current.clear();
    subscribeAt.current = Date.now();

    const unsub = NotificationRealtimeService.subscribe(user.uid, (notifications) => {
      let hasNew = false;

      for (const n of notifications) {
        if (seenIds.current.has(n.id)) continue;
        seenIds.current.add(n.id);
        if (n.isRead) continue;

        // Abonelik başlamadan 3 saniyeden önce yazılmış bildirimleri geç
        const notifMs = n.createdAt?.toMillis();
        if (notifMs !== undefined && notifMs < subscribeAt.current - 3000) continue;

        // Sadece mesaj tipinde: zaten o sayfadaysa sessizce okundu say (badge + toast yok)
        if (n.type === 'message') {
          const targetPath = n.actionUrl?.split('?')[0] ?? '/';
          if (pathname === targetPath) {
            NotificationService.markAsRead(user.uid, n.id).catch(() => {});
            continue;
          }
        }

        hasNew = true;
        const icon = TYPE_ICON[n.type] ?? '🔔';
        toast(`${icon} ${n.title}`, {
          description: n.preview,
          duration: 6000,
          ...(n.actionUrl && n.actionUrl !== '/' ? {
            action: { label: 'Git →', onClick: () => router.push(n.actionUrl) },
          } : {}),
        });
      }

      if (hasNew) playNotificationSound();
    });

    return unsub;
  }, [user?.uid, pathname, router]);

  return null;
}
