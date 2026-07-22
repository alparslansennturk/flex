import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/with-auth";
import { actorFromCaller } from "@/app/lib/server/auth-actor";
import type { Actor } from "@/app/lib/domain/access/types";
import { widestScope } from "@/app/lib/domain/access/can";
import { firestoreFlexosUserRepo } from "@/app/lib/server/flexos-user-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreBranchOfficeRepo } from "@/app/lib/server/catalog-repo.firestore";
import type { FlexosUser } from "@/app/lib/domain/core/flexos-user";

/**
 * 4 dashboard var — login sonrası kişinin rolüne göre doğru olana yönlendirilir.
 * 2026-07-13 GERÇEK BUG (kullanıcı bulgusu): "ogrenci" rolü hiç kontrol edilmiyordu —
 * yeni sağlanan öğrenci hesapları (bkz. persons/route.ts::provisionStudentLogin)
 * girişte varsayılan `/flexos/anasayfa`'ya (STAFF sayfası, admin placeholder) düşüyordu.
 * Orada FlexSidebar öğrenci için tasarlanmadığından "Ana Sayfa" linki de yanlışlıkla
 * `/flexos/egitmen-anasayfa`'ya gidiyordu, o sayfanın client-taraflı Firestore
 * okumaları da öğrenci rules'unda reddedilip "Missing or insufficient permissions"
 * hatası veriyordu — hepsi TEK kök nedenin (yanlış landing) zincirleme sonucu.
 */
async function resolveLanding(flexosUser: FlexosUser | null, uid: string, tenantId: string): Promise<string> {
  const roles = flexosUser?.roles ?? [];
  if (roles.includes("egitmen")) return "/flexos/egitmen-anasayfa";
  if (roles.includes("egitim_koordinatoru")) return "/flexos/egitim-operasyon-anasayfa";

  // 2026-07-13 canlıya alma bug fix: `flexos_users`'ta "ogrenci" rol etiketi eksik/atlanmış
  // GERÇEK öğrenciler bulundu (migration boşluğu — gerçek veride 20 `persons` kaydının
  // authUid'i doluyken sadece 1 `flexos_users` kaydında `roles:["ogrenci"]` doğruydu,
  // diğer 19'u boş placeholder'a düşüyordu). Artık flexos_users rolüne BAKILMAKSIZIN
  // `persons`'ta authUid eşleşmesi TEK BAŞINA yeterli — persons zaten doğru dolu,
  // asıl doğruluk kaynağı burası.
  const person = await firestorePersonRepo.findByAuthUid(uid, tenantId);
  if (person) return `/flexos/student/${person.id}`;

  return "/flexos/anasayfa";
}

/**
 * `/api/flexos/me`'nin gövdesi — `bootstrap/route.ts` da AYNI fonksiyonu çağırır.
 * NOT cache'lenmez (view-mode/landing gibi alanlar mod değişiminde ANINDA doğru olmalı).
 */
export async function buildMeInfo(actor: Actor) {
  const capabilities = Array.from(new Set(actor.grants.map((g) => g.capability)));
  // templateManageScope: Şablon Yönetimi'nin "Oyunlaştırılmış Tür" seçicisi SADECE org
  // scope'ta (global şablon) anlamlı — self scope (kişisel şablon) eğitmene hiç gösterilmez.
  const templateManageScope = widestScope(actor, "template.manage");
  const flexosUser = await firestoreFlexosUserRepo.findByAuthUid(actor.uid, actor.tenantId);
  const landing = await resolveLanding(flexosUser, actor.uid, actor.tenantId);
  // Kişinin "ana şube"si (bilgi amaçlı, Genel Bilgiler'deki tekil `officeId`) — avatar
  // etiketi ve Satış Listesi'nin varsayılan şube filtresi için (2026-07-22 kullanıcı isteği).
  const office = flexosUser?.officeId ? await firestoreBranchOfficeRepo.getById(flexosUser.officeId, actor.tenantId) : null;
  // Görünüm Anahtarı sahibi (view.toggle) için TEK doğruluk kaynağından türetilen mod —
  // 2026-07-11 düzeltmesi öncesi FlexSidebar bunu localStorage'dan AYRI okuyordu
  // (`viewMode.ts`), sunucudaki gerçek moddan (Firestore + in-process cache) kopabiliyordu
  // (ör. admin'e dönünce sidebar hâlâ eğitmen sanıyordu — Sistem Ayarları kayboluyordu).
  // Artık `caps` ile AYNI istekten, tek kaynaktan geliyor — asla birbirinden bağımsız kayamaz.
  const mode: "core" | "full" = capabilities.includes("view.toggle") && !capabilities.includes("role.manage") ? "core" : "full";
  // trainerId: eğitmen kadrosu (`flexos_trainers`) docId'si (uid DEĞİL, bkz. can.ts
  // ownerMatches yorumu) — client'ın "kendi gruplarım" filtrelerinde `?trainerId=`
  // olarak kullanması için (raw uid gönderirse Group.trainerId'yle asla eşleşmez).
  return {
    uid: actor.uid,
    trainerId: actor.trainerId ?? null,
    capabilities,
    templateManageScope,
    landing,
    mode,
    officeId: flexosUser?.officeId ?? null,
    officeName: office?.name ?? null,
  };
}

/**
 * GET /api/flexos/me — caller'ın etkin capability'leri (menü görünürlüğü için) + login
 * sonrası yönlendirilecek dashboard. Sunucudaki gerçek yetki kontrolü zaten `can()` ile
 * her serviste var; capabilities kısmı sadece client'ın hangi menüleri çizeceğini bilmesi
 * için (kozmetik, güvenlik değil).
 */
export const GET = withAuth(async (_req: NextRequest, caller) => {
  const actor = await actorFromCaller(caller);
  const info = await buildMeInfo(actor);
  // no-store: Görünüm Anahtarı sahibi mod değiştirdiğinde (admin↔eğitmen) bu uç
  // ANINDA yeni sonucu vermeli — tarayıcı/ara katman cache'i eski yetkiyi göstermesin.
  return NextResponse.json(info, { headers: { "Cache-Control": "no-store" } });
});
