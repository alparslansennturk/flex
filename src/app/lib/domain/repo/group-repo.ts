import type { Group } from "../core/group";

/**
 * Group deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/group-repo.firestore.ts` (yeni `flexos_groups` koleksiyonu).
 */
export interface GroupRepo {
  nextId(): string;
  save(group: Group): Promise<void>;
  getById(id: string, tenantId: string): Promise<Group | null>;
}
