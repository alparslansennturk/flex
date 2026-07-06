import type { Audit, EntityId, TenantId } from "../base";

/**
 * Canlı not — Enrollment'a bağlı, finalize'a kadar MUTABLE (Education pack).
 *
 * Kaynak-of-truth ayrımı:
 *  - Canlı düzenleme burada (`grades`) — sadece `projectGrade` (Sertifika/Proje/Sınav notu,
 *    `Education.certType`'a göre etiketlenir ama HER ZAMAN bu tek alana yazılır).
 *  - `grade.finalize` → hesaplanır, `Enrollment.result`'a SNAPSHOT'lanır, orası kilitlenir.
 *
 * **Ödev notu ARTIK BURADA SAKLANMIYOR** (2026-07-06 kararı, eski `assignmentScore`
 * alanı KALDIRILDI) — enrollment başına tek alan olması, birden fazla ödevin
 * birbirinin üzerine yazmasına sebep oluyordu. Doğru model: her `Assignment`'ın
 * kendi `maxPuan`'ı var, öğrencinin kazandığı puan `Submission.grade`'de (ödev
 * başına, kalıcı) saklanır; "Ödev Notu" yüzdesi OKUMA ANINDA hesaplanır —
 * `computeOdevYuzdeleri()` (`submission-service.ts`): grup içindeki TÜM yayınlanmış
 * ödevlerin `maxPuan` toplamı payda, kazanılan `Submission.grade` toplamı pay.
 *
 * Doküman id'si = enrollmentId (1:1).
 */
export interface Grade extends Audit {
  id: EntityId; // = enrollmentId
  tenantId: TenantId;

  enrollmentId: EntityId;
  personId: EntityId; // sorgu kolaylığı için denormalize
  groupId: EntityId; // sorgu kolaylığı için denormalize

  projectGrade?: number;
  components?: Record<string, number>; // ağırlık bileşenleri
}
