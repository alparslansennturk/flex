import { ALLOWED_MIME_TYPES, MAX_RESUMABLE_FILE_SIZE_BYTES, MAX_RESUMABLE_FILE_SIZE_LABEL } from "../../../types/storage";
import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId } from "../base";
import type { Submission, SubmissionFile, SubmissionStatus, UploadSession } from "../core/submission";
import { ForbiddenError, ValidationError } from "../errors";
import type { Assignment, AssignmentAttachment } from "../core/assignment";
import {
  currentActiveFileCount,
  generateActualFileName,
  getMaxUploads,
  nowISO,
  requireGroupScope,
  requireOwnedPerson,
  resolveAssignmentFolderSegments,
  submissionDocId,
} from "./submission-helpers";
import type {
  CompleteAttachmentUploadInput,
  CompleteUploadInput,
  DeleteFileInput,
  GetChunkSessionInput,
  InitAttachmentUploadInput,
  InitAttachmentUploadResult,
  InitUploadInput,
  InitUploadResult,
  RetractInput,
  SubmissionDeps,
} from "./submission-types";

/** GCS konsolunda ayırt edici üst segment — Flex Connect'teki `"Flex Connect"` klasörüyle aynı mantık. */
const SUBMISSIONS_STORAGE_ROOT = "Ödev Teslimleri";

/**
 * Doğrudan-yükleme (signed URL) başlat — öğrenci-tarafı, capability sistemi DIŞINDA
 * (sahiplik kontrolü: `person.authUid === requesterUid`). Canlıdaki `init-resumable-upload`
 * route'unun TEK canonical karşılığı (2026-07-29: chunk-proxy yerine tek seferlik
 * signed URL — `session.sessionUri` artık bir GCS resumable session değil, imzalı
 * PUT URL'i tutuyor; alan adı geriye dönük uyumluluk için değiştirilmedi).
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
  const uploadUrl = await deps.storage.createSignedUploadUrl(objectPath, input.mimeType);

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
    sessionUri: uploadUrl,
    objectPath,
    folderPath: folderSegments.join("/"),
    status: "uploading",
    // İmzalı URL 60dk'da bitiyor (bkz. `createSignedUploadUrl`) — session'ı da
    // aynı pencereye çektik, eskiden resumable oturum 7 gün canlı kalabildiği
    // için 7 gündü ama artık tek-seferlik PUT'ta anlamı yok.
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    createdAt: nowISO(),
    createdBy: input.requesterUid,
  };
  await deps.uploadSessions.save(session);

  return { session, currentUploads, maxUploads, uploadUrl };
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
  // Signed URL ile yüklenen nesne varsayılan PRİVATE (bkz. `createSignedUploadUrl`
  // yorumu) — `publicUrl()`'ün eskisi gibi çalışması için burada açıkça public
  // yapılıyor (eski resumable akışta `predefinedAcl:"publicRead"` upload ANINDA
  // uygulanıyordu, artık onay adımında uygulanıyor).
  await deps.storage.makeObjectPublic(storagePath);
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

  // Eğitmene "yeni teslim var" bildirimi (2026-07-21 kullanıcı bulgusu: bu hiç yoktu —
  // `updateSubmissionStatus`'un öğrenciye giden ters yönü vardı ama bu yön hiç
  // tetiklenmiyordu). Non-fatal (`notify` zaten try/catch'li), her tamamlanan
  // yüklemede gider (revize sonrası yeniden yükleme dahil).
  const group = await deps.groups.getById(session.groupId, tenantId);
  const trainer = group?.trainerId ? await deps.trainers.getById(group.trainerId, tenantId) : null;
  if (trainer?.authUid) {
    const person = await deps.persons.getById(personId, tenantId);
    const studentName = person ? `${person.firstName} ${person.lastName}`.trim() : "Bir öğrenci";
    await deps.notify(trainer.authUid, {
      type: "assignment",
      entityId: existing.assignmentId,
      senderId: input.requesterUid,
      title: "Yeni Ödev Teslimi",
      preview: `${studentName}, "${assignment.title}" ödevini teslim etti.`,
      actionUrl: `/flexos/odevler/teslim/${session.groupId}/${session.assignmentId}`,
    });
  }

  return existing;
}

const MAX_ASSIGNMENT_ATTACHMENTS = 10;

/**
 * Eğitmenin ödeve referans/başlangıç dosyası eklemesi — gated `assignment.edit`
 * (2026-07-08 eklendi). 2026-07-29: öğrenci teslimiyle AYNI signed-URL akışına
 * taşındı (`createSignedUploadUrl`) — ama BİLEREK dosya boyutu sınırı YOK
 * (kullanıcı kararı: eğitmen kendi ders materyalini yüklerken 250MB gibi bir
 * tavana çarpmamalı; öğrenci teslimindeki 250MB sınırı kasıtlı kalıyor, bu SADECE
 * eğitmenin kendi eki için). Hedef: `Submission` değil, doğrudan
 * `Assignment.attachments`. Klasör: `.../Eğitmen` (bkz. `resolveAssignmentFolderSegments`).
 */
export async function initAttachmentUpload(
  actor: Actor,
  input: InitAttachmentUploadInput,
  deps: Pick<SubmissionDeps, "assignments" | "groups" | "trainers" | "educations" | "branches" | "storage" | "uploadSessions">,
): Promise<InitAttachmentUploadResult> {
  const assignment = await deps.assignments.getById(input.assignmentId, actor.tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");
  const group = await deps.groups.getById(assignment.groupId, actor.tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");
  if (!can(actor, "assignment.edit", { groupId: assignment.groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("assignment.edit");
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
  const uploadUrl = await deps.storage.createSignedUploadUrl(objectPath, input.mimeType);

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
    sessionUri: uploadUrl,
    objectPath,
    folderPath: folderSegments.join("/"),
    status: "uploading",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    createdAt: nowISO(),
    createdBy: actor.uid,
  };
  await deps.uploadSessions.save(session);
  return { session, uploadUrl };
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
  await deps.storage.makeObjectPublic(storagePath);

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
