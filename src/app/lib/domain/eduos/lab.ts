import type { Audit, EntityId, TenantId } from "../base";

/** Laboratuvar tipi — donanım/işletim sistemi ayrımı (Lab Utilizasyon filtreleri buna göre). */
export type LabType = "windows" | "mac";

/**
 * LABORATUVAR: fiziksel derslik/lab (Lab 1, Mac Lab…) — bir ŞUBE'ye (BranchOffice) bağlıdır.
 * Grup oluştururken seçilir (Group.labId); Lab Utilizasyon sayfası doluluğunu gösterir.
 */
export interface Lab extends Audit {
  id: EntityId;
  tenantId: TenantId;
  name: string;
  type: LabType;
  capacity: number;
  branchOfficeId: EntityId;
  order?: number;
}
