'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useUser } from '@/app/context/UserContext';
import { NotificationRealtimeService } from '@/app/lib/services/NotificationRealtimeService';
import type { NotificationPayload } from '@/app/lib/notifications/types';

const TYPE_ICON: Record<NotificationPayload['type'], string> = {
  message:      '💬',
  announcement: '📢',
  assignment:   '📋',
  system:       '🔔',
};

export default function NotificationToastListener() {
  const { user } = useUser();
  const seenIds = useRef(new Set<string>());
  const ready   = useRef(false);

  useEffect(() => {
    if (!user?.uid) return;

    seenIds.current.clear();
    ready.current = false;

    const unsub = NotificationRealtimeService.subscribe(user.uid, (notifications) => {
      if (!ready.current) {
        // İlk yükleme: mevcut bildirimleri "görüldü" say, toast gösterme
        notifications.forEach(n => seenIds.current.add(n.id));
        ready.current = true;
        return;
      }

      for (const n of notifications) {
        if (seenIds.current.has(n.id)) continue;
        seenIds.current.add(n.id);
        if (n.isRead) continue;

        const icon = TYPE_ICON[n.type] ?? '🔔';
        toast(`${icon} ${n.title}`, {
          description: n.preview,
          duration: 6000,
        });
      }
    });

    return unsub;
  }, [user?.uid]);

  return null;
}
