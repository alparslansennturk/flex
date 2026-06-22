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
  startTime?: string; // seans başlangıç saati — "19.00"
  endTime?: string; // seans bitiş saati — "21.30"
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
  // Grup teslim birimine bağlanır:
  //  - bölümlü eğitim (Grafik) → sectionId dolu (grup = Grafik-1 sınıfı, kendi yoklama/sertifika)
  //  - bölümsüz eğitim (Python) → sadece educationId dolu
  sectionId?: EntityId; // grubun işlediği Bölüm (Grafik-1) — FlexOS dikişi, bölümlü teslim birimi
  trackId?: EntityId; // (ops.) yalnız tek Track teslimi için (Temel Photoshop standalone grubu)
  educationId?: EntityId; // bağlı eğitim (Grafik Tasarım Kursu) — denormalize, kolay sorgu
  branch?: string; // branş (Grafik Tasarım) — denormalize, kolay sorgu

  status: GroupStatus;
  type: GroupType;

  trainerId?: string; // atanan eğitmen (uid) — öğrenci bu eğitmenin altına düşer
  branchOfficeId?: EntityId; // şube (FlexOS)

  schedule: GroupSchedule;
  capacity?: number; // kontenjan
}
