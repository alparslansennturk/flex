import type { EntityId, ISODateTime } from "../base";
import type { UploadSession } from "../core/submission";
import type { ActivityLogRepo } from "../repo/activity-log-repo";
import type { AssignmentRepo } from "../repo/assignment-repo";
import type { DriveDeps } from "../repo/drive-deps";
import type { StorageDeps } from "../repo/storage-deps";
import type { EnrollmentRepo } from "../repo/enrollment-repo";
import type { GroupRepo } from "../repo/group-repo";
import type { PersonRepo } from "../repo/person-repo";
import type { SubmissionFileRepo } from "../repo/submission-file-repo";
import type { SubmissionRepo } from "../repo/submission-repo";
import type { TrainerRepo } from "../repo/trainer-repo";
import type { UploadSessionRepo } from "../repo/upload-session-repo";
import type { EducationRepo, BranchRepo } from "../repo/catalog-repo";
import type { NotifyInput } from "./comment-service";

export interface SubmissionDeps {
  assignments: AssignmentRepo;
  groups: GroupRepo;
  persons: PersonRepo;
  enrollments: EnrollmentRepo;
  submissions: SubmissionRepo;
  submissionFiles: SubmissionFileRepo;
  uploadSessions: UploadSessionRepo;
  trainers: TrainerRepo;
  /** Klasör path'inde gerçek branş adını çözmek için (`resolveAssignmentFolderSegments`). */
  educations: EducationRepo;
  branches: BranchRepo;
  /** SADECE eski (Drive tabanlı) dosyaların silinmesi için — yeni upload'lar `storage` kullanır. */
  drive: DriveDeps;
  storage: StorageDeps;
  notify: (uid: string, input: NotifyInput) => Promise<void>;
}

/** Not verme akışlarının (`gradeSubmission`/`gradeManually`/`gradeBatch`) ortak ek bağımlılığı. */
export type GradingDeps = Pick<SubmissionDeps, "submissions" | "groups" | "assignments"> & { activityLog: ActivityLogRepo };

export interface InitUploadInput {
  requesterUid: string;
  tenantId: string;
  personId: EntityId;
  assignmentId: EntityId;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface InitUploadResult {
  session: UploadSession;
  currentUploads: number;
  maxUploads: number;
  /** Tarayıcının doğrudan PUT edeceği V4 imzalı URL (2026-07-29 — Vercel proxy'siz). */
  uploadUrl: string;
}

export interface GetChunkSessionInput {
  requesterUid: string;
  tenantId: string;
  uploadId: string;
}

export interface CompleteUploadInput {
  requesterUid: string;
  tenantId: string;
  uploadId: string;
  note?: string;
}

export interface InitAttachmentUploadInput {
  assignmentId: EntityId;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface InitAttachmentUploadResult {
  session: UploadSession;
  uploadUrl: string;
}

export interface CompleteAttachmentUploadInput {
  uploadId: string;
}

export interface DeleteFileInput {
  requesterUid: string;
  tenantId: string;
  submissionId: EntityId;
  fileId: EntityId;
}

export interface RetractInput {
  requesterUid: string;
  tenantId: string;
  submissionId: EntityId;
}

export interface BatchGradeItem {
  personId: EntityId;
  /** Net puan (0..maxPuan). 0 = teslim etmedi; gerçek teslimi olmayan 0'lar YAZILMAZ. */
  grade: number;
  isLate: boolean;
}

export interface BatchGradeResult {
  graded: number; // güncellenen (gerçek teslimi olan)
  created: number; // dosyasız yeni açılan (elle işaretlenen)
  skipped: number; // teslimi yok + 0 (default "teslim etmedi") — yazılmadı
  archived: boolean;
}

export interface OdevKategoriSonucu {
  /** Bu kategorideki yayınlanmış ödevlerin toplam `maxPuan`'ı — 0 ise bu kategoride hiç ödev yok. */
  totalMaxPuan: number;
  /** personId → bu kategoride kazanılan toplam ham puan. */
  earnedByPerson: Record<string, number>;
}

export interface OdevYuzdeleriResult {
  normal: OdevKategoriSonucu;
  proje: OdevKategoriSonucu;
}

export interface StudentActivityItem {
  id: string;
  type: "submission.created" | "grade.given";
  title: string;
  description: string;
  createdAt: ISODateTime;
}
