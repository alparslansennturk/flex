import type { Audit, EntityId, ISODateTime, TenantId } from "../base";

/**
 * Ödev Teslimi — Faz 2 (canlıdaki `submissions`/`submission_files`/`upload_sessions` karşılığı).
 *
 * Canlıdan FARK: bir (assignmentId, personId) çifti için TEK `Submission` dokümanı
 * yaşar (canlıda her yükleme yeni bir `submissions` dokümanıydı — 3 dağınık durum/not
 * güncelleme yolu vardı). Dosya geçmişi `SubmissionFile` versiyonlamasında tutulur,
 * `Submission.iteration` her yeni yükleme turunda (özellikle `revision` sonrası) artar.
 */
// "retracted": öğrenci teslimini geri çekti, aktif dosya yok — canlının aksine (hard-delete)
// doküman izi kalır, bir sonraki yüklemede normal döngü ("submitted") yeniden başlar.
export type SubmissionStatus = "submitted" | "reviewing" | "revision" | "completed" | "retracted";

export interface Submission extends Audit {
  id: EntityId;
  tenantId: TenantId;

  assignmentId: EntityId;
  groupId: EntityId; // denormalize — grup-sahipliği (assigned scope) kontrolü için
  personId: EntityId; // teslim eden kişi (Person.id, canlıdaki studentId karşılığı)

  status: SubmissionStatus;
  iteration: number; // 1'den başlar, revizyon sonrası yeni yükleme turunda artar
  isLate: boolean; // ilk teslim anı assignment.dueDate'i geçmiş miydi

  note?: string; // öğrencinin teslimle birlikte bıraktığı not
  submittedAt: ISODateTime; // ilk teslim anı (iterasyonlar arası sabit kalır)
  lastSubmittedAt: ISODateTime; // en son yükleme turu

  grade?: number; // 0-100
  gradedAt?: ISODateTime;
  gradedBy?: EntityId; // notu veren aktör uid'i

  retractedAt?: ISODateTime; // geri çekildiyse (soft — doküman silinmez, canlının aksine)
}

export interface SubmissionFile extends Audit {
  id: EntityId;
  tenantId: TenantId;
  submissionId: EntityId;

  driveFileId: string;
  driveViewLink: string;
  fileName: string; // orijinal dosya adı (kullanıcıya gösterilen)
  fileSize: number;
  mimeType: string;

  versionNo: number; // submission içindeki sıra no
  isLatest: boolean;

  deleted?: boolean; // soft-delete (öğrenci kendi dosyasını silebilir — completed hariç)
  deletedAt?: ISODateTime;
  deletedBy?: string; // uid
}

export type UploadSessionStatus = "uploading" | "completed" | "failed" | "expired";

/**
 * Resumable upload state machine — canlıdaki `upload_sessions` (7 günlük TTL) karşılığı.
 * `sessionUri` Drive'ın resumable upload URL'idir, İÇ ALAN — hiçbir response'ta client'a dönmez.
 */
export interface UploadSession extends Audit {
  id: EntityId;
  tenantId: TenantId;

  assignmentId: EntityId;
  groupId: EntityId;
  personId: EntityId;
  uploaderUid: string; // isteği yapan firebase uid (öğrenci — Faz 2 kapsamı SADECE bu)

  originalFileName: string;
  actualFileName: string; // "01-dosya.pdf" gibi sıralı+güvenli ad (Drive'a bu adla yazılır)
  fileSize: number;
  mimeType: string;

  sessionUri: string;
  folderId: string;
  folderPath: string; // "flexos/{tenantId}/{groupCode}/{personName}/{assignmentTitle}"

  status: UploadSessionStatus;
  expiresAt: ISODateTime;

  driveFileId?: string; // complete-upload sonrası
  submissionId?: EntityId; // complete-upload sonrası bağlanan/oluşturulan submission
}
