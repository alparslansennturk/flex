import type { Appointment } from "../crm/appointment";

export interface AppointmentRepo {
  nextId(): string;
  save(a: Appointment): Promise<void>;
  getById(id: string, tenantId: string): Promise<Appointment | null>;
  listByCase(caseId: string, tenantId: string): Promise<Appointment[]>;
}
