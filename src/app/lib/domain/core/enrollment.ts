import type { Audit, EntityId, ISODateTime, TenantId } from "../base";

export type EnrollmentStatus =
  | "active"
  | "frozen" // dondurulmuş
  | "completed" // mezun/tamamlandı
  | "transferred"
  | "cancelled";

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
  moduleScope?: string; // boş = tüm modüller; dolu = sadece o modül (cross-education)

  status: EnrollmentStatus;
  saleId?: EntityId; // FlexOS dikişi — Core'da opsiyonel

  transferHistory?: EnrollmentTransfer[];
  result?: FrozenResult; // finalize/mezuniyet anında dolar, sonra dokunulmaz
}
