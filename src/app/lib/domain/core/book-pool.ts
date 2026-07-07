import type { EntityId, ISODateTime, TenantId } from "../base";

/**
 * KİTAP DÜNYASI HAVUZU — canlıdaki `lottery_configs/book` dokümanının karşılığı.
 * `CollagePool` ile aynı iki-katmanlı sahiplik deseni (bkz. collage-pool.ts), TEK FARK:
 * kategori yok — düz tek liste ("deste" / `templateType: "deck"` canlı karşılığı).
 */
export interface BookItem {
  id: EntityId;
  bookId: string; // 2 haneli sıra no ("01", "12")
  title: string;
  author: string;
  genre: string;
  subGenre: string;
  isbn: string;
  publisher: string;
  pageCount: string;
  dimensions: string;
  backCover: string;
}

export interface BookPool {
  id: EntityId; // `${tenantId}_default` veya `${tenantId}_${trainerId}`
  tenantId: TenantId;
  trainerId?: EntityId; // dolu ise eğitmenin kişisel kopyası, boşsa tenant varsayılanı
  items: BookItem[];
  updatedAt?: ISODateTime;
  updatedBy?: string;
}
