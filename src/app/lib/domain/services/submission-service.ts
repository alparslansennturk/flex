/**
 * Ödev Teslimi servis cephesi (facade). Madde 16 (2026-07-31, FLEXOS_TEKNIK_BORC.md)
 * kapsamında alt-domain dosyalarına bölündü — bu dosya SADECE geriye dönük uyumluluk
 * için tüm public API'yi tek yerden re-export eder, tüketici dosyaların import yolu
 * (`.../services/submission-service`) DEĞİŞMEDİ:
 * - `submission-types.ts` — SubmissionDeps ve tüm input/result tipleri
 * - `submission-helpers.ts` — paylaşılan klasör/yetki/sayaç yardımcıları
 * - `submission-upload-service.ts` — dosya yükleme (öğrenci teslimi + eğitmen eki),
 *   dosya silme, geri çekme
 * - `submission-grading-service.ts` — durum güncelleme, not verme (tekil/manuel/toplu),
 *   eğitmen/op sorguları
 * - `submission-score-service.ts` — Ödev Notu (%) hesap formülü
 * - `submission-student-service.ts` — öğrenci dashboard/detay sorguları
 */
export type {
  BatchGradeItem,
  BatchGradeResult,
  CompleteAttachmentUploadInput,
  CompleteUploadInput,
  DeleteFileInput,
  GetChunkSessionInput,
  GradingDeps,
  InitAttachmentUploadInput,
  InitAttachmentUploadResult,
  InitUploadInput,
  InitUploadResult,
  OdevKategoriSonucu,
  OdevYuzdeleriResult,
  RetractInput,
  StudentActivityItem,
  SubmissionDeps,
} from "./submission-types";

export { getMaxUploads } from "./submission-helpers";

export {
  completeAttachmentUpload,
  completeUpload,
  deleteFile,
  deleteFileAsStaff,
  getSessionForChunk,
  initAttachmentUpload,
  initUpload,
  retract,
} from "./submission-upload-service";

export {
  getSubmissionForStaff,
  gradeBatch,
  gradeManually,
  gradeSubmission,
  listSubmissionsForAssignment,
  listSubmissionsForGroup,
  updateSubmissionStatus,
} from "./submission-grading-service";

export { ODEV_TUR_AGIRLIK, combineOdevYuzdesi, computeOdevYuzdeleri } from "./submission-score-service";

export {
  getAssignmentForStudent,
  listAssignmentsForStudent,
  listRecentActivityForStudent,
} from "./submission-student-service";
