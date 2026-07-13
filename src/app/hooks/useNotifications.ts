"use client";

import { useEffect, useState, useCallback } from "react";
import { onSnapshot, doc, Timestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { NotificationRealtimeService } from "@/app/lib/services/NotificationRealtimeService";
import { NotificationService } from "@/app/lib/services/NotificationService";
import type { NotificationPayload } from "@/app/lib/notifications/types";

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [lastClearedAt, setLastClearedAt] = useState<Timestamp | undefined>();
  // `lastClearedAt`, bildirimlerden AYRI bir Firestore dinleyicisinden gelir — mount
  // olunca bildirimler (1. dinleyici) `lastClearedAt` (2. dinleyici) daha yüklenmeden
  // gelebiliyordu, bu da bir an TÜM bildirimlerin (filtrelenmemiş) görünüp `lastClearedAt`
  // gelince aniden kaybolmasına sebep oluyordu (2026-07-13 bug fix — "hepsi okundu"
  // sonrası bildirim paneli açılınca fark edildi). Bu ikinci dinleyici gerçekten
  // yüklenene kadar liste boş gösterilir — flaş yerine kısa bir boşluk.
  const [clearedAtLoaded, setClearedAtLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  /* ── Real-time bildirimler ── */
  useEffect(() => {
    console.log(`[NOTIF] useNotifications mount (userId=${userId ?? 'none'})`);
    return () => console.log(`[NOTIF] useNotifications unmount (userId=${userId ?? 'none'})`);
  }, [userId]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const unsub = NotificationRealtimeService.subscribe(userId, (notifs) => {
      setNotifications(notifs);
      setLoading(false);
    }, 50, 'useNotifications');
    return unsub;
  }, [userId]);

  /* ── lastClearedAt: user doc'tan real-time ── */
  useEffect(() => {
    setClearedAtLoaded(false);
    if (!userId) return;
    const unsub = onSnapshot(doc(db, "users", userId), (snap) => {
      setLastClearedAt(snap.exists() ? (snap.data()?.lastClearedAt as Timestamp | undefined) : undefined);
      setClearedAtLoaded(true);
    }, (error) => {
      console.warn("[useNotifications] users doc listen error:", error.code);
      setClearedAtLoaded(true); // hata da olsa "yüklendi" say — sonsuza dek boş kalmasın
    });
    return unsub;
  }, [userId]);

  const visible = clearedAtLoaded ? NotificationRealtimeService.filterVisible(notifications, lastClearedAt) : [];
  const unreadCount = NotificationRealtimeService.getUnreadCount(visible);

  /* ── Optimistic markAsRead ── */
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!userId) return;
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    try {
      await NotificationService.markAsRead(userId, notificationId);
    } catch {
      // Revert: onSnapshot zaten gerçek durumu getirecek
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: false } : n)
      );
    }
  }, [userId]);

  /* ── clearAll: lastClearedAt = now (belgeler silinmez, filtrelenir) ── */
  const clearAll = useCallback(async () => {
    if (!userId) return;
    const now = Timestamp.now();
    setLastClearedAt(now); // Optimistic
    try {
      await NotificationService.clearAll(userId);
    } catch {
      setLastClearedAt(undefined); // Revert
    }
  }, [userId]);

  return { notifications: visible, unreadCount, markAsRead, clearAll, loading };
}
