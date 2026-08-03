"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import type { User } from "firebase/auth";
import { onMessage, getToken } from "firebase/messaging";
import { getMessagingIfSupported } from "@/app/lib/firebase";
import { withTimeout } from "./format";
import {
  fetchPushSettings, setPushNotificationsEnabled, setPushSoundEnabled,
  registerPushToken, unregisterPushToken,
} from "./connectClient";

export interface PushNotificationsState {
  notifPush: boolean;
  /** SADECE platforma özel ek düzeltme effect'leri için (ör. masaüstünün
   * banner'sız "sessiz reset"i) — normal akışta kullanılmaz, `toggleNotifPush`
   * zaten `notifPush`'ı doğru yönetiyor. */
  setNotifPush: Dispatch<SetStateAction<boolean>>;
  notifPushLoading: boolean;
  notifSound: boolean;
  notifSoundLoading: boolean;
  showPushReenableBanner: boolean;
  setShowPushReenableBanner: Dispatch<SetStateAction<boolean>>;
  toggleNotifPush: () => Promise<void>;
  toggleNotifSound: () => Promise<void>;
  /** `handleLogout`'un kayıtlı FCM token'ını sunucudan silmesi için — ref'in
   * kendisi dışarı verilmiyor, sadece bu güvenli aksiyon. */
  unregisterToken: () => Promise<void>;
}

/**
 * Ayarlar / Bildirimler (2026-07-19 — gerçek push altyapısına bağlandı, bkz.
 * connect-push-service.ts). `notifPush` sunucudaki gerçek tercihi yansıtıyor
 * (mount'ta `fetchPushSettings` ile okunuyor). Bildirim SESİ (2026-07-20
 * kullanıcı isteği) bildirimin kendisinden BAĞIMSIZ, sunucudaki `soundEnabled`.
 *
 * Push yeniden-etkinleştirme banner'ı (2026-07-29) — hiçbir async abonelik
 * kontrolü YOK, sadece `localStorage`'da bu TARAYICI ÖRNEĞİNİN daha önce
 * gerçekten bir token kaydettiğine dair iz var mı bakılıyor (senkron,
 * güvenilir). Yoksa banner gösterilir; dokununca `toggleNotifPush` "aç" akışı
 * çalışır.
 *
 * `getOrRefreshPushToken`: `getToken()` çağırır; SADECE hata verirse (ör.
 * eski/uyumsuz bir VAPID key'den kalma push subscription çakışması) mevcut
 * aboneliği temizleyip tekrar dener — her çağrıda koşulsuz temizlik
 * YAPILMIYOR (2026-07-29 kullanıcı bulgusu: "her açıp kapattığımda yeni token
 * mı alacak").
 *
 * 2026-08-03: `connect/mobile/page.tsx`'ten çıkarıldı — sadece 4 parametre
 * (authUser, studentPersonId, isIOS, isStandalone) alıyor, geri kalan her şeyi
 * kendi içinde yönetiyor. Birebir taşıma, davranış değişikliği yok. Badge'i
 * `conversations`'a göre senkron tutan effect BİLEREK burada değil (o,
 * conversation-list domain'ine bağımlı, page.tsx'te kaldı).
 */
export function usePushNotifications(
  authUser: User | null | undefined,
  studentPersonId: string | null | undefined,
  isIOS: boolean,
  isStandalone: boolean,
): PushNotificationsState {
  const [notifPush, setNotifPush] = useState(false);
  const [notifPushLoading, setNotifPushLoading] = useState(false);
  const pushTokenRef = useRef<string | null>(null);
  const [notifSound, setNotifSound] = useState(false);
  const [notifSoundLoading, setNotifSoundLoading] = useState(false);

  useEffect(() => {
    if (!authUser || studentPersonId === undefined) return;
    fetchPushSettings(studentPersonId ?? undefined).then((s) => { setNotifPush(s.notificationsEnabled); setNotifSound(s.soundEnabled); });
  }, [authUser, studentPersonId]);

  const [showPushReenableBanner, setShowPushReenableBanner] = useState(false);
  useEffect(() => {
    if (!authUser || studentPersonId === undefined || !isStandalone || !notifPush) return;
    if (typeof Notification === "undefined") return;
    // ÖNEMLİ (2026-07-29 canlı ekran görüntüsüyle doğrulandı): reinstall sonrası
    // `Notification.permission` GERÇEKTEN "default"a sıfırlanıyor (önceki
    // varsayım — "izin kalıcı kalıyor" — YANLIŞTI). Bu yüzden burada
    // permission==="granted" ŞARTI ARANMIYOR — izin ne olursa olsun token
    // yoksa banner gösterilir.
    if (localStorage.getItem("flexConnectPushToken")) return; // bu cihaz zaten kayıtlı
    setNotifPush(false);
    setShowPushReenableBanner(true);
  }, [authUser, studentPersonId, isStandalone, notifPush]);

  async function toggleNotifSound() {
    if (notifSoundLoading) return;
    setNotifSoundLoading(true);
    const next = !notifSound;
    setNotifSound(next);
    const ok = await setPushSoundEnabled(next, studentPersonId ?? undefined);
    if (!ok) setNotifSound(!next);
    setNotifSoundLoading(false);
  }

  async function getOrRefreshPushToken(vapidKey: string, registration: ServiceWorkerRegistration, messaging: Awaited<ReturnType<typeof getMessagingIfSupported>>): Promise<string | null> {
    if (!messaging) return null;
    try {
      return await withTimeout(getToken(messaging, { vapidKey, serviceWorkerRegistration: registration }), 8000, "FCM token isteği");
    } catch {
      const existingSub = await registration.pushManager.getSubscription().catch(() => null);
      if (existingSub) await existingSub.unsubscribe().catch(() => {});
      return await withTimeout(getToken(messaging, { vapidKey, serviceWorkerRegistration: registration }), 8000, "FCM token isteği (temizlik sonrası)");
    }
  }

  /**
   * Bildirimlere izin ver + FCM token kaydet (2026-07-19) — WhatsApp'taki gibi
   * kullanıcı jestiyle (butona basınca) tetiklenir, sayfa açılır açılmaz
   * OTOMATİK SORULMAZ. Kapatmada token SİLİNMEZ, sadece sunucu tarafı gönderim
   * durdurulur.
   */
  async function toggleNotifPush() {
    if (notifPushLoading) return;
    if (notifPush) {
      setNotifPush(false);
      await setPushNotificationsEnabled(false, studentPersonId ?? undefined);
      return;
    }
    if (isIOS && !isStandalone) {
      toast.error("Bildirimleri açmak için önce bu uygulamayı Ana Ekrana ekle (Paylaş → Ana Ekrana Ekle), sonra oradan aç.");
      return;
    }
    setNotifPushLoading(true);
    const toastId = toast.loading("Bildirimler etkinleştiriliyor...");
    try {
      const messaging = await getMessagingIfSupported();
      if (!messaging) { toast.error("Bu tarayıcı push bildirimini desteklemiyor.", { id: toastId }); return; }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { toast.error("Bildirim izni verilmedi — tarayıcı/telefon ayarlarından açabilirsin.", { id: toastId }); return; }
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) { toast.error("Bildirim altyapısı henüz yapılandırılmadı.", { id: toastId }); return; }
      const registration = await withTimeout(navigator.serviceWorker.ready, 8000, "Servis çalışanı hazır olma");
      const token = await getOrRefreshPushToken(vapidKey, registration, messaging);
      if (!token) { toast.error("Cihaz kaydı alınamadı (token boş döndü).", { id: toastId }); return; }
      const registered = await registerPushToken(token, studentPersonId ?? undefined);
      if (!registered) { toast.error("Cihaz sunucuya kaydedilemedi — tekrar dene.", { id: toastId }); return; }
      pushTokenRef.current = token;
      localStorage.setItem("flexConnectPushToken", token);
      await setPushNotificationsEnabled(true, studentPersonId ?? undefined);
      setNotifPush(true);
      toast.success("Bildirimler açıldı.", { id: toastId });
    } catch (e) {
      console.error("[connect-mobile] push izin akışı hatası:", e);
      const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      toast.error(`Bildirimler açılamadı — ${detail}`, { id: toastId, duration: 8000 });
    } finally {
      setNotifPushLoading(false);
    }
  }

  // Uygulama açıkken (foreground) gelen push — sistem banner'ı GÖSTERİLMEZ
  // (Firestore onSnapshot zaten canlı günceller), sadece uygulama ikonu
  // badge'i senkron tutulur.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    getMessagingIfSupported().then((messaging) => {
      if (!messaging) return;
      unsub = onMessage(messaging, (payload) => {
        const badge = payload.data?.badge;
        if (badge !== undefined && "setAppBadge" in navigator) {
          (navigator as Navigator & { setAppBadge?: (n: number) => Promise<void> }).setAppBadge?.(Number(badge)).catch(() => {});
        }
      });
    });
    return () => unsub?.();
  }, []);

  async function unregisterToken() {
    if (pushTokenRef.current) {
      await unregisterPushToken(pushTokenRef.current, studentPersonId ?? undefined).catch(() => {});
    }
  }

  return {
    notifPush, setNotifPush, notifPushLoading, notifSound, notifSoundLoading,
    showPushReenableBanner, setShowPushReenableBanner,
    toggleNotifPush, toggleNotifSound, unregisterToken,
  };
}
