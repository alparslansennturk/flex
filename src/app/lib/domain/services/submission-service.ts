import { ALLOWED_MIME_TYPES, MAX_RESUMABLE_FILE_SIZE_BYTES, MAX_RESUMABLE_FILE_SIZE_LABEL } from "../../../types/storage";
import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Submission, SubmissionFile, SubmissionStatus, UploadSession } from "../core/submission";
import { ForbiddenError, ValidationError } from "../errors";
import type { Assignment, AssignmentAttachment, AssignmentKind } from "../core/assignment";
import type { ActivityLogRepo } from "../repo/activity-log-repo";
import type { AssignmentRepo } from "../repo/assignment-repo";
import type { DriveDeps } from "../repo/drive-deps";
import type { StorageDeps } from "../repo/storage-deps";
import type { EnrollmentRepo } from "../repo/enrollment-repo";
import type { Group } from "../core/group";
import type { GroupRepo } from "../repo/group-repo";
import type { PersonRepo } from "../repo/person-repo";
import type { SubmissionFileRepo } from "../repo/submission-file-repo";
import type { SubmissionRepo } from "../repo/submission-repo";
import type { TrainerRepo } from "../repo/trainer-repo";
import type { UploadSessionRepo } from "../repo/upload-session-repo";
import type { EducationRepo, BranchRepo } from "../repo/catalog-repo";
import type { NotifyInput } from "./comment-service";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

/**
 * Bir (tenant, assignment, kişi) üçlüsü için DETERMİNİSTİK Submission ID'si.
 * `nextId()` (rastgele Firestore ID) yerine bu kullanılır ki iki dosya AYNI ANDA
 * tamamlanınca (`completeUpload`'ın paralel çağrıları, `Promise.all` ile çoklu
 * dosya yükleme) ikisi de "existing yok" görüp 2 AYRI Submission dokümanı
 * açmasın — böylece ikinci dosya, uygulamanın `findByAssignmentAndPerson` ile
 * hiç bulamayacağı "öksüz" bir dokümana bağlanıp kayboluyordu (2026-07-13 bug).
 * Aynı ID üretimi çakışsa bile Firestore `.set()` üzerine yazar, doküman
 * ÇOĞALMAZ. BİLİNÇLİ SINIR: `iteration`/`status` gibi skaler alanlarda hâlâ
 * son-yazan-kazanır riski var (gerçek transaction yok) — kabul edilebilir,
 * kritik olan dosyanın asla öksüz kalmaması.
 */
function submissionDocId(tenantId: string, assignmentId: EntityId, personId: EntityId): string {
  return `${tenantId}_${assignmentId}_${personId}`;
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
  /** Klasör path'inde gerçek branş adını çözmek için (`resolveAssignmentFolderSegments`). */
  educations: EducationRepo;
  branches: BranchRepo;
  /** SADECE eski (Drive tabanlı) dosyaların silinmesi için — yeni upload'lar `storage` kullanır. */
  drive: DriveDeps;
  storage: StorageDeps;
  notify: (uid: string, input: NotifyInput) => Promise<void>;
}

/** GCS konsolunda ayırt edici üst segment — Flex Connect'teki `"Flex Connect"` klasörüyle aynı mantık. */
const SUBMISSIONS_STORAGE_ROOT = "Ödev Teslimleri";

/** Not verme akışlarının (`gradeSubmission`/`gradeManually`/`gradeBatch`) ortak ek bağımlılığı. */
type GradingDeps = Pick<SubmissionDeps, "submissions" | "groups" | "assignments"> & { activityLog: ActivityLogRepo };

/**
 * Klasör hiyerarşisi — TÜM upload akışları (öğrenci teslimi + eğitmen eki) için TEK
 * kaynak (2026-07-08 kararı, kullanıcı: "çok eğitmen kullanacaksa ayırt edebilmeliyiz"):
 * `{eğitmenAdı}/{branş}/{grupKodu}/{ödevAdı}/{leaf}` — `leaf` öğrenci teslimi için
 * öğrencinin adı, eğitmen eki için sabit `"Eğitmen"`. Eğitmen atanmamışsa/branş yoksa
 * okunabilir bir yer tutucuya düşer (boş segment olamaz).
 *
 * Branş — `Group.branch` (düz string) katalog Branş→Eğitim→Track hiyerarşisi kurulmadan
 * ÖNCEKİ eski gruplarda dolu, SONRAKİ gruplarda hep boş (2026-07-21 bug bulgusu: "Branşsız"
 * klasörü — `group.branch` hiç yazılmıyor, gerçek kaynak `group.educationId` → `Education.branchId`
 * → `Branch.name`). `groups/route.ts`'teki AYNI read-time join burada da uygulanıyor,
 * `group.branch` SADECE fallback (education/branch bulunamazsa).
 */
async function resolveAssignmentFolderSegments(
  group: Group,
  assignmentTitle: string,
  leaf: string,
  tenantId: string,
  deps: Pick<SubmissionDeps, "trainers" | "educations" | "branches">,
): Promise<string[]> {
  const trainer = group.trainerId ? await deps.trainers.getById(group.trainerId, tenantId) : null;
  const education = group.educationId ? await deps.educations.getById(group.educationId, tenantId) : null;
  const branch = education?.branchId ? await deps.branches.getById(education.branchId, tenantId) : null;
  const branchName = branch?.name ?? group.branch ?? "Branşsız";
  return [trainer?.name ?? "Atanmamış Eğitmen", branchName, group.code, assignmentTitle, leaf];
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
  const objectPath = deps.storage.buildObjectPath([SUBMISSIONS_STORAGE_ROOT, ...folderSegments], actualFileName);
  const sessionUri = await deps.storage.initResumableUploadSession(objectPath, input.mimeType);

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
    objectPath,
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

  if (!session.objectPath) throw new ValidationError("Depolama yolu bulunamadı.");
  const storagePath = session.objectPath;
  const webViewLink = deps.storage.publicUrl(storagePath);

  const now = nowISO();

  if (!existing) {
    existing = {
      id: submissionDocId(tenantId, session.assignmentId, personId),
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
    storagePath,
    driveViewLink: webViewLink,
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
  deps: Pick<SubmissionDeps, "assignments" | "groups" | "trainers" | "educations" | "branches" | "storage" | "uploadSessions">,
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
  const objectPath = deps.storage.buildObjectPath([SUBMISSIONS_STORAGE_ROOT, ...folderSegments], actualFileName);
  const sessionUri = await deps.storage.initResumableUploadSession(objectPath, input.mimeType);

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
    objectPath,
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
}

/** Eğitmen eki yükleme oturumunu tamamlar — `Assignment.attachments`'a ekler. */
export async function completeAttachmentUpload(
  actor: Actor,
  input: CompleteAttachmentUploadInput,
  deps: Pick<SubmissionDeps, "assignments" | "groups" | "uploadSessions" | "storage">,
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

  if (!session.objectPath) throw new ValidationError("Depolama yolu bulunamadı.");
  const storagePath = session.objectPath;

  const attachment: AssignmentAttachment = {
    id: globalThis.crypto.randomUUID(),
    storagePath,
    fileName: session.originalFileName,
    mimeType: session.mimeType,
    fileSize: session.fileSize,
    webViewLink: deps.storage.publicUrl(storagePath),
  };
  const now = nowISO();
  const updated: Assignment = {
    ...assignment,
    attachments: [...(assignment.attachments ?? []), attachment],
    updatedAt: now,
    updatedBy: actor.uid,
  };
  await deps.assignments.save(updated);

  await deps.uploadSessions.save({ ...session, status: "completed", updatedAt: now, updatedBy: actor.uid });
  return updated;
}

export interface DeleteFileInput {
  requesterUid: string;
  tenantId: string;
  submissionId: EntityId;
  fileId: EntityId;
}

/**
 * `deleteFile`/`deleteFileAsStaff` ortak gövdesi — yetki/durum kontrolü çağıran tarafta.
 * **2026-07-22 kullanıcı bulgusu:** son aktif dosya da silinince teslim "hiç yapılmamış"
 * durumuna (retracted) döner — yoksa dosyasız bir teslimde Onayla/Revize İste butonları
 * anlamsızca kalıyordu (silinecek/onaylanacak hiçbir şey yokken).
 */
async function removeSubmissionFile(
  submission: Submission,
  fileId: EntityId,
  deletedBy: string,
  tenantId: string,
  deps: Pick<SubmissionDeps, "submissionFiles" | "drive" | "storage" | "submissions">,
): Promise<void> {
  const file = await deps.submissionFiles.getById(fileId, tenantId);
  if (!file || file.submissionId !== submission.id || file.deleted) {
    throw new ValidationError("Dosya bulunamadı.");
  }

  if (file.storagePath) await deps.storage.deleteObject(file.storagePath);
  else if (file.driveFileId) await deps.drive.deleteFromDrive(file.driveFileId);

  const now = nowISO();
  await deps.submissionFiles.save({ ...file, deleted: true, deletedAt: now, deletedBy, isLatest: false });

  const remaining = await deps.submissionFiles.listActiveBySubmission(submission.id, tenantId);
  if (remaining.length === 0) {
    await deps.submissions.save({ ...submission, status: "retracted", retractedAt: now, updatedAt: now, updatedBy: deletedBy });
  } else if (file.isLatest) {
    const newLatest = remaining.sort((a, b) => b.versionNo - a.versionNo)[0];
    await deps.submissionFiles.save({ ...newLatest, isLatest: true });
  }
}

/** Öğrenci kendi (tamamlanmamış) teslimindeki bir dosyayı siler — canlıdaki `delete-file`. */
export async function deleteFile(
  input: DeleteFileInput,
  deps: Pick<SubmissionDeps, "persons" | "submissions" | "submissionFiles" | "drive" | "storage">,
): Promise<void> {
  const { tenantId } = input;
  const submission = await deps.submissions.getById(input.submissionId, tenantId);
  if (!submission) throw new ValidationError("Teslim bulunamadı.");
  await requireOwnedPerson(submission.personId, input.requesterUid, deps, tenantId);
  if (submission.status === "completed") throw new ValidationError("Tamamlanmış teslimden dosya silinemez.");

  await removeSubmissionFile(submission, input.fileId, input.requesterUid, tenantId, deps);
}

/**
 * Eğitmen/op — teslimdeki bir dosyayı siler (gated `submission.status.write`, `deleteFile`'la
 * AYNI yetki — onayı geri alma da bu yetkiyle yapılıyor). Tamamlanmış (`completed`) teslimde
 * hâlâ engelli — önce onay geri alınmalı (`updateSubmissionStatus`), yoksa notlandırılmış/
 * kapanmış bir teslimin dosyası sessizce kaybolabilir.
 */
export async function deleteFileAsStaff(
  actor: Actor,
  submissionId: EntityId,
  fileId: EntityId,
  deps: Pick<SubmissionDeps, "submissions" | "submissionFiles" | "groups" | "drive" | "storage">,
): Promise<void> {
  const submission = await deps.submissions.getById(submissionId, actor.tenantId);
  if (!submission) throw new ValidationError("Teslim bulunamadı.");
  await requireGroupScope(actor, "submission.status.write", submission.groupId, deps, actor.tenantId);
  if (submission.status === "completed") throw new ValidationError("Tamamlanmış teslimden dosya silinemez.");

  await removeSubmissionFile(submission, fileId, actor.uid, actor.tenantId, deps);
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
  deps: Pick<SubmissionDeps, "persons" | "assignments" | "submissions" | "submissionFiles" | "drive" | "storage">,
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
    if (f.storagePath) await deps.storage.deleteObject(f.storagePath);
    else if (f.driveFileId) await deps.drive.deleteFromDrive(f.driveFileId);
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
): Promise<Group> {
  const group = await deps.groups.getById(groupId, tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");
  if (!can(actor, capability, { groupId, ownerUid: group.trainerId })) throw new ForbiddenError(capability);
  return group;
}

function activityId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
  deps: GradingDeps,
): Promise<Submission> {
  const existing = await deps.submissions.getById(submissionId, actor.tenantId);
  if (!existing) throw new ValidationError("Teslim bulunamadı.");

  const assignment = await deps.assignments.getById(existing.assignmentId, actor.tenantId);
  const maxPuan = assignment?.maxPuan ?? 100;
  if (!Number.isFinite(grade) || grade < 0 || grade > maxPuan) {
    throw new ValidationError(`Not 0-${maxPuan} aralığında olmalı.`);
  }

  const group = await requireGroupScope(actor, "submission.grade", existing.groupId, deps, actor.tenantId);

  const now = nowISO();
  const updated: Submission = {
    ...existing,
    grade,
    gradedAt: now,
    gradedBy: actor.uid,
    updatedAt: now,
    updatedBy: actor.uid,
  };
  await deps.submissions.save(updated);

  await deps.activityLog.create({
    id: activityId(),
    tenantId: actor.tenantId,
    trainerId: group.trainerId ?? actor.uid,
    groupId: existing.groupId,
    type: "grade.given",
    title: "Not Girildi",
    description: `${assignment?.title ?? "Ödev"}`,
    createdAt: now,
  });

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
  deps: GradingDeps,
): Promise<Submission> {
  const group = await requireGroupScope(actor, "submission.grade", input.groupId, deps, actor.tenantId);

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
        id: submissionDocId(actor.tenantId, input.assignmentId, input.personId),
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

  await deps.activityLog.create({
    id: activityId(),
    tenantId: actor.tenantId,
    trainerId: group.trainerId ?? actor.uid,
    groupId: input.groupId,
    type: "grade.given",
    title: "Not Girildi",
    description: `${assignment?.title ?? "Ödev"}`,
    createdAt: now,
  });

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
  deps: GradingDeps,
): Promise<BatchGradeResult> {
  const group = await requireGroupScope(actor, "submission.grade", input.groupId, deps, actor.tenantId);

  const assignment = await deps.assignments.getById(input.assignmentId, actor.tenantId);
  const maxPuan = assignment?.maxPuan ?? 100;

  const existing = await deps.submissions.listByAssignment(input.assignmentId, actor.tenantId);
  const byPerson = new Map(existing.map((s) => [s.personId, s]));

  const now = nowISO();
  const writes: Submission[] = [];
  // 2026-07-15 BUG FIX (eski canlı sistemdeki bilinen hata — bkz. `dashboard/grading/page.tsx`
  // `handleSaveGrades`): roster HER seferinde TAM gönderilir (bkz. docstring), bu yüzden SADECE
  // gerçekten değişen notlar sayılır — daha önce notlanmış, değeri hiç değişmemiş öğrenciler
  // için "Not Girildi" TEKRAR SAYILMAZ.
  const changed: { personId: EntityId; grade: number }[] = [];
  const result: BatchGradeResult = { graded: 0, created: 0, skipped: 0, archived: false };

  for (const item of input.items) {
    if (!Number.isFinite(item.grade) || item.grade < 0 || item.grade > maxPuan) {
      throw new ValidationError(`Not 0-${maxPuan} aralığında olmalı.`);
    }
    const sub = byPerson.get(item.personId);
    if (sub) {
      writes.push({ ...sub, grade: item.grade, gradedAt: now, gradedBy: actor.uid, updatedAt: now, updatedBy: actor.uid });
      result.graded += 1;
      if (item.grade !== sub.grade) changed.push({ personId: item.personId, grade: item.grade });
    } else if (item.grade > 0) {
      writes.push({
        id: submissionDocId(actor.tenantId, input.assignmentId, item.personId),
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
      changed.push({ personId: item.personId, grade: item.grade });
    } else {
      result.skipped += 1; // teslimi yok + 0 → yazma
    }
  }

  await Promise.all(writes.map((s) => deps.submissions.save(s)));

  // 2026-07-15 kullanıcı düzeltmesi: TEK batch-grade çağrısı = TEK aktivite ("6 kişiye not
  // verdim, 6 ayrı 'Not Girildi' saçma" — kullanıcı geri bildirimi), öğrenci sayısına göre
  // her biri için ayrı satır DEĞİL. Puan da yok (öğrenciler farklı puan alabilir, tek sayı anlamsız).
  if (changed.length > 0) {
    await deps.activityLog.create({
      id: activityId(),
      tenantId: actor.tenantId,
      trainerId: group.trainerId ?? actor.uid,
      groupId: input.groupId,
      type: "grade.given",
      title: "Not Girildi",
      description: changed.length === 1
        ? `${assignment?.title ?? "Ödev"} — 1 öğrenciye not girildi.`
        : `${assignment?.title ?? "Ödev"} — ${changed.length} öğrenciye not girildi.`,
      createdAt: now,
    });
  }

  if (input.archive && assignment) {
    await deps.assignments.save({ ...assignment, status: "archived", updatedAt: now, updatedBy: actor.uid });
    result.archived = true;
  }
  return result;
}

/**
 * 2026-07-17 kararı (2026-07-06'daki İÇ ağırlıklandırma kararının YERİNE geçti):
 * `proje` türü ödevler Ödev Notu'na ARTIK HİÇ GİRMEZ — sadece `normal` ödevler sayılır.
 * "Proje" kavramı SADECE Sertifika Notu'nda yaşar (`Grade.projectGrade`, elle girilir,
 * ödev sisteminden bağımsız) — bir ödeve `kind:"proje"` verilse bile o ödevin puanı/
 * teslimi Ödev Notu hesabına (payda/pay) hiç eklenmez. `ODEV_TUR_AGIRLIK.proje` (70)
 * artık asla kullanılmaz (proje kategorisi `computeOdevYuzdeleri`'de hep boş kalır,
 * `combineOdevYuzdesi` "kategori yok" dalına düşüp normalOran'ı ×100 uygular) — sabit
 * geriye dönük uyumluluk için (`sertifikasyon/not/page.tsx`'in aynı formülü client-side
 * tekrarlayan kopyası dahil) SİLİNMEDİ, sadece proje'ye hiç veri akmıyor.
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
  // 2026-07-17 kararı: `proje` türü ödevler bu hesaba HİÇ girmez (bkz. ODEV_TUR_AGIRLIK
  // yorumu) — sadece `normal` ödevler payda/paya dahil edilir, proje kategorisi kasıtlı
  // olarak hep boş (`bosKategori()`) kalır.
  const published = assignments.filter((a) => a.status !== "draft" && (a.kind ?? "normal") === "normal");
  const result: OdevYuzdeleriResult = { normal: bosKategori(), proje: bosKategori() };
  const kindByAssignmentId = new Map<string, AssignmentKind>();

  for (const a of published) {
    kindByAssignmentId.set(a.id, "normal");
    result.normal.totalMaxPuan += a.maxPuan ?? 100;
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

export interface StudentActivityItem {
  id: string;
  type: "submission.created" | "grade.given";
  title: string;
  description: string;
  createdAt: ISODateTime;
}

/**
 * Öğrenci "En Son Aktiviteler" paneli — kalıcı bir log tutulmuyor, doğrudan kendi
 * Submission kayıtlarından (teslim + not) türetiliyor. Eğitmenin `flexos_activity_log`'u
 * (`ActivityLogRepo`) BİLEREK kullanılmadı: o log trainerId+groupId bazlı, grup geneli
 * ÖZET satırlar tutuyor (ör. "6 öğrenciye not girildi", `personId` alanı yok) — tek bir
 * öğrenciye ait/filtrelenebilir değil.
 */
export async function listRecentActivityForStudent(
  requesterUid: string,
  tenantId: string,
  personId: EntityId,
  deps: Pick<SubmissionDeps, "persons" | "enrollments" | "assignments" | "submissions">,
  limit = 8,
): Promise<StudentActivityItem[]> {
  const rows = await listAssignmentsForStudent(requesterUid, tenantId, personId, deps);

  const items: StudentActivityItem[] = [];
  for (const { assignment, submission } of rows) {
    if (!submission) continue;
    items.push({
      id: `submit-${submission.id}-${submission.iteration}`,
      type: "submission.created",
      title: submission.iteration > 1 ? "Ödev Yeniden Teslim Edildi" : "Ödev Teslim Edildi",
      description: assignment.title,
      createdAt: submission.lastSubmittedAt,
    });
    if (submission.gradedAt) {
      items.push({
        id: `grade-${submission.id}-${submission.gradedAt}`,
        type: "grade.given",
        title: "Not Verildi",
        description: assignment.title,
        createdAt: submission.gradedAt,
      });
    }
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
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
