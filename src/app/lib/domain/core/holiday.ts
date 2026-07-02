import type { Audit, EntityId, ISODate, TenantId } from "../base";

/**
 * TATİL — resmî/kurum tatili (tek gün veya aralık). Ders/grup takvimleri
 * (yoklama dahil) bu aralıktaki günleri atlar. Canlıdaki `holidays` koleksiyonunun
 * FlexOS karşılığı (aynı model: ad + başlangıç/bitiş) — ayrı koleksiyon, canlıya dokunmaz.
 */
export interface Holiday extends Audit {
  id: EntityId;
  tenantId: TenantId;

  name: string;
  startDate: ISODate; // "YYYY-MM-DD"
  endDate: ISODate; // "YYYY-MM-DD" — tek günse startDate ile aynı
}
