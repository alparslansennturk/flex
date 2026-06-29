import type { Bundle } from "../eduos/bundle";

export interface BundleRepo {
  nextId(): string;
  save(bundle: Bundle): Promise<void>;
  getById(id: string, tenantId: string): Promise<Bundle | null>;
  list(tenantId: string): Promise<Bundle[]>;
  delete(id: string, tenantId: string): Promise<void>;
}
