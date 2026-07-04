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
  delete(id: string, tenantId: string): Promise<void>;
}
