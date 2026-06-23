import type { Audit, EntityId, TenantId } from "../base";

export type TrainerStatus = "aktif" | "pasif";

/** Dahili eğitmen notu (yalnız yönetim görür). */
export interface TrainerNote {
  text: string;
  author: string;
  date: string; // gösterim tarihi ("23 Haz 2026")
  pinned?: boolean;
  sentiment?: "positive" | "negative" | "neutral";
}

/** Haftalık müsaitlik dilimi. */
export interface TrainerAvailabilitySlot {
  gun: string; // "Pts".."Paz"
  baslangic: string; // "10:00"
  bitis: string; // "13:00"
  dolu?: boolean;
}

/**
 * EĞİTMEN — kurum kadrosundaki öğretici.
 *
 * Gruplara `Group.trainerId === Trainer.id` ile bağlanır; atanmış gruplar
 * okuma anında BİRLEŞTİRİLİR (read-time join), eğitmen dokümanında tutulmaz.
 *
 * `hourlyRate` (ders saati ücreti) HASSAStır: `trainer.rate.write` yoksa sunucuda
 * düşürülür, `trainer.rate.read` yoksa maskelenir — Person PII deseninin eşi.
 * Aylık tutar ileride yoklamadan gelen ders saati × hourlyRate ile finans
 * modülünde hesaplanır (burada saklanmaz).
 */
export interface Trainer extends Audit {
  id: EntityId;
  tenantId: TenantId;

  name: string;
  email: string;
  phone?: string;

  branchOffices: string[]; // şube ofis adları (Kadıköy, Pendik…)
  status: TrainerStatus;

  competencies: Record<string, string[]>; // branş → girebildiği eğitimler
  hourlyRate?: number; // ders saati ücreti (TL/saat) — gizli/kapılı

  availability?: TrainerAvailabilitySlot[];
  notes?: TrainerNote[];

  authUid?: string; // ileride eğitmen portalı/login için
}
