/**
 * FlexOS · Gerçek zamanlı değişiklik yayını — bellek-içi, tek-instance pub/sub.
 * Firestore client erişimi AÇILMADAN (rules `if false` kalır, güvenlik modeli
 * bozulmaz) "bir şey değişti" sinyalini bağlı istemcilere iletmek için (2026-07-11
 * mimari kararı — polling'in yerine, 2026-07-12 tüm ana varlıklara genişletildi).
 * Mutasyon zaten server route'ında oluyor, burada sadece o anda bağlı SSE
 * dinleyicilerine haber veriliyor — hiçbir Firestore okuması TETİKLEMEZ.
 *
 * TEK yayın kanalı, TEK SSE ucu (`/api/flexos/realtime/stream`), TEK client hook'u
 * (`useRealtimeSync`) — her varlık türü için ayrı altyapı YOK, sadece `type` alanı
 * farklı. Bir ekran hangi değişikliklerle ilgileniyorsa o `type`'ları dinler.
 *
 * BİLİNÇLİ SINIR: Vercel'de birden fazla fonksiyon instance'ı varsa, bir mutasyonu
 * işleyen instance ile başka bir kullanıcının SSE bağlantısını tutan instance FARKLI
 * olabilir — o durumda bu instance'daki dinleyiciler haberi kaçırır. FlexOS'un
 * bugünkü düşük-eşzamanlılık ölçeğinde nadir bir durum; ileride gerçek sorun olursa
 * TEK değişecek yer burası (Upstash/Redis pub-sub'a geçiş) — `subscribe`/`broadcast`
 * imzası aynı kalacağı için çağıran kod (route'lar, client hook) HİÇ değişmeden bu
 * geçiş yapılabilir.
 */

import { invalidateCache } from "./read-cache";

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

/** Yeni bir dinleyici kaydeder, unsubscribe fonksiyonu döner. */
export function subscribe(tenantId: string, listener: Listener): () => void {
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

/** Bu tenant'a bağlı TÜM dinleyicilere olayı iletir (bu instance'daki). */
export function broadcast(tenantId: string, event: RealtimeEvent): void {
  invalidateCachesFor(tenantId, event.type); // önce sunucu cache'ini düşür — client TAZE çeksin
  const set = subscribersByTenant.get(tenantId);
  if (!set || set.size === 0) return;
  for (const listener of set) listener(event);
}
