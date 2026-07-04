import type { AssignmentTemplate } from "../core/assignment-template";

/**
 * AssignmentTemplate deposu — PORT.
 * Implementasyon: `lib/server/assignment-template-repo.firestore.ts` (`flexos_assignment_templates`).
 */
export interface AssignmentTemplateRepo {
  nextId(): string;
  save(template: AssignmentTemplate): Promise<void>;
  getById(id: string, tenantId: string): Promise<AssignmentTemplate | null>;
  list(tenantId: string): Promise<AssignmentTemplate[]>;
  delete(id: string, tenantId: string): Promise<void>;
}
