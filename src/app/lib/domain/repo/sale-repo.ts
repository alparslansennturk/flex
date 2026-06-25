import type { Sale } from "../eduos/sale";

/**
 * Sale deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/sale-repo.firestore.ts`.
 */
export interface SaleRepo {
  nextId(): string;
  save(sale: Sale): Promise<void>;
  getById(id: string, tenantId: string): Promise<Sale | null>;
  list(tenantId: string): Promise<Sale[]>;
  listByPerson(personId: string, tenantId: string): Promise<Sale[]>;
}
