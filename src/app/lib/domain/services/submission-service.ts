import { ALLOWED_MIME_TYPES, MAX_RESUMABLE_FILE_SIZE_BYTES, MAX_RESUMABLE_FILE_SIZE_LABEL } from "../../../types/storage";
import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Submission, SubmissionFile, SubmissionStatus, UploadSession } from "../core/submission";
import { ForbiddenError, ValidationError } from "../errors";
import type { Assignment } from "../core/assignment";
import type { AssignmentRepo } from "../repo/assignment-repo";
import type { DriveDeps } from "../repo/drive-deps";
import type { EnrollmentRepo } from "../repo/enrollment-repo";
import type { GroupRepo } from "../repo/group-repo";
import type { PersonRepo } from "../repo/person-repo";
import type { SubmissionFileRepo } from "../repo/submission-file-repo";
import type { SubmissionRepo } from "../repo/submission-repo";
import type { UploadSessionRepo } from "../repo/upload-session-repo";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

export interface SubmissionDeps {
  assignments: AssignmentRepo;
  groups: GroupRepo;
  persons: PersonRepo;
  enrollments: EnrollmentRepo;
  submissions: SubmissionRepo;
  submissionFiles: SubmissionFileRepo;
  uploadSessions: UploadSessionRepo;
  drive: DriveDeps;
}

/**
 * Bir (assignment, kişi) çifti için o ana kadarki AKTİF (silinmemiş) dosya sayısına
 * göre kalan yükleme hakkı — canlıdaki `getMaxUploads` iş kuralıyla birebir aynı.
 * `completed` → 0 (kilitli), `revision` → 8 (5 temel + 3 revizyon), diğer/yok → 5.
 */
export function getMaxUploads(status: SubmissionStatus | null): number {
  if (status === "completed") return 0;
  if (status === "revision") return 8;
  return 5;
}

/** Sıra numaralı güvenli dosya adı: "01-dosya.pdf" (Drive'da bu adla yazılır). */
function generateActualFileName(sequence: number, originalFileName: string): string {
  return `${String(sequence).padStart(2, "0")}-${originalFileName}`;
}

async function requireOwnedPerson(
  personId: EntityId,
  requesterUid: string,
  deps: Pick<SubmissionDeps, "persons">,
  tenantId: string,
) {
  const person = await deps.persons.getById(personId, tenantId);
  if (!person) throw new ValidationError("Kişi bulunamadı.");
  if (person.authUid !== requesterUid) throw new ForbiddenError("submission.own");
  return person;
}

async function currentActiveFileCount(
  submission: Submission | null,
  deps: Pick<SubmissionDeps, "submissionFiles">,
  tenantId: string,
) {
  if (!submission) return 0;
  return (await deps.submissionFiles.listActiveBySubmission(submission.id, tenantId)).length;
}

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
}

/**
 * Resumable upload başlat — öğrenci-tarafı, capability sistemi DIŞINDA (sahiplik
 * kontrolü: `person.authUid === requesterUid`). Canlıdaki `init-resumable-upload`
 * route'unun TEK canonical karşılığı.
 */
export async function initUpload(input: InitUploadInput, deps: SubmissionDeps): Promise<InitUploadResult> {
  const { tenantId } = input;
  const person = await requireOwnedPerson(input.personId, input.requesterUid, deps, tenantId);

  const assignment = await deps.assignments.getById(input.assignmentId, tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");

  const group = await deps.groups.getById(assignment.groupId, tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");

  const enrollment = await deps.enrollments.findActive(input.personId, assignment.groupId, tenantId);
  if (!enrollment) throw new ValidationError("Bu gruba kayıtlı değilsiniz.");

  if (input.fileSize > MAX_RESUMABLE_FILE_SIZE_BYTES) {
    throw new ValidationError(`Dosya boyutu ${MAX_RESUMABLE_FILE_SIZE_LABEL} sınırını aşıyor.`);
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    throw new ValidationError(`İzin verilmeyen dosya türü: ${input.mimeType}`);
  }

  const existing = await deps.submissions.findByAssignmentAndPerson(input.assignmentId, input.personId, tenantId);
  const currentUploads = await currentActiveFileCount(existing, deps, tenantId);
  const maxUploads = getMaxUploads(existing?.status ?? null);
  if (currentUploads >= maxUploads) {
    throw new ValidationError("Yükleme hakkınız doldu.");
  }

  const actualFileName = generateActualFileName(currentUploads + 1, input.fileName);
  const folderId = await deps.drive.ensureFolderPath([
    "flexos",
    tenantId,
    group.code,
    `${person.firstName} ${person.lastName}`,
    assignment.title,
  ]);
  const sessionUri = await deps.drive.initResumableSession(actualFileName, input.fileSize, input.mimeType, folderId);

  const session: UploadSession = {
    id: deps.uploadSessions.nextId(),
    tenantId,
    assignmentId: input.assignmentId,
    groupId: assignment.groupId,
    personId: input.personId,
    uploaderUid: input.requesterUid,
    originalFileName: input.fileName,
    actualFileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    sessionUri,
    folderId,
    folderPath: `flexos/${tenantId}/${group.code}/${person.firstName} ${person.lastName}/${assignment.title}`,
    status: "uploading",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: nowISO(),
    createdBy: input.requesterUid,
  };
  await deps.uploadSessions.save(session);

  return { session, currentUploads, maxUploads };
}

export interface GetChunkSessionInput {
  requesterUid: string;
  tenantId: string;
  uploadId: string;
}

/** `upload-chunk` route'unun ihtiyaç duyduğu sahiplik+durum doğrulaması (proxy'nin kendisi route'ta). */
export async function getSessionForChunk(
  input: GetChunkSessionInput,
  deps: Pick<SubmissionDeps, "uploadSessions">,
): Promise<UploadSession> {
  const session = await deps.uploadSessions.getById(input.uploadId, input.tenantId);
  if (!session) throw new ValidationError("Yükleme oturumu bulunamadı.");
  if (session.uploaderUid !== input.requesterUid) throw new ForbiddenError("submission.own");
  if (session.status === "completed") throw new ValidationError("Bu oturum zaten tamamlandı.");
  if (new Date(session.expiresAt).getTime() < Date.now()) throw new ValidationError("Yükleme oturumunun süresi doldu.");
  return session;
}

export interface CompleteUploadInput {
  requesterUid: string;
  tenantId: string;
  uploadId: string;
  driveFileId?: string;
  note?: string;
}

/**
 * Resumable upload'ı tamamla — Submission (yoksa oluşturur, varsa iterasyonunu artırır)
 * + SubmissionFile (yeni versiyon) yazar, UploadSession'ı `completed`'a çeker.
 * Canlıdaki `complete-upload`'un TEK canonical karşılığı.
 */
export async function completeUpload(input: CompleteUploadInput, deps: SubmissionDeps): Promise<Submission> {
  const { tenantId } = input;
  const session = await getSessionForChunk(
    { requesterUid: input.requesterUid, tenantId, uploadId: input.uploadId },
    deps,
  );

  const assignment = await deps.assignments.getById(session.assignmentId, tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");

  let existing = await deps.submissions.findByAssignmentAndPerson(session.assignmentId, session.personId, tenantId);
  const currentUploads = await currentActiveFileCount(existing, deps, tenantId);
  const maxUploads = getMaxUploads(existing?.status ?? null);
  if (currentUploads >= maxUploads) {
    throw new ValidationError("Yükleme hakkınız doldu.");
  }

  const driveFileId =
    input.driveFileId ?? (await deps.drive.findFileByActualName(session.actualFileName, session.folderId))?.id;
  if (!driveFileId) throw new ValidationError("Yüklenen dosya Drive'da bulunamadı.");
  await deps.drive.setPublicReadPermission(driveFileId);

  const now = nowISO();

  if (!existing) {
    existing = {
      id: deps.submissions.nextId(),
      tenantId,
      assignmentId: session.assignmentId,
      groupId: session.groupId,
      personId: session.personId,
      status: "submitted",
      iteration: 1,
      isLate: assignment.dueDate ? Date.now() > new Date(assignment.dueDate).getTime() : false,
      note: input.note,
      submittedAt: now,
      lastSubmittedAt: now,
      createdAt: now,
      createdBy: input.requesterUid,
    };
  } else {
    existing = {
      ...existing,
      status: existing.status === "revision" || existing.status === "retracted" ? "submitted" : existing.status,
      iteration: existing.iteration + 1,
      note: input.note ?? existing.note,
      lastSubmittedAt: now,
      updatedAt: now,
      updatedBy: input.requesterUid,
    };
  }
  await deps.submissions.save(existing);

  const activeFiles = await deps.submissionFiles.listActiveBySubmission(existing.id, tenantId);
  for (const f of activeFiles) {
    if (f.isLatest) await deps.submissionFiles.save({ ...f, isLatest: false });
  }

  const file: SubmissionFile = {
    id: deps.submissionFiles.nextId(),
    tenantId,
    submissionId: existing.id,
    driveFileId,
    driveViewLink: `https://drive.google.com/file/d/${driveFileId}/view`,
    fileName: session.originalFileName,
    fileSize: session.fileSize,
    mimeType: session.mimeType,
    versionNo: activeFiles.length + 1,
    isLatest: true,
    createdAt: now,
    createdBy: input.requesterUid,
  };
  await deps.submissionFiles.save(file);

  await deps.uploadSessions.save({
    ...session,
    status: "completed",
    driveFileId,
    submissionId: existing.id,
    updatedAt: now,
    updatedBy: input.requesterUid,
  });

  return existing;
}

export interface DeleteFileInput {
  requesterUid: string;
  tenantId: string;
  submissionId: EntityId;
  fileId: EntityId;
}

/** Öğrenci kendi (tamamlanmamış) teslimindeki bir dosyayı siler — canlıdaki `delete-file`. */
export async function deleteFile(
  input: DeleteFileInput,
  deps: Pick<SubmissionDeps, "persons" | "submissions" | "submissionFiles" | "drive">,
): Promise<void> {
  const { tenantId } = input;
  const submission = await deps.submissions.getById(input.submissionId, tenantId);
  if (!submission) throw new ValidationError("Teslim bulunamadı.");
  await requireOwnedPerson(submission.personId, input.requesterUid, deps, tenantId);
  if (submission.status === "completed") throw new ValidationError("Tamamlanmış teslimden dosya silinemez.");

  const file = await deps.submissionFiles.getById(input.fileId, tenantId);
  if (!file || file.submissionId !== input.submissionId || file.deleted) {
    throw new ValidationError("Dosya bulunamadı.");
  }

  await deps.drive.deleteFromDrive(file.driveFileId);

  const now = nowISO();
  await deps.submissionFiles.save({ ...file, deleted: true, deletedAt: now, deletedBy: input.requesterUid, isLatest: false });

  if (file.isLatest) {
    const remaining = await deps.submissionFiles.listActiveBySubmission(input.submissionId, tenantId);
    const newLatest = remaining.sort((a, b) => b.versionNo - a.versionNo)[0];
    if (newLatest) await deps.submissionFiles.save({ ...newLatest, isLatest: true });
  }
}

export interface RetractInput {
  requesterUid: string;
  tenantId: string;
  submissionId: EntityId;
}

const STUDENT_RETRACTABLE: SubmissionStatus[] = ["submitted", "revision"];

/**
 * Öğrenci kendi teslimini geri çeker — canlıdaki `retract`. Canlının aksine (hard-delete)
 * doküman izi kalır (`status:"retracted"`), aktif dosyalar soft-delete edilir; bir sonraki
 * yüklemede döngü normal şekilde yeniden başlar.
 */
export async function retract(
  input: RetractInput,
  deps: Pick<SubmissionDeps, "persons" | "assignments" | "submissions" | "submissionFiles" | "drive">,
): Promise<void> {
  const { tenantId } = input;
  const submission = await deps.submissions.getById(input.submissionId, tenantId);
  if (!submission) throw new ValidationError("Teslim bulunamadı.");
  await requireOwnedPerson(submission.personId, input.requesterUid, deps, tenantId);

  if (!STUDENT_RETRACTABLE.includes(submission.status)) {
    throw new ValidationError("Bu durumdaki teslim geri çekilemez.");
  }
  if (submission.grade !== undefined) throw new ValidationError("Notlandırılmış teslim geri çekilemez.");

  const assignment = await deps.assignments.getById(submission.assignmentId, tenantId);
  if (assignment?.dueDate && Date.now() > new Date(assignment.dueDate).getTime()) {
    throw new ValidationError("Son teslim tarihi geçti, geri çekilemez.");
  }

  const now = nowISO();
  const activeFiles = await deps.submissionFiles.listActiveBySubmission(input.submissionId, tenantId);
  for (const f of activeFiles) {
    await deps.drive.deleteFromDrive(f.driveFileId);
    await deps.submissionFiles.save({ ...f, deleted: true, deletedAt: now, deletedBy: input.requesterUid, isLatest: false });
  }

  await deps.submissions.save({
    ...submission,
    status: "retracted",
    retractedAt: now,
    updatedAt: now,
    updatedBy: input.requesterUid,
  });
}

// ── Eğitmen/Operasyon — durum + not (capability-gated, TEK servis) ──

const VALID_STAFF_STATUSES: SubmissionStatus[] = ["submitted", "reviewing", "revision", "completed"];

async function requireGroupScope(
  actor: Actor,
  capability: string,
  groupId: EntityId,
  deps: Pick<SubmissionDeps, "groups">,
  tenantId: string,
) {
  const group = await deps.groups.getById(groupId, tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");
  if (!can(actor, capability, { groupId, ownerUid: group.trainerId })) throw new ForbiddenError(capability);
}

/**
 * Teslim durumunu güncelle — gated (`submission.status.write`). Canlıdaki 3 dağınık
 * yoldan (status route / grade route / oyun ekranlarındaki `tasks` updateDoc) TEK servise.
 */
export async function updateSubmissionStatus(
  actor: Actor,
  submissionId: EntityId,
  status: SubmissionStatus,
  deps: Pick<SubmissionDeps, "submissions" | "groups">,
): Promise<Submission> {
  if (!VALID_STAFF_STATUSES.includes(status)) throw new ValidationError("Geçersiz durum.");

  const existing = await deps.submissions.getById(submissionId, actor.tenantId);
  if (!existing) throw new ValidationError("Teslim bulunamadı.");

  await requireGroupScope(actor, "submission.status.write", existing.groupId, deps, actor.tenantId);

  const updated: Submission = { ...existing, status, updatedAt: nowISO(), updatedBy: actor.uid };
  await deps.submissions.save(updated);
  return updated;
}

/** Teslimi notlandır — gated (`submission.grade`). 0-100 aralığı. */
export async function gradeSubmission(
  actor: Actor,
  submissionId: EntityId,
  grade: number,
  deps: Pick<SubmissionDeps, "submissions" | "groups">,
): Promise<Submission> {
  if (!Number.isFinite(grade) || grade < 0 || grade > 100) throw new ValidationError("Not 0-100 aralığında olmalı.");

  const existing = await deps.submissions.getById(submissionId, actor.tenantId);
  if (!existing) throw new ValidationError("Teslim bulunamadı.");

  await requireGroupScope(actor, "submission.grade", existing.groupId, deps, actor.tenantId);

  const updated: Submission = {
    ...existing,
    grade,
    gradedAt: nowISO(),
    gradedBy: actor.uid,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await deps.submissions.save(updated);
  return updated;
}

/** Teslim listesi (eğitmen/op) — gated (`submission.read`). Assigned-scope filtre route'ta (trainerId). */
export async function listSubmissionsForAssignment(
  actor: Actor,
  assignmentId: EntityId,
  deps: Pick<SubmissionDeps, "submissions">,
): Promise<Submission[]> {
  if (!can(actor, "submission.read")) throw new ForbiddenError("submission.read");
  return deps.submissions.listByAssignment(assignmentId, actor.tenantId);
}

export async function listSubmissionsForGroup(
  actor: Actor,
  groupId: EntityId,
  deps: Pick<SubmissionDeps, "submissions">,
): Promise<Submission[]> {
  if (!can(actor, "submission.read")) throw new ForbiddenError("submission.read");
  return deps.submissions.listByGroup(groupId, actor.tenantId);
}

// ── Öğrenci dashboard/detay — sahiplik-gated (capability dışı) ──

/** Öğrenci dashboard'u — kişinin aktif olduğu grup(lar)daki yayınlanmış ödevler + kendi teslim durumu. */
export async function listAssignmentsForStudent(
  requesterUid: string,
  tenantId: string,
  personId: EntityId,
  deps: Pick<SubmissionDeps, "persons" | "enrollments" | "assignments" | "submissions">,
): Promise<{ assignment: Assignment; submission: Submission | null }[]> {
  await requireOwnedPerson(personId, requesterUid, deps, tenantId);

  const enrollments = await deps.enrollments.listByPerson(personId, tenantId);
  const groupIds = [...new Set(enrollments.filter((e) => e.status === "active" && e.groupId).map((e) => e.groupId as string))];
  if (groupIds.length === 0) return [];

  const assignmentLists = await Promise.all(groupIds.map((gid) => deps.assignments.list(tenantId, gid)));
  const assignments = assignmentLists.flat().filter((a) => a.status === "published");

  const submissions = await Promise.all(
    assignments.map((a) => deps.submissions.findByAssignmentAndPerson(a.id, personId, tenantId)),
  );
  return assignments.map((assignment, i) => ({ assignment, submission: submissions[i] }));
}

/** Ödev detay + yükleme sayfası — tek ödev + kendi submission'ı + aktif dosyaları. */
export async function getAssignmentForStudent(
  requesterUid: string,
  tenantId: string,
  personId: EntityId,
  assignmentId: EntityId,
  deps: Pick<SubmissionDeps, "persons" | "enrollments" | "assignments" | "submissions" | "submissionFiles">,
): Promise<{ assignment: Assignment; submission: Submission | null; files: SubmissionFile[] }> {
  await requireOwnedPerson(personId, requesterUid, deps, tenantId);

  const assignment = await deps.assignments.getById(assignmentId, tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");

  const enrollment = await deps.enrollments.findActive(personId, assignment.groupId, tenantId);
  if (!enrollment) throw new ValidationError("Bu gruba kayıtlı değilsiniz.");

  const submission = await deps.submissions.findByAssignmentAndPerson(assignmentId, personId, tenantId);
  const files = submission ? await deps.submissionFiles.listActiveBySubmission(submission.id, tenantId) : [];
  return { assignment, submission, files };
}
