import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import type { Actor } from "@/app/lib/domain/access/types";
import { firestoreActivityLogRepo } from "@/app/lib/server/activity-log-repo.firestore";
import { cachedRead, invalidateCache } from "@/app/lib/server/read-cache";

// 2026-07-15 kullanıcı geri bildirimi: "15 aktivite olmalı, sığmazsa panel kendi içinde
// scroll etsin" (panel zaten `overflow-y-auto` — sadece çekilen sayı azdı).
const RECENT_LIMIT = 15;
// Kısa TTL — hafif bir okuma (tek trainerId filtresi), gerçek değişiklik mutasyon
// route'larının çağırdığı `invalidateActivityLogCache` ile ANINDA düşürülüyor
// (aşağıdaki cachedRead'e rağmen stale okuma riski kalmasın diye).
const ACTIVITY_LOG_CACHE_TTL_MS = 30_000;

function cacheKeyPrefix(tenantId: string): string {
  return `activity-log:${tenantId}:`;
}

/**
 * Yoklama/not mutasyon route'larının aktivite yazdıktan SONRA çağırması gereken invalidation —
 * 2026-07-15 GERÇEK BUG: `cachedRead` 30sn TTL kullanıyordu ama hiçbir mutasyon bunu
 * düşürmüyordu, SSE (`attendance.changed`/`grades.changed`) tetiklediği ANINDA refetch bu yüzden
 * stale (yeni yazılan aktiviteyi içermeyen) listeyi dönüyordu — kullanıcı "güncelledim, hiç
 * düşmedi" dedi. Tenant-geneli (trainerId'siz) prefix'le invalidate ediliyor — mutasyon
 * route'ları derin servis çağrısının içindeki gerçek trainerId'yi bilmiyor, kaba ama doğru/ucuz.
 */
export function invalidateActivityLogCache(tenantId: string): void {
  invalidateCache(cacheKeyPrefix(tenantId));
}

/**
 * Eğitmen günlük iş logu (Ana Sayfa "En Son Aktiviteler") — `fetchGroupsForActor`'daki
 * (`groups/route.ts`) org-scope="tüm tenant'ı göster" DESENİNİN AKSİNE, burada org-scope
 * (admin Full mod) İÇİN ÖZEL bir davranış YOK: bu sayfa "BENİM ana sayfam" — Görünüm
 * Anahtarı Core↔Full arası geçse bile hep AYNI kişinin (`actor.trainerId`) akışı gösterilir.
 * 2026-07-15 GERÇEK BUG: eskiden org-scope'ta `requestedTrainerId` şart koşuluyordu (client
 * hiç göndermiyor) → admin Full moda geçince panel HER ZAMAN boş dönüyordu.
 */
export function fetchActivityLogForActor(actor: Actor, requestedTrainerId?: string) {
  const trainerId = requestedTrainerId ?? actor.trainerId;
  if (!trainerId) return Promise.resolve([]);

  const cacheKey = `${cacheKeyPrefix(actor.tenantId)}${trainerId}`;
  return cachedRead(cacheKey, ACTIVITY_LOG_CACHE_TTL_MS, () =>
    firestoreActivityLogRepo.listRecentForTrainer(actor.tenantId, trainerId, RECENT_LIMIT),
  );
}

/** GET /api/flexos/egitmen-anasayfa/activity-log — Ana Sayfa'nın hafif yeniden-çekmesi. */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  const requestedTrainerId = req.nextUrl.searchParams.get("trainerId") ?? undefined;

  try {
    const items = await fetchActivityLogForActor(actor, requestedTrainerId);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[flexos/egitmen-anasayfa/activity-log GET] hata:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
});
