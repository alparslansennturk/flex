import type { Audit, EntityId, TenantId } from "../base";

/**
 * Eğitmen notu — per-eğitmen, gated (`person.note.read` / `person.note.write`).
 * Varsayılan blur; butona basınca görünür. Person'dan AYRI kayıt; öğrenci
 * kartında "Notlar" sekmesinde birleştirilir.
 */
export interface PersonNote extends Audit {
  id: EntityId;
  tenantId: TenantId;
  personId: EntityId;
  authorUid: string; // notu yazan eğitmen
  body: string;
}
