import type { Audit, EntityId, ISODate, TenantId } from "../base";

/** Teslim formatı. (Cuma tatili gibi kurallar `standart` gruplara uygulanır.) */
export type GroupType = "standart" | "ozel_ders" | "kurumsal";

export type GroupStatus =
  | "planned"
  | "enrolling"
  | "active"
  | "postponed"
  | "completed"
  | "archived";

export interface GroupSchedule {
  startDate: ISODate;
  days: number[]; // 0=Pazar .. 6=Cumartesi
  sessionHours: number; // seans başına saat
  endDate?: ISODate; // tahmini/gerçek bitiş
}

/**
 * Eğitimin somut SINIFI — generic "org-unit"un eğitim adı.
 * Bir eğitimi baştan sona işler (modülleri sırayla, tek sınıf).
 * Gruplar geçicidir: isim değişmez, yeni grup açılır, öğrenci aktarılır.
 */
export interface Group extends Audit {
  id: EntityId;
  tenantId: TenantId;

  code: string; // "550"
  educationId?: EntityId; // bağlı eğitim (FlexOS dikişi; standalone'da boş olabilir)
  branch?: string; // disiplin — denormalize, kolay sorgu
  module?: string; // "GRAFIK_1"

  status: GroupStatus;
  type: GroupType;

  trainerId?: string; // atanan eğitmen (uid) — öğrenci bu eğitmenin altına düşer
  branchOfficeId?: EntityId; // şube (FlexOS)

  schedule: GroupSchedule;
  capacity?: number; // kontenjan
}
