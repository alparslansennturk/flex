import type { Assignment } from "../core/assignment";

/**
 * Assignment deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/assignment-repo.firestore.ts` (`flexos_assignments`).
 */
export interface AssignmentRepo {
  nextId(): string;
  save(assignment: Assignment): Promise<void>;
  getById(id: string, tenantId: string): Promise<Assignment | null>;
  /** `groupId` verilirse o gruba daralır (verilmezse kiracının tüm ödevleri). */
  list(tenantId: string, groupId?: string): Promise<Assignment[]>;
  /**
   * BELİRLİ eğitmen id'lerinin (`trainerId` — `flexos_trainers` docId VEYA legacy uid)
   * ödevleri — self/assigned-scope aktörler için (2026-07-13 kota fix): `list(tenantId)`
   * kiracının TÜM ödevlerini okuyup sonra JS'te süzüyordu (Ödev Parkuru'nun her
   * `assignments.changed`'de tüm tenant'ı taraması kota olayının üçüncü kök nedeniydi).
   */
  listByTrainerIds(trainerIds: string[], tenantId: string): Promise<Assignment[]>;
  delete(id: string, tenantId: string): Promise<void>;
}
