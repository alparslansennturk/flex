import type { Holiday } from "../core/holiday";

/**
 * Holiday deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/holiday-repo.firestore.ts` (yeni `flexos_holidays` koleksiyonu).
 */
export interface HolidayRepo {
  nextId(): string;
  save(holiday: Holiday): Promise<void>;
  getById(id: string, tenantId: string): Promise<Holiday | null>;
  list(tenantId: string): Promise<Holiday[]>;
  delete(id: string, tenantId: string): Promise<void>;
}
