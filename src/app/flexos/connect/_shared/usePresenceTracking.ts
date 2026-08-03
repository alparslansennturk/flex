"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { auth } from "@/app/lib/firebase";
import { subscribeToPresence, type PresenceSignal, type PresenceStatus } from "./connectClient";
import { usePresenceHeartbeat } from "./usePresenceHeartbeat";

export interface PresenceTracking {
  presenceMap: Map<string, PresenceSignal>;
  myPresenceStatus: PresenceStatus;
  setMyPresenceStatusLocal: Dispatch<SetStateAction<PresenceStatus>>;
}

/**
 * Presence (2026-07-20) — SADECE personel durum taşır/ayarlar; öğrenciler
 * sadece görür (kendi eğitmenlerinin rozeti). `uids` DIŞARIDA hesaplanır
 * (hangi kişilere abone olunacağı tab/dizin/konuşma listesine bağlı, o mantık
 * conversation-list domain'ine ait) — bu hook sadece hazır `uids` listesini alıp
 * aboneliği + kendi durumumu yönetir.
 *
 * `isPresenceOffline()` `Date.now()`'a göre TÜRETİLİYOR (bkz. connect-presence.ts)
 * — ama karşı taraf uygulamayı kapatıp heartbeat göndermeyi kesince Firestore'da
 * HİÇBİR yeni yazı olmuyor, `presenceMap` snapshot'ı hiç değişmiyor, dolayısıyla
 * çağıran component yeniden render OLMUYOR ve nokta kalıcı olarak "çevrimiçi"
 * (yeşil) görünmeye devam ediyordu (2026-07-29 kullanıcı bulgusu). TTL'den
 * (45sn) daha sık bir "tick" ile zorla yeniden render tetikleyip zaman aşımını
 * yakalıyoruz — bu `useState` hook İÇİNDE olsa da, setState çağıran component'i
 * (`FlexConnectMobile`) aynı şekilde yeniden render eder, davranış değişmez.
 *
 * 2026-08-03: `connect/mobile/page.tsx`'ten çıkarıldı. Birebir taşıma.
 */
export function usePresenceTracking(uids: string[], studentPersonId: string | null | undefined): PresenceTracking {
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceSignal>>(new Map());
  const [myPresenceStatus, setMyPresenceStatusLocal] = useState<PresenceStatus>("online");
  usePresenceHeartbeat(studentPersonId !== undefined, studentPersonId ?? undefined);

  const [, forcePresenceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forcePresenceTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (uids.length === 0) return;
    const myUid = auth.currentUser?.uid;
    return subscribeToPresence(uids, (signals) => {
      setPresenceMap(new Map(signals.map((s) => [s.uid, s])));
      const mine = signals.find((s) => s.uid === myUid);
      if (mine) setMyPresenceStatusLocal(mine.status);
    });
  }, [uids]);

  return { presenceMap, myPresenceStatus, setMyPresenceStatusLocal };
}
