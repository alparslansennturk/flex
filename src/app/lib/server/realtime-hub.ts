/**
 * FlexOS · Gerçek zamanlı değişiklik yayını (2026-07-11 mimari kararı — polling'in
 * yerine, 2026-07-12 tüm ana varlıklara genişletildi). Firestore client erişimi
 * AÇILMADAN (rules `if false` kalır, güvenlik modeli bozulmaz) "bir şey değişti"
 * sinyalini bağlı istemcilere iletmek için. Mutasyon zaten server route'ında oluyor,
 * burada sadece o anda bağlı SSE dinleyicilerine haber veriliyor — hiçbir Firestore
 * okuması TETİKLEMEZ.
 *
 * TEK yayın kanalı, TEK SSE ucu (`/api/flexos/realtime/stream`), TEK client hook'u
 * (`useRealtimeSync`) — her varlık türü için ayrı altyapı YOK, sadece `type` alanı
 * farklı. Bir ekran hangi değişikliklerle ilgileniyorsa o `type`'ları dinler.
 *
 * 2026-08-03 (FLEXOS_TEKNIK_BORC.md madde 6, k6/500-eşzamanlı-kullanıcı yük testi
 * hazırlığı) — Upstash Redis'e taşındı. ÖNCEDEN bellek-içi (`Map`) tek-instance
 * sınırı vardı: "Vercel'de birden fazla fonksiyon instance'ı varsa, bir mutasyonu
 * işleyen instance ile başka bir kullanıcının SSE bağlantısını tutan instance FARKLI
 * olabilir — o durumda bu instance'daki dinleyiciler haberi kaçırır." 500 eşzamanlı
 * kullanıcı Vercel'i kesinlikle çoklu-instance'a zorlayacağından bu artık gerçek bir
 * risk. Çözüm: `broadcast()` artık olayı bir Redis Stream'e yazıyor (`XADD`),
 * `subscribe()` (Upstash REST API gerçek "blocking" pub/sub desteklemediği için)
 * o stream'i kısa aralıklarla POLL ediyor (`XRANGE`, ~1.5sn) — anlık push değil ama
 * "hiç gelmeyen güncelleme" yerine "en fazla ~1.5sn gecikmeli güncelleme" oluyor,
 * kabul edilebilir bir değiş tokuş. `UPSTASH_REDIS_REST_URL`/`TOKEN` yoksa (local dev)
 * eski davranış (in-memory `Map`, gerçek anlık push) birebir korunuyor. Dışa açık
 * `subscribe`/`broadcast` imzaları DEĞİŞMEDİ — çağıran kod (route'lar, `useRealtimeSync`)
 * hiç dokunulmadı, bu geçişin baştan beri tasarlanan garantisiydi (bkz. önceki yorum,
 * arşivde).
 *
 * KANITLANMIŞ RİSK (2026-07-13, hâlâ geçerli): comment/thread bildirimi için bu
 * mekanizma denendi (`comments.changed`) ve LOCAL DEV'DE (Turbopack, tek Node process)
 * bile güvenilmez çıktı — modül instance'ları arasında paylaşım garanti değildi. Bu
 * yüzden comment/thread için SSE YERİNE polling kullanılıyor (öğrenci sayfasındaki
 * kanıtlanmış 6sn desen). Redis'e geçiş bu riski ORTADAN KALDIRIYOR (paylaşılan durum
 * artık process-dışı) ama bu dosyayı YENİ bir event türü için kullanmadan önce yine de
 * gerçek çapraz-route testi yapılmalı.
 */

import { after } from "next/server";
import { Redis } from "@upstash/redis";
import { invalidateCache } from "./read-cache";

const useUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = useUpstash
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
  : null;

export type RealtimeEventType =
  | "groups.changed"
  | "students.changed" // person (öğrenci) + enrollment (kayıt/transfer/mezuniyet) mutasyonları
  | "sales.changed"
  | "grades.changed" // not/ödev notu girişi (submissions grade, sertifikasyon notu)
  | "attendance.changed"
  | "trainers.changed"
  | "educations.changed" // branş/eğitim/bölüm kataloğu
  | "activities.changed" // Aktivite Merkezi: talep (case) + aktivite + randevu
  | "settings.changed" // CertificateSettings (Sertifika Ayarları — Ödev Etkisi/%) gibi tenant/eğitmen ayarları
  | "assignments.changed"; // ödev metadata/durum değişikliği (Bitir/Arşivle/Düzenle) — TEK öğrenci notu DEĞİL,
  // bkz. `grades.changed` yorumu — 2026-07-13 kota fix: ikisi aynı türdü, "Notları Kaydet"in
  // N öğrenciyi tek tek notlaması N ayrı `grades.changed` üretip Ödev Parkuru'nun (sadece
  // ödev DURUMUYLA ilgilenen, tek tek notlarla değil) pahalı tüm-tenant `assignments`/
  // `assignment-templates` sorgusunu N kere tekrar çekmesine sebep oluyordu.

export interface RealtimeEvent {
  type: RealtimeEventType;
  id?: string;
}

type Listener = (event: RealtimeEvent) => void;

const subscribersByTenant = new Map<string, Set<Listener>>();

// 2026-07-13 kota fix: sunucu-içi okuma cache'i (read-cache.ts) ile SSE tutarlı kalsın —
// bir mutasyon broadcast ettiği AN, o event'in etkilediği cache'ler düşürülür. Böylece
// client refetch'i (aynı event'i dinleyip tetiklenen) bayat değil TAZE veri alır. Tek nokta:
// her yeni mutasyon route'u ekstra iş yapmadan otomatik doğru davranır.
function invalidateCachesFor(tenantId: string, type: RealtimeEventType): void {
  // groups yanıtı: grup + eğitim/branş adı + eğitmen adı + enrollment sayısı join'liyor.
  if (type === "groups.changed" || type === "students.changed" || type === "educations.changed" || type === "trainers.changed") {
    invalidateCache(`groups:${tenantId}`);
  }
  // persons yanıtı: kişi + enrollment + satış + ödeme + eğitim/branş join'liyor.
  if (type === "students.changed" || type === "sales.changed" || type === "educations.changed") {
    invalidateCache(`persons:${tenantId}`);
  }
  // trainers yanıtı: eğitmen + grup + eğitim + enrollment join'liyor (2026-07-13 eklendi).
  if (type === "trainers.changed" || type === "groups.changed" || type === "educations.changed" || type === "students.changed") {
    invalidateCache(`trainers:${tenantId}`);
  }
}

const STREAM_TTL_SEC = 300; // 5dk — aktif dinleyici yoksa stream kendiliğinden silinir
const STREAM_MAXLEN = 200; // yaklaşık üst sınır, sınırsız büyümeyi önler
const POLL_INTERVAL_MS = 1500;

/** Yeni bir dinleyici kaydeder, unsubscribe fonksiyonu döner. */
export function subscribe(tenantId: string, listener: Listener): () => void {
  if (redis) {
    const streamKey = `realtime:${tenantId}`;
    let stopped = false;
    let lastId = "0";
    let timer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      // Başlangıç noktası: stream'in ŞU ANKİ son ID'si — abone olmadan ÖNCEKİ
      // event'ler değil, SADECE bundan sonrakiler işlensin.
      try {
        const last = await redis!.xrevrange(streamKey, "+", "-", 1);
        const ids = Object.keys(last ?? {});
        if (ids.length > 0) lastId = ids[0];
      } catch {
        // Stream henüz yoksa/erişilemezse "0"dan başla — zararsız.
      }
      if (stopped || timer) return;
      timer = setInterval(async () => {
        try {
          const entries = await redis!.xrange(streamKey, `(${lastId}`, "+");
          const ids = Object.keys(entries);
          if (ids.length === 0) return;
          for (const id of ids) {
            const fields = entries[id] as Record<string, string>;
            listener({ type: fields.type as RealtimeEventType, id: fields.id || undefined });
          }
          lastId = ids[ids.length - 1];
        } catch {
          // Redis geçici erişilemezse bu turu sessizce atla, bir sonraki pollde dener.
        }
      }, POLL_INTERVAL_MS);
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }

  // Local fallback (Upstash env yoksa — local dev) — 2026-07-11'in birebir orijinal
  // davranışı (gerçek anlık push, tek-instance).
  let set = subscribersByTenant.get(tenantId);
  if (!set) {
    set = new Set();
    subscribersByTenant.set(tenantId, set);
  }
  set.add(listener);
  return () => {
    const current = subscribersByTenant.get(tenantId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) subscribersByTenant.delete(tenantId);
  };
}

/** Bu tenant'a bağlı TÜM dinleyicilere olayı iletir. */
export function broadcast(tenantId: string, event: RealtimeEvent): void {
  invalidateCachesFor(tenantId, event.type); // önce sunucu cache'ini düşür — client TAZE çeksin

  if (redis) {
    const streamKey = `realtime:${tenantId}`;
    // Senkron imza KORUNDU (çağıran ~35 route hiç değişmedi) — Redis'e gerçek yazma
    // işi `after()` ile response gönderildikten SONRA da güvenle tamamlanır
    // (awaitlenmemiş bir Promise, fonksiyon dönüşüyle kesilebilir — `after()` bunu
    // garanti altına alıyor).
    after(async () => {
      try {
        await redis!.xadd(streamKey, "*", { type: event.type, id: event.id ?? "" });
        await redis!.xtrim(streamKey, { strategy: "MAXLEN", threshold: STREAM_MAXLEN });
        await redis!.expire(streamKey, STREAM_TTL_SEC);
      } catch {
        // Redis geçici erişilemezse event kaybolur (en kötü ihtimalle sayfa
        // yenilenince düzelir, aynı bilinen sınır) — kritik hata fırlatma.
      }
    });
    return;
  }

  const set = subscribersByTenant.get(tenantId);
  if (!set || set.size === 0) return;
  for (const listener of set) listener(event);
}
