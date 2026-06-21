import type { Seans } from "../eduos/seans";

export interface SeansRepo {
  nextId(): string;
  save(seans: Seans): Promise<void>;
  getById(id: string, tenantId: string): Promise<Seans | null>;
  list(tenantId: string): Promise<Seans[]>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
