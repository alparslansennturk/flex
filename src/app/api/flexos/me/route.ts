import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";

/**
 * GET /api/flexos/me — caller'ın etkin capability'leri (menü görünürlüğü için).
 * Sunucudaki gerçek yetki kontrolü zaten `can()` ile her serviste var; bu uç
 * sadece client'ın hangi menüleri çizeceğini bilmesi için (kozmetik, güvenlik değil).
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = actorFromCaller(caller);
  const capabilities = Array.from(new Set(actor.grants.map((g) => g.capability)));
  // no-store: Görünüm Anahtarı sahibi mod değiştirdiğinde (admin↔eğitmen) bu uç
  // ANINDA yeni sonucu vermeli — tarayıcı/ara katman cache'i eski yetkiyi göstermesin.
  return NextResponse.json({ uid: actor.uid, capabilities }, { headers: { "Cache-Control": "no-store" } });
});
