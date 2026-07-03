import type { Activity } from "../crm/activity";

export interface ActivityRepo {
  nextId(): string;
  save(a: Activity): Promise<void>;
  getById(id: string, tenantId: string): Promise<Activity | null>;
  listByCase(caseId: string, tenantId: string): Promise<Activity[]>;
  list(tenantId: string): Promise<Activity[]>;
}
