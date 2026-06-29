import type { Audit, EntityId, ISODate, TenantId } from "../base";

/** Kampanyanın hangi eğitimlere uygulanacağı. */
export type CampaignScopeType = "all" | "branch" | "education";

/**
 * percent   → tüm kapsam içindeki eğitimlerde X% indirim
 * fixed     → tüm kapsam içindeki eğitimlerde sabit X₺ indirim
 * nth       → müşteri bu kapsam içinden N. eğitimi aldığında X% indirim
 *             (ör. nthN=2, value=50 → 2. eğitimde %50)
 */
export type CampaignDiscountType = "percent" | "fixed" | "nth";

export type CampaignStatus = "taslak" | "aktif";

export interface CampaignScope {
  type: CampaignScopeType;
  /** branch seçiliyse hangi branşlar (id + görünen ad snapshot) */
  branchIds?: string[];
  branchNames?: string[];
  /** education seçiliyse hangi eğitimler (id + görünen ad snapshot) */
  educationIds?: string[];
  educationNames?: string[];
}

export interface Campaign extends Audit {
  id: EntityId;
  tenantId: TenantId;
  name: string;
  description?: string;
  scope: CampaignScope;
  discountType: CampaignDiscountType;
  discountValue: number;   // percent(1-100) | fixed(TL) | nth(percent 1-100)
  nthN?: number;           // sadece nth tipinde: kaçıncı alışveriş (≥2)
  startDate: ISODate;
  endDate: ISODate;
  status: CampaignStatus;
}
