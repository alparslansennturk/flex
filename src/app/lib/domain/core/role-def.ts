import type { Audit, EntityId, TenantId } from "../base";

/**
 * Rol Tanımı — "Kullanıcı Ayarları" sayfasından yönetilen, kurumun kendi rolleri
 * (2026-07-08 eklendi). Öncesinde rol listesi + her rolün varsayılan yetki modülleri
 * `kullanicilar/ekle` ve `kullanicilar/[id]/duzenle` sayfalarında AYRI AYRI kopyalanmış
 * sabit kod (`ROLE_META`/`ROLE_DEFAULT_PERMS`) olarak duruyordu — artık tek kaynak burada,
 * Firestore'da. 6 yerleşik rol (`isBuiltIn:true`) ilk okumada otomatik tohumlanır
 * (`role-def-service.ts::listRoleDefs`) — hiçbir mevcut kullanıcı/davranış bozulmaz.
 *
 * `permModules` — sadeleştirilmiş yetki modülü anahtarları (`PERM_MODULES`,
 * `kullanicilar/_shared/permModules.ts`). Gerçek capability'lere eşleme HENÜZ YOK
 * (ayrı, daha büyük bir iş — `auth-actor.ts` şu an senkron ve 50+ yerde çağrılıyor,
 * Firestore'dan rol okumak onu asenkron yapmayı gerektirir).
 */
export interface RoleDef extends Audit {
  id: EntityId; // slug, ör. "egitim_koordinatoru" — FlexosUser.roles buna referans verir
  tenantId: TenantId;
  label: string;
  description?: string;
  color?: string; // hex, rozet rengi
  permModules: string[];
  isBuiltIn: boolean; // 6 yerleşik rol — silinemez, id'si değiştirilemez
}
