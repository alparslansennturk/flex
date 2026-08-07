import type { Audit, EntityId, ISODateTime, TenantId } from "../base";
import type { SurveyPrivacy, SurveyQuestion, SurveyType } from "./survey";

/** Gönderim anındaki roster'a düşen tek öğrenci — sonradan sınıftan çıksa/taşınsa bile bu liste SABİT kalır. */
export interface SurveyDispatchRosterEntry {
  personId: EntityId;
  name: string;
  /** Yoksa (Firebase hesabı olmayan öğrenci) bildirim atlanır — cevap yine de personId ile mümkün. */
  authUid?: string;
}

/**
 * Bir Survey'in BELİRLİ bir sınıfa BELİRLİ bir anda gönderilmesi — "Anket Yap" akışının
 * sonucu. Aynı Survey farklı sınıflara/zamanlarda gönderilince HER SEFERİNDE ayrı bir
 * dispatch açılır (2026-08-07 kullanıcı kararı — ayrı sonuç kümeleri).
 *
 * `*Snapshot` alanları: Survey sonradan düzenlenirse bu dispatch'in (ve üzerindeki
 * yanıtların) hangi başlık/soru setine ait olduğu BOZULMASIN diye dondurulmuş kopya.
 */
export interface SurveyDispatch extends Audit {
  id: EntityId;
  tenantId: TenantId;

  surveyId: EntityId;
  surveyTitleSnapshot: string;
  surveyTypeSnapshot: SurveyType;
  surveyPrivacySnapshot: SurveyPrivacy;
  questionsSnapshot: SurveyQuestion[];

  groupId: EntityId;
  groupCodeSnapshot: string;
  /** Sahiplik kontrolü (scoped capability) için denormalize — `Group.trainerId` ile aynı anlamda. */
  trainerId?: string;

  /** Gönderim anındaki AKTİF enrollment'lardan türetilen sabit liste. */
  roster: SurveyDispatchRosterEntry[];
  /** `roster[].personId` denormalize kopyası — Firestore `array-contains` ile öğrenci
   * portalı sorgusu (`listByPerson`) için (roster nesne dizisi olduğundan doğrudan
   * sorgulanamaz). `roster` ile birlikte yazılır, ayrı güncellenmez. */
  rosterPersonIds: string[];

  sentAt: ISODateTime;
  sentBy: string;
  /**
   * "Anlık ama tam kilit değil" (2026-08-07 kararı): öğrenci ilk girişte modalda
   * "Sonra" diyebilir ama sonsuza kadar değil — bu tarihten sonra dispatch pasife
   * düşer, öğrenci dashboard modalı bir daha çıkmaz, "Anketlerim"de "Süresi Doldu"
   * olarak görünür, cevap gönderilemez. Hızlı Anket=15 gün (gerçekten anlık —
   * "bugünkü ders saati" gibi sorular), Klasik Anket=1 ay (memnuniyet anketi gibi
   * daha rahat ertelenebilir) — `dispatchSurvey`'de `sentAt`'ten hesaplanır.
   */
  dueAt: ISODateTime;
}
