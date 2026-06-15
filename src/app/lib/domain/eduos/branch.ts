import type { Audit, EntityId, TenantId } from "../base";

/**
 * DİKİŞ (FlexOS) — BRANŞ: disiplin / genel kategori (Grafik Tasarım, Yazılım).
 * Katalogun tepesi: Branş → Eğitim → Track.
 */
export interface Branch extends Audit {
  id: EntityId;
  tenantId: TenantId;
  name: string; // "Grafik Tasarım"
  slug?: string;
  order?: number;
}
