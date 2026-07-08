import type { Audit, EntityId, ISODateTime, TenantId } from "../base";

/**
 * Canlı not — Enrollment'a bağlı, KİŞİ-bazlı kilitlenene kadar MUTABLE (Education pack).
 * Sadece `projectGrade` (Sertifika/Proje/Sınav notu, `Education.certType`'a göre etiketlenir
 * ama HER ZAMAN bu tek alana yazılır) tutar.
 *
 * **`Enrollment.result` snapshot'lama YOK (2026-07-08 kararı, önceki tasarımdan vazgeçildi):**
 * kullanıcı: "notu kaydet desek bile admin ve yetkili düzenleyebilir" — ayrı bir donmuş/
 * mezuniyet kaydı gerekmiyor, kilit doğrudan bu dokümanın `locked` alanında tutulur (bkz.
 * aşağı).
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

  /**
   * Kilitleme (2026-07-08 kararı) — KİŞİ-bazlı, grup-genelinde DEĞİL. Tetikleyici Eğitim
   * Op'un o kişiye özel "Sertifika Bastır" aksiyonu (HENÜZ YOK, ertelendi — bkz. proje
   * hafızası); o özellik gelince sadece o kişinin kaydını kilitleyecek. Kilitliyken
   * `grade.write` **assigned** scope'lu aktör (eğitmen) o kaydı DÜZENLEYEMEZ (`saveGrades`
   * sessizce atlar, roster'daki diğerlerini engellemez); **org** scope'lu aktör (admin/
   * yetkili) her zaman düzenleyebilir (kilit onu bağlamaz). Ayrı bir "unlock" aksiyonu YOK
   * — yetkili düzenlerse kilit durumu aynen kalır.
   */
  locked?: boolean;
  lockedAt?: ISODateTime;
  lockedBy?: string; // uid
}
