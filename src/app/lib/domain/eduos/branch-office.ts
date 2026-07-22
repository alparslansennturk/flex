import type { Audit, EntityId, TenantId } from "../base";

/**
 * ŞUBE: fiziksel ofis/lokasyon (Kadıköy, Pendik…) — BRANŞ (disiplin) ile KARIŞTIRILMAZ.
 * Stabil id'ler `src/app/lib/branch-offices.ts`'teki eski sabit listeyle eşleşir
 * (Group.branchOfficeId geriye dönük bozulmasın diye seed'de aynı id'ler korunur).
 */
export interface BranchOffice extends Audit {
  id: EntityId;
  tenantId: TenantId;
  name: string;
  order?: number;
}
