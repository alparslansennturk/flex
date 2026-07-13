import { ALLOWED_MIME_TYPES, MAX_RESUMABLE_FILE_SIZE_BYTES, MAX_RESUMABLE_FILE_SIZE_LABEL } from "../../../types/storage";
import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Submission, SubmissionFile, SubmissionStatus, UploadSession } from "../core/submission";
import { ForbiddenError, ValidationError } from "../errors";
import type { Assignment, AssignmentAttachment, AssignmentKind } from "../core/assignment";
import type { AssignmentRepo } from "../repo/assignment-repo";
import type { DriveDeps } from "../repo/drive-deps";
import type { EnrollmentRepo } from "../repo/enrollment-repo";
import type { Group } from "../core/group";
import type { GroupRepo } from "../repo/group-repo";
import type { PersonRepo } from "../repo/person-repo";
import type { SubmissionFileRepo } from "../repo/submission-file-repo";
import type { SubmissionRepo } from "../repo/submission-repo";
import type { TrainerRepo } from "../repo/trainer-repo";
import type { UploadSessionRepo } from "../repo/upload-session-repo";
import type { NotifyInput } from "./comment-service";

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
  trainers: TrainerRepo;
  drive: DriveDeps;
  notify: (uid: string, input: NotifyInput) => Promise<void>;
}

/**
 * Drive klasör hiyerarşisi — TÜM upload akışları (öğrenci teslimi + eğitmen eki) için TEK
 * kaynak (2026-07-08 kararı, kullanıcı: "çok eğitmen kullanacaksa ayırt edebilmeliyiz"):
 * `{eğitmenAdı}/{branş}/{grupKodu}/{ödevAdı}/{leaf}` — `leaf` öğrenci teslimi için
 * öğrencinin adı, eğitmen eki için sabit `"Eğitmen"`. Eğitmen atanmamışsa/branş yoksa
 * okunabilir bir yer tutucuya düşer (Drive'da boş segment olamaz).
 */
async function resolveAssignmentFolderSegments(
  group: Group,
  assignmentTitle: string,
  leaf: string,
  tenantId: string,
  deps: Pick<SubmissionDeps, "trainers">,
): Promise<string[]> {
  const trainer = group.trainerId ? await deps.trainers.getById(group.trainerId, tenantId) : null;
  return [trainer?.name ?? "Atanmamış Eğitmen", group.branch ?? "Branşsız", group.code, assignmentTitle, leaf];
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
  const folderSegments = await resolveAssignmentFolderSegments(
    group, assignment.title, `${person.firstName} ${person.lastName}`, tenantId, deps,
  );
  const folderId = await deps.drive.ensureFolderPath(folderSegments);
  const sessionUri = await deps.drive.initResumableSession(actualFileName, input.fileSize, input.mimeType, folderId);

  const session: UploadSession = {
    id: deps.uploadSessions.nextId(),
    tenantId,
    kind: "submission",
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
    folderPath: folderSegments.join("/"),
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
  if (session.kind !== "submission" || !session.personId) throw new ValidationError("Geçersiz teslim oturumu.");
  const personId = session.personId;

  const assignment = await deps.assignments.getById(session.assignmentId, tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");

  let existing = await deps.submissions.findByAssignmentAndPerson(session.assignmentId, personId, tenantId);
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
      personId,
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

const MAX_ASSIGNMENT_ATTACHMENTS = 10;

export interface InitAttachmentUploadInput {
  assignmentId: EntityId;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Eğitmenin ödeve referans/başlangıç dosyası eklemesi — gated `assignment.edit`
 * (2026-07-08 eklendi). Öğrenci teslimiyle AYNI resumable-upload altyapısı (chunk
 * proxy `submissions/upload-chunk` route'u ikisi için de ortak) ama farklı hedef:
 * `Submission` değil, doğrudan `Assignment.attachments`. Klasör: `.../Eğitmen`
 * (bkz. `resolveAssignmentFolderSegments`).
 */
export async function initAttachmentUpload(
  actor: Actor,
  input: InitAttachmentUploadInput,
  deps: Pick<SubmissionDeps, "assignments" | "groups" | "trainers" | "drive" | "uploadSessions">,
): Promise<UploadSession> {
  const assignment = await deps.assignments.getById(input.assignmentId, actor.tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");
  const group = await deps.groups.getById(assignment.groupId, actor.tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");
  if (!can(actor, "assignment.edit", { groupId: assignment.groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("assignment.edit");
  }

  if (input.fileSize > MAX_RESUMABLE_FILE_SIZE_BYTES) {
    throw new ValidationError(`Dosya boyutu ${MAX_RESUMABLE_FILE_SIZE_LABEL} sınırını aşıyor.`);
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    throw new ValidationError(`İzin verilmeyen dosya türü: ${input.mimeType}`);
  }
  const currentCount = assignment.attachments?.length ?? 0;
  if (currentCount >= MAX_ASSIGNMENT_ATTACHMENTS) {
    throw new ValidationError(`En fazla ${MAX_ASSIGNMENT_ATTACHMENTS} dosya eklenebilir.`);
  }

  const actualFileName = generateActualFileName(currentCount + 1, input.fileName);
  const folderSegments = await resolveAssignmentFolderSegments(group, assignment.title, "Eğitmen", actor.tenantId, deps);
  const folderId = await deps.drive.ensureFolderPath(folderSegments);
  const sessionUri = await deps.drive.initResumableSession(actualFileName, input.fileSize, input.mimeType, folderId);

  const session: UploadSession = {
    id: deps.uploadSessions.nextId(),
    tenantId: actor.tenantId,
    kind: "attachment",
    assignmentId: input.assignmentId,
    groupId: assignment.groupId,
    uploaderUid: actor.uid,
    originalFileName: input.fileName,
    actualFileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    sessionUri,
    folderId,
    folderPath: folderSegments.join("/"),
    status: "uploading",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: nowISO(),
    createdBy: actor.uid,
  };
  await deps.uploadSessions.save(session);
  return session;
}

export interface CompleteAttachmentUploadInput {
  uploadId: string;
  driveFileId?: string;
}

/** Eğitmen eki yükleme oturumunu tamamlar — `Assignment.attachments`'a ekler. */
export async function completeAttachmentUpload(
  actor: Actor,
  input: CompleteAttachmentUploadInput,
  deps: Pick<SubmissionDeps, "assignments" | "groups" | "uploadSessions" | "drive">,
): Promise<Assignment> {
  const session = await getSessionForChunk(
    { requesterUid: actor.uid, tenantId: actor.tenantId, uploadId: input.uploadId },
    deps,
  );
  if (session.kind !== "attachment") throw new ValidationError("Geçersiz ek yükleme oturumu.");

  const assignment = await deps.assignments.getById(session.assignmentId, actor.tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");
  const group = await deps.groups.getById(assignment.groupId, actor.tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");
  if (!can(actor, "assignment.edit", { groupId: assignment.groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("assignment.edit");
  }

  const driveFileId =
    input.driveFileId ?? (await deps.drive.findFileByActualName(session.actualFileName, session.folderId))?.id;
  if (!driveFileId) throw new ValidationError("Yüklenen dosya Drive'da bulunamadı.");
  await deps.drive.setPublicReadPermission(driveFileId);

  const attachment: AssignmentAttachment = {
    id: globalThis.crypto.randomUUID(),
    driveFileId,
    fileName: session.originalFileName,
    mimeType: session.mimeType,
    fileSize: session.fileSize,
    webViewLink: `https://drive.google.com/file/d/${driveFileId}/view`,
  };
  const now = nowISO();
  const updated: Assignment = {
    ...assignment,
    attachments: [...(assignment.attachments ?? []), attachment],
    updatedAt: now,
    updatedBy: actor.uid,
  };
  await deps.assignments.save(updated);

  await deps.uploadSessions.save({ ...session, status: "completed", driveFileId, updatedAt: now, updatedBy: actor.uid });
  return updated;
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
 *
 * **"Revize İste"/"Onayla" bildirimi (2026-07-08 kararı, canlı `assignment-test/
 * submissions/[id]/status` route'uyla birebir):** `revision`/`completed` durumuna
 * geçince öğrenciye (varsa `authUid`) bildirim gider — revizyonda "Revize İstendi",
 * onayda "Ödeviniz Onaylandı! 🎉". `revision`'a geçince öğrencinin yükleme hakkı
 * otomatik 8'e çıkar (`getMaxUploads`, davranış zaten vardı — burada sadece TETİKLEYİCİ
 * eklendi). Bildirim non-fatal (`notifyUser` zaten try/catch'li) — başarısız olsa da
 * durum güncellemesi geri alınmaz.
 */
export async function updateSubmissionStatus(
  actor: Actor,
  submissionId: EntityId,
  status: SubmissionStatus,
  deps: Pick<SubmissionDeps, "submissions" | "groups" | "persons" | "assignments" | "notify">,
): Promise<Submission> {
  if (!VALID_STAFF_STATUSES.includes(status)) throw new ValidationError("Geçersiz durum.");

  const existing = await deps.submissions.getById(submissionId, actor.tenantId);
  if (!existing) throw new ValidationError("Teslim bulunamadı.");

  await requireGroupScope(actor, "submission.status.write", existing.groupId, deps, actor.tenantId);

  const updated: Submission = { ...existing, status, updatedAt: nowISO(), updatedBy: actor.uid };
  await deps.submissions.save(updated);

  if (status === "revision" || status === "completed") {
    const [person, assignment] = await Promise.all([
      deps.persons.getById(existing.personId, actor.tenantId),
      deps.assignments.getById(existing.assignmentId, actor.tenantId),
    ]);
    if (person?.authUid) {
      const title = assignment?.title ?? "Ödeviniz";
      const isRevision = status === "revision";
      await deps.notify(person.authUid, {
        type: isRevision ? "message" : "assignment",
        entityId: existing.assignmentId,
        senderId: actor.uid,
        title: isRevision ? "Revize İstendi" : "Ödeviniz Onaylandı! 🎉",
        preview: isRevision ? `"${title}" için revize istendi.` : `"${title}" tamamlandı, tebrikler!`,
        actionUrl: `/flexos/student/${existing.personId}/${existing.assignmentId}`,
      });
    }
  }

  return updated;
}

/**
 * Teslimi notlandır — gated (`submission.grade`). Aralık `0..assignment.maxPuan`
 * (belirtilmemişse 100) — ödevler farklı ağırlıkta olabilir (100/200/300).
 */
export async function gradeSubmission(
  actor: Actor,
  submissionId: EntityId,
  grade: number,
  deps: Pick<SubmissionDeps, "submissions" | "groups" | "assignments">,
): Promise<Submission> {
  const existing = await deps.submissions.getById(submissionId, actor.tenantId);
  if (!existing) throw new ValidationError("Teslim bulunamadı.");

  const assignment = await deps.assignments.getById(existing.assignmentId, actor.tenantId);
  const maxPuan = assignment?.maxPuan ?? 100;
  if (!Number.isFinite(grade) || grade < 0 || grade > maxPuan) {
    throw new ValidationError(`Not 0-${maxPuan} aralığında olmalı.`);
  }

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

/**
 * Manuel not — GERÇEK dijital teslim (Submission) olmasa bile eğitmenin doğrudan not
 * vermesi (gated `submission.grade`, `gradeSubmission` ile AYNI yetki). 2026-07-13
 * kullanıcı kararı: eski/legacy ödevlerde dijital iz hiç olmayabilir (fiziksel teslim,
 * WhatsApp/e-posta vb. sistem dışı) — "ben eğitmenim, canım istedi verdim, sistem
 * karışamaz". Gerçek `Submission` zaten varsa `gradeSubmission` ile AYNI şekilde
 * günceller; yoksa dosyasız, doğrudan notu taşıyan yeni bir `Submission` açar
 * (`note` alanına elle işaretlendiği yazılır, ileride ayırt edilebilsin diye).
 */
export async function gradeManually(
  actor: Actor,
  input: { assignmentId: EntityId; personId: EntityId; groupId: EntityId; isLate: boolean; grade: number },
  deps: Pick<SubmissionDeps, "submissions" | "groups" | "assignments">,
): Promise<Submission> {
  await requireGroupScope(actor, "submission.grade", input.groupId, deps, actor.tenantId);

  const assignment = await deps.assignments.getById(input.assignmentId, actor.tenantId);
  const maxPuan = assignment?.maxPuan ?? 100;
  if (!Number.isFinite(input.grade) || input.grade < 0 || input.grade > maxPuan) {
    throw new ValidationError(`Not 0-${maxPuan} aralığında olmalı.`);
  }

  const existing = await deps.submissions.findByAssignmentAndPerson(input.assignmentId, input.personId, actor.tenantId);
  const now = nowISO();
  const updated: Submission = existing
    ? { ...existing, grade: input.grade, gradedAt: now, gradedBy: actor.uid, updatedAt: now, updatedBy: actor.uid }
    : {
        id: deps.submissions.nextId(),
        tenantId: actor.tenantId,
        assignmentId: input.assignmentId,
        groupId: input.groupId,
        personId: input.personId,
        status: "completed",
        iteration: 1,
        isLate: input.isLate,
        note: "Eğitmen tarafından elle işaretlendi (dijital teslim kaydı yok).",
        submittedAt: now,
        lastSubmittedAt: now,
        grade: input.grade,
        gradedAt: now,
        gradedBy: actor.uid,
        createdAt: now,
        createdBy: actor.uid,
        updatedAt: now,
        updatedBy: actor.uid,
      };
  await deps.submissions.save(updated);
  return updated;
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

/**
 * TOPLU notlama (2026-07-13 kota fix) — bir ödevin TÜM öğrenci notlarını TEK istekte işler.
 * Eskiden `odev-notu` sayfası öğrenci başına ayrı `grade`/`manual-grade` PATCH/POST atıyordu
 * (N+2 istek, her biri grup+ödev+kimlik'i yeniden okuyordu). Burada grup+ödev+teslim listesi
 * SADECE BİR KEZ okunur, tüm yazmalar toplanır, çağıran route TEK `broadcast` yapar.
 *
 * İş kuralı `gradeSubmission`+`gradeManually` ile birebir aynı: gerçek teslimi olan güncellenir;
 * teslimi olmayan ama not>0 (elle "teslim etti/gecikmeli" işaretlenen) için dosyasız yeni
 * `Submission` açılır; teslimi olmayan + not 0 (dokunulmamış "teslim etmedi") ATLANIR (7 default
 * öğrenciye boşuna kayıt açılmaz — sertifika hesabı zaten payda'da 0 sayar).
 */
export async function gradeBatch(
  actor: Actor,
  input: { assignmentId: EntityId; groupId: EntityId; items: BatchGradeItem[]; archive?: boolean },
  deps: Pick<SubmissionDeps, "submissions" | "groups" | "assignments">,
): Promise<BatchGradeResult> {
  await requireGroupScope(actor, "submission.grade", input.groupId, deps, actor.tenantId);

  const assignment = await deps.assignments.getById(input.assignmentId, actor.tenantId);
  const maxPuan = assignment?.maxPuan ?? 100;

  const existing = await deps.submissions.listByAssignment(input.assignmentId, actor.tenantId);
  const byPerson = new Map(existing.map((s) => [s.personId, s]));

  const now = nowISO();
  const writes: Submission[] = [];
  const result: BatchGradeResult = { graded: 0, created: 0, skipped: 0, archived: false };

  for (const item of input.items) {
    if (!Number.isFinite(item.grade) || item.grade < 0 || item.grade > maxPuan) {
      throw new ValidationError(`Not 0-${maxPuan} aralığında olmalı.`);
    }
    const sub = byPerson.get(item.personId);
    if (sub) {
      writes.push({ ...sub, grade: item.grade, gradedAt: now, gradedBy: actor.uid, updatedAt: now, updatedBy: actor.uid });
      result.graded += 1;
    } else if (item.grade > 0) {
      writes.push({
        id: deps.submissions.nextId(),
        tenantId: actor.tenantId,
        assignmentId: input.assignmentId,
        groupId: input.groupId,
        personId: item.personId,
        status: "completed",
        iteration: 1,
        isLate: item.isLate,
        note: "Eğitmen tarafından elle işaretlendi (dijital teslim kaydı yok).",
        submittedAt: now,
        lastSubmittedAt: now,
        grade: item.grade,
        gradedAt: now,
        gradedBy: actor.uid,
        createdAt: now,
        createdBy: actor.uid,
        updatedAt: now,
        updatedBy: actor.uid,
      });
      result.created += 1;
    } else {
      result.skipped += 1; // teslimi yok + 0 → yazma
    }
  }

  await Promise.all(writes.map((s) => deps.submissions.save(s)));

  if (input.archive && assignment) {
    await deps.assignments.save({ ...assignment, status: "archived", updatedAt: now, updatedBy: actor.uid });
    result.archived = true;
  }
  return result;
}

/**
 * Ödev Notu'nun İÇ ağırlıklandırması (2026-07-06 kararı, SABİT iş kuralı — Sertifika
 * Ayarları'ndaki dışsal Sertifika/Ödev ağırlığından TAMAMEN AYRI bir eksen):
 * `normal` ödevler nihai Ödev Notu'na %30, `proje` ödevler %70 ağırlıkla katkı yapar.
 * Bir kategori hiç yoksa (o türde yayınlanmış ödev yok) ağırlık diğer kategoriye
 * TAMAMEN kayar (100%) — eksik kategori kimseyi cezalandırmaz.
 */
export const ODEV_TUR_AGIRLIK: Record<AssignmentKind, number> = { normal: 30, proje: 70 };

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

function bosKategori(): OdevKategoriSonucu {
  return { totalMaxPuan: 0, earnedByPerson: {} };
}

/**
 * Ödev Notu hesabının ham girdisi — grup içindeki TÜM yayınlanmış ödevler `kind`'a göre
 * `normal`/`proje` diye ikiye ayrılır, her kategori için ayrı ayrı `maxPuan` toplamı
 * (payda) + kazanılan `Submission.grade` toplamı (pay) OKUMA ANINDA hesaplanır
 * (manuel giriş YOK, teslim/not değiştikçe otomatik güncellenir). Nihai yüzdeye
 * çevirme + ağırlıklandırma `combineOdevYuzdesi()`'ye bırakılır.
 */
export async function computeOdevYuzdeleri(
  tenantId: string,
  groupId: EntityId,
  deps: Pick<SubmissionDeps, "assignments" | "submissions">,
): Promise<OdevYuzdeleriResult> {
  const [assignments, submissions] = await Promise.all([
    deps.assignments.list(tenantId, groupId),
    deps.submissions.listByGroup(groupId, tenantId),
  ]);

  // 2026-07-12 fix: SADECE "published" filtrelemek `computeOdevYuzdeleri`'yi "Notları
  // Kaydet"in artık HER ZAMAN sonunda ödevi "archived"a çektiği akışla (bkz. odev-notu
  // sayfası) çelişkiye düşürüyordu — bir ödevin notu girilip kaydedildiği AN o ödev
  // hem payda (maxPuan) hem pay (kazanılan puan) hesabından TAMAMEN düşüyordu, yani
  // gerçek `Submission.grade` veritabanında dururken Ödev Notu yüzdesine hiç
  // yansımıyordu. Draft (henüz yayınlanmamış, öğrenciye hiç gitmemiş) hariç HER durum
  // (`published`/`closed`/`archived`) sayılmalı — öğrenciye bir kez atanan ödev, notu
  // girildikten/ödev arşivlendikten sonra da hesaba dahil kalmalı.
  const published = assignments.filter((a) => a.status !== "draft");
  const result: OdevYuzdeleriResult = { normal: bosKategori(), proje: bosKategori() };
  const kindByAssignmentId = new Map<string, AssignmentKind>();

  for (const a of published) {
    const kind: AssignmentKind = a.kind ?? "normal";
    kindByAssignmentId.set(a.id, kind);
    result[kind].totalMaxPuan += a.maxPuan ?? 100;
  }

  for (const s of submissions) {
    const kind = kindByAssignmentId.get(s.assignmentId);
    if (!kind || s.grade == null) continue;
    const kategori = result[kind];
    kategori.earnedByPerson[s.personId] = (kategori.earnedByPerson[s.personId] ?? 0) + s.grade;
  }

  return result;
}

/**
 * Ödev Notu'nun nihai yüzdesi — `normal` %30 + `proje` %70 ağırlıklı (bkz. `ODEV_TUR_AGIRLIK`).
 * Bir kategori hiç yoksa ağırlık tamamen diğerine kayar. İkisi de yoksa `null` (veri yok —
 * sertifika hesabı bu durumda yalnız Sertifika Notu'na düşer, `CertificateSettings` ağırlığı
 * ne olursa olsun).
 */
export function combineOdevYuzdesi(result: OdevYuzdeleriResult, personId: string): number | null {
  const normalOran = result.normal.totalMaxPuan > 0
    ? (result.normal.earnedByPerson[personId] ?? 0) / result.normal.totalMaxPuan
    : null;
  const projeOran = result.proje.totalMaxPuan > 0
    ? (result.proje.earnedByPerson[personId] ?? 0) / result.proje.totalMaxPuan
    : null;

  if (normalOran == null && projeOran == null) return null;
  if (normalOran == null) return Math.round(projeOran! * 100);
  if (projeOran == null) return Math.round(normalOran * 100);
  return Math.round(normalOran * ODEV_TUR_AGIRLIK.normal + projeOran * ODEV_TUR_AGIRLIK.proje);
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
  // "published" yerine "draft" hariç HER durum — aksi halde eğitmen notu girip ödevi
  // arşivleyince (bkz. `computeOdevYuzdeleri` yukarıdaki fix) öğrenci kendi teslim ettiği
  // ve NOTU GİRİLMİŞ ödevi dashboard'unda bir daha hiç göremezdi.
  const assignments = assignmentLists.flat().filter((a) => a.status !== "draft");

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

/** Tek bir teslimin dosyaları + sahibi — eğitmen/op master-detail ekranı (gated `submission.read`). */
export async function getSubmissionForStaff(
  actor: Actor,
  submissionId: EntityId,
  deps: Pick<SubmissionDeps, "submissions" | "submissionFiles" | "groups" | "persons">,
): Promise<{ submission: Submission; files: SubmissionFile[]; person: { id: string; firstName: string; lastName: string } | null }> {
  const submission = await deps.submissions.getById(submissionId, actor.tenantId);
  if (!submission) throw new ValidationError("Teslim bulunamadı.");

  const group = await deps.groups.getById(submission.groupId, actor.tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");
  if (!can(actor, "submission.read", { groupId: submission.groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("submission.read");
  }

  const files = await deps.submissionFiles.listActiveBySubmission(submissionId, actor.tenantId);
  const person = await deps.persons.getById(submission.personId, actor.tenantId);
  return { submission, files, person: person ? { id: person.id, firstName: person.firstName, lastName: person.lastName } : null };
}
