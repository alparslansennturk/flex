import type { Case } from "../crm/case";

export interface CaseRepo {
  nextId(): string;
  save(c: Case): Promise<void>;
  getById(id: string, tenantId: string): Promise<Case | null>;
  list(tenantId: string): Promise<Case[]>;
  /** Kişinin AÇIK (kapalı olmayan) taleplerini döndürür (dedup kontrolü için). */
  listOpenByPerson(personId: string, tenantId: string): Promise<Case[]>;
}
