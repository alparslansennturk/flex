import type { RoleDef } from "../core/role-def";

/**
 * Rol Tanımı deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/role-def-repo.firestore.ts` (`flexos_role_defs` koleksiyonu).
 */
export interface RoleDefRepo {
  nextId(): string;
  save(roleDef: RoleDef): Promise<void>;
  getById(id: string, tenantId: string): Promise<RoleDef | null>;
  list(tenantId: string): Promise<RoleDef[]>;
}
