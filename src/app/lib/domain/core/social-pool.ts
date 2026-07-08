import type { EntityId, ISODateTime, TenantId } from "../base";

/**
 * REKLAM TASARIMI (SOSYAL MEDYA) HAVUZU — canlıdaki `lottery_configs/socialMedia`
 * dokümanının karşılığı. `CollagePool`/`BookPool` ile aynı iki katmanlı sahiplik
 * deseni (bkz. collage-pool.ts), TEK FARK: düz tek liste yerine 3 iç içe koleksiyon
 * (Sektörler/Markalar/Formatlar) + ortak amaç havuzu + paylaşılan kural metni.
 *
 * **İlişki modeli canlıdaki gibi STRING EŞLEŞMESİDİR, foreign-key DEĞİL** —
 * `SMBrand.mainSector`/`.subSector`, `SMSector.name`/`.subSectors[]` içindeki
 * metinlerle isim eşleşerek bağlanır (bilinçli port kararı: canlı davranış
 * birebir korunuyor, ID bazlı ilişkiye geçilmedi).
 */

export interface SMBrand {
  id: EntityId;
  brandName: string;
  brandRule: string; // boşsa PDF/mail'de pool.sharedRule kullanılır
  mainSector: string; // SMSector.name ile string eşleşmesi
  subSector: string; // SMSector.subSectors[] ile string eşleşmesi
  purposes: string[]; // boşsa pool.globalPurposes'tan seçilir (fallback zinciri)
}

export interface SMSector {
  id: EntityId;
  name: string;
  subSectors: string[];
}

export interface SMFormat {
  id: EntityId;
  dim: string; // "1080x1080" gibi boyut
  type: string; // "Kare Gönderi" gibi tür
  platform: string; // "Instagram" gibi platform
}

/**
 * ÇEKİLİŞ SONUCU SNAPSHOT'I — canlıdaki `FullSMDraw`'ın düz-alan (decompose edilmiş)
 * modeliyle birebir. `CollageItem`/`BookItem`'ın aksine tek bir havuz öğesinin
 * kopyası değil, hiyerarşik seçimin (Sektör→Marka→Amaç) + bağımsız Format seçiminin
 * SONUCUDUR — snapshot semantiği burada da geçerli (havuz sonradan değişse de
 * geçmiş çekilişler değişmez).
 */
export interface SocialDrawItem {
  brandName: string;
  sectorDisplay: string; // "{mainSector} / {subSector}"
  brandRule: string;
  purpose: string;
  platform: string;
  contentType: string; // "{dim} ({type})"
}

export interface SocialPool {
  id: EntityId; // `${tenantId}_default` veya `${tenantId}_${trainerId}`
  tenantId: TenantId;
  trainerId?: EntityId; // dolu ise eğitmenin kişisel kopyası, boşsa tenant varsayılanı
  brands: SMBrand[];
  sectors: SMSector[];
  formats: SMFormat[];
  globalPurposes: string[];
  sharedRule: string;
  updatedAt?: ISODateTime;
  updatedBy?: string;
}
