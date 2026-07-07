import type { EntityId, ISODateTime, TenantId } from "../base";

/**
 * KOLAJ BAHÇESİ HAVUZU — canlıdaki `lottery_configs/collage` dokümanının karşılığı.
 * 4 sabit kategoriden (Gök/Yer/Obje 1/Obje 2) rastgele materyal çekilişinde kullanılır.
 *
 * **İKİ KATMANLI SAHİPLİK** (`CertificateSettings` ile aynı desen, 2026-07-07 kararı):
 *  - **Tenant varsayılanı** — `trainerId` YOK, doküman id = `${tenantId}_default`.
 *    Op/Admin yönetir (`assignment.pool.manage`, org scope). Yalnız bir eğitmen
 *    "Kütüphaneme Ekle" dediğinde TOHUM olarak kopyalanır — kalıcı bir fallback DEĞİL.
 *  - **Eğitmenin kişisel kopyası** — `trainerId` DOLU, doküman id = `${tenantId}_${trainerId}`.
 *    Kütüphaneme Ekle anında tenant varsayılanından deep-copy ile oluşturulur, SONRASINDA
 *    tamamen izole (bir eğitmenin ekleme/düzenlemesi başka eğitmeni etkilemez — kullanıcı
 *    kararı: paylaşımlı düzenlenebilir havuzda kaos riski).
 */
export const COLLAGE_CATEGORIES = ["Gök", "Yer", "Obje 1", "Obje 2"] as const;
export type CollageCategory = (typeof COLLAGE_CATEGORIES)[number];

export interface CollageItem {
  id: EntityId;
  name: string;
  category: CollageCategory;
  color: string;
  emoji: string;
}

export interface CollagePool {
  id: EntityId; // `${tenantId}_default` veya `${tenantId}_${trainerId}`
  tenantId: TenantId;
  trainerId?: EntityId; // dolu ise eğitmenin kişisel kopyası, boşsa tenant varsayılanı
  items: CollageItem[];
  updatedAt?: ISODateTime;
  updatedBy?: string;
}
