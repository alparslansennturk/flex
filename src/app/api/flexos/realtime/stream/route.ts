import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { subscribe, type RealtimeEvent } from "@/app/lib/server/realtime-hub";

const HEARTBEAT_MS = 25_000;

/**
 * GET /api/flexos/realtime/stream — Server-Sent Events, TÜM varlık türleri için TEK uç
 * (groups/students/sales/grades/attendance/trainers/educations). Herhangi bir mutasyon
 * route'u `broadcast(tenantId, {type, id})` çağırdığında bağlı istemcilere olay düşer —
 * istemci hangi `type`'larla ilgileniyorsa sadece onları işler (bkz. useRealtimeSync).
 * Bu uç hiçbir Firestore okuması yapmaz, sadece bellek-içi yayını (`realtime-hub`) bağlı
 * tutar — polling'in yerini alıyor, Firestore rules'a hiç dokunulmadı.
 *
 * Native `EventSource` KULLANILMIYOR (client tarafı) — o custom Authorization header
 * göndermez, token URL'e query param düşerdi. İstemci manuel `fetch` + stream okuma
 * yapıyor, Bearer header aynı diğer uçlar gibi kalıyor.
 */
export const GET = withAuth(async (req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: RealtimeEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller zaten kapanmışsa (istemci ayrıldı) sessizce yut
        }
      };
      unsubscribe = subscribe(actor.tenantId, send);
      // Vercel/ara proxy'lerin boşta bağlantıyı kesmemesi için periyodik yorum satırı —
      // gerçek veri taşımaz, sadece bağlantıyı canlı tutar.
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* bağlantı zaten kapanmış */
        }
      }, HEARTBEAT_MS);
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
