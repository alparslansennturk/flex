import type { Audit, EntityId, TenantId } from "../base";

/**
 * ANKET KÜTÜPHANESİ — create-once, reuse-many (2026-08-07 kullanıcı kararı: "istediğim
 * kadar farklı tipte anket oluşturup kaydedip ileride kullanabilirim"). Bir `Survey`
 * SADECE tanımdır (başlık+sorular+gizlilik) — kime/ne zaman gönderildiği burada YOK,
 * bkz. `SurveyDispatch`. Aynı Survey, farklı zamanlarda farklı sınıflara defalarca
 * gönderilebilir; düzenlenebilir; silinmediği sürece kütüphanede kalır.
 */
export type SurveyType = "classic" | "quick"; // Klasik Anket | Hızlı Anket
export type SurveyPrivacy = "named" | "anonymous"; // İsimli | Anonim
export type SurveyQuestionType = "scale5" | "yesno" | "singlechoice" | "open";

export interface SurveyQuestionOption {
  id: string;
  label: string;
}

export interface SurveyQuestion {
  id: string;
  order: number;
  text: string;
  type: SurveyQuestionType;
  /** Sadece `singlechoice` (ve Hızlı Anket'in tek sorusu) için — 2+ şık. */
  options?: SurveyQuestionOption[];
  /** Varsayılan true — öğrenci doldurma sayfasında zorunlu kontrolü. */
  required?: boolean;
  /**
   * Opsiyonel yorum alanı (2026-08-07 kullanıcı isteği: "Eğitmenini değerlendir —
   * altta yorum alanı olmalı") — `scale5`/`yesno`/`singlechoice` sorularının altına
   * isteğe bağlı bir açık metin kutusu ekler ("Açık Uçlu" AYRI bir soru olarak değil,
   * BU sorunun eki olarak). Cevabı `SurveyAnswer`'da `${question.id}__comment` id'siyle
   * ayrı bir satır olarak saklanır (schema'ya dokunmadan) — bkz. survey-response-service.ts.
   * `open` tipinde anlamsız (zaten serbest metin), UI'da o tip için gösterilmez.
   */
  allowComment?: boolean;
}

export interface Survey extends Audit {
  id: EntityId;
  tenantId: TenantId;

  type: SurveyType;
  title: string;
  description?: string;
  privacy: SurveyPrivacy;

  /**
   * Klasik Anket: 1+ soru, serbest. Hızlı Anket: TAM 1 soru, tipi `yesno` ya da
   * `singlechoice` (2 şıklı popup) — validasyon `survey-service.ts::createSurvey`'de.
   */
  questions: SurveyQuestion[];
}
