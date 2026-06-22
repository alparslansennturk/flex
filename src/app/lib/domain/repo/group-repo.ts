import type { Group } from "../core/group";

/**
 * Group deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/group-repo.firestore.ts` (yeni `flexos_groups` koleksiyonu).
 */
export interface GroupRepo {
  nextId(): string;
  save(group: Group): Promise<void>;
  getById(id: string, tenantId: string): Promise<Group | null>;
  list(tenantId: string, trainerId?: string): Promise<Group[]>;
  /** Grubu sil (boş grup — kayıtlı öğrenci kontrolü serviste yapılır). */
  delete(id: string, tenantId: string): Promise<void>;
}
