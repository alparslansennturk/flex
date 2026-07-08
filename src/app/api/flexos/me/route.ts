import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import { widestScope } from "@/app/lib/domain/access/can";
import { firestoreFlexosUserRepo } from "@/app/lib/server/flexos-user-repo.firestore";

/** 3 dashboard var — login sonrası kişinin rolüne göre doğru olana yönlendirilir. */
async function resolveLanding(uid: string, tenantId: string): Promise<string> {
  const flexosUser = await firestoreFlexosUserRepo.findByAuthUid(uid, tenantId);
  const roles = flexosUser?.roles ?? [];
  if (roles.includes("egitmen")) return "/flexos/egitmen-anasayfa";
  if (roles.includes("egitim_koordinatoru")) return "/flexos/egitim-operasyon-anasayfa";
  return "/flexos/anasayfa";
}

/**
 * GET /api/flexos/me — caller'ın etkin capability'leri (menü görünürlüğü için) + login
 * sonrası yönlendirilecek dashboard. Sunucudaki gerçek yetki kontrolü zaten `can()` ile
 * her serviste var; capabilities kısmı sadece client'ın hangi menüleri çizeceğini bilmesi
 * için (kozmetik, güvenlik değil).
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  const capabilities = Array.from(new Set(actor.grants.map((g) => g.capability)));
  // templateManageScope: Şablon Yönetimi'nin "Oyunlaştırılmış Tür" seçicisi SADECE org
  // scope'ta (global şablon) anlamlı — self scope (kişisel şablon) eğitmene hiç gösterilmez.
  const templateManageScope = widestScope(actor, "template.manage");
  const landing = await resolveLanding(actor.uid, actor.tenantId);
  // no-store: Görünüm Anahtarı sahibi mod değiştirdiğinde (admin↔eğitmen) bu uç
  // ANINDA yeni sonucu vermeli — tarayıcı/ara katman cache'i eski yetkiyi göstermesin.
  return NextResponse.json(
    { uid: actor.uid, capabilities, templateManageScope, landing },
    { headers: { "Cache-Control": "no-store" } },
  );
});
