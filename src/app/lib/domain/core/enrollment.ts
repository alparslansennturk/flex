import type { Audit, EntityId, ISODateTime, TenantId } from "../base";

/**
 * Öğrenci (üyelik) durumu — TEK doğru kaynak burada (Person'da değil).
 * Bir kişi A grubunda `active`, B grubunda `completed` olabilir → durum üyeliğe ait.
 * Ödeme durumu AYRI bir eksendir ve SAKLANMAZ; ödeme planından türetilir ([[project-status-model]]).
 */
export type EnrollmentStatus =
  | "active" // Aktif — satış tamamlanınca varsayılan
  | "on_hold" // Beklemede — yalnız operasyon MANUEL alır; yoklamada görünür, gruptan ÇIKARILMAZ, aktif sayılmaz
  | "passive" // Pasif — operasyon kalıcı pasife aldı
  | "completed" // Mezun
  | "cancelled"; // İptal — satış iptali cascade'i (soft, silinmez)

export interface EnrollmentTransfer {
  fromGroupId: EntityId;
  toGroupId: EntityId;
  at: ISODateTime;
  by: string;
}

/** Mezuniyet/finalize anında yazılan sertifika sonucu — KALICI (öğrenci başka gruba geçse de durur). */
export interface FrozenCertificate {
  status: "pending" | "earned" | "failed" | "issued";
  type?: "participation" | "achievement" | "meb"; // Katılım | Başarı | MEB
  code?: string; // belge no (verilince)
  issuedAt?: ISODateTime;
}

/**
 * DONMUŞ sonuç — modül/mezuniyet bitince yazılır, DEĞİŞMEZ.
 * Ödev ağırlığı sonradan değişse veya grup silinse bile sabit kalır.
 * Sertifika "dondurulmuş bir gerçektir", her açılışta yeniden hesaplanmaz.
 */
export interface FrozenResult {
  finalGrade: number;
  projectGrade: number;
  assignmentScore: number;
  groupCode: string; // hangi sınıfta alındı (denormalize)
  module: string;
  branch: string;
  term: string; // dönem/yıl
  finalizedAt: ISODateTime;
  certificate?: FrozenCertificate;
}

/**
 * KÖPRÜ varlık: Person ↔ Group. Akışın kalbi.
 *
 * Sınıfa özel her şey (devam/not/sertifika sonucu) burada veya gruba bağlı
 * koleksiyonlarda yaşar — Person'da değil. 1 Person + N Enrollment.
 *
 * İki kapıdan doğabilir:
 *  1) Eğitmen quick-add (Core) — saleId boş.
 *  2) Satış (FlexOS) — Sale → Person + Enrollment, saleId dolu.
 */
export interface Enrollment extends Audit {
  id: EntityId;
  tenantId: TenantId;

  personId: EntityId;
  groupId?: EntityId; // boş = grupsuz havuzda bekliyor (op yerleştirecek)
  educationId?: EntityId;
  trackScope?: string; // boş = eğitimin tüm track'leri; dolu = sadece o Track (cross-education, örn. yalnız "Temel Photoshop")

  status: EnrollmentStatus;
  saleId?: EntityId; // FlexOS dikişi — Core'da opsiyonel

  transferHistory?: EnrollmentTransfer[];
  result?: FrozenResult; // finalize/mezuniyet anında dolar, sonra dokunulmaz
}
