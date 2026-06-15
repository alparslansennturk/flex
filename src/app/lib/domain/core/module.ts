import type { EntityId, TenantId } from "../base";

/** Eğitimin bir modülü (Temel Photoshop, Temel Illustrator, Corel Draw ...). */
export interface Module {
  id: EntityId;
  tenantId: TenantId;
  educationId: EntityId;
  name: string;
  order: number; // sıra
  hours: number; // saat
}
