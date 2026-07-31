import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId } from "../base";
import type { Submission, SubmissionFile, SubmissionStatus } from "../core/submission";
import { ForbiddenError, ValidationError } from "../errors";
import { activityId, nowISO, requireGroupScope, submissionDocId } from "./submission-helpers";
import type { BatchGradeItem, BatchGradeResult, GradingDeps, SubmissionDeps } from "./submission-types";

const VALID_STAFF_STATUSES: SubmissionStatus[] = ["submitted", "reviewing", "revision", "completed"];

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

  // 2026-07-29 ACİL BUG FIX: burada `status: "archived"` yazılıyordu — ama "archived" bu
  // domain'de "İPTAL EDİLDİ, sadece kalıcı silinebilir" anlamına geliyor (bkz.
  // `odevler/teslim/[groupId]/page.tsx::ArchivedAssignmentCard`, "Ödevi İptal Et" aksiyonu).
  // Normal notlama akışında ödev iptal edilmiyor, TAMAMLANIYOR — doğru domain değeri
  // `"closed"` ("Ödevi Bitir" aksiyonuyla AYNI değer, bkz. `egitmen-anasayfa/page.tsx::
  // finishAssignment`). Yanlış değer yüzünden bir kullanıcının hâlâ not girmesi gereken
  // ödevi geri-alınamaz arşive düşmüştü (kalıcı sil dışında hiçbir seçenek yoktu).
  // Wire alan adı `archive`/`archived` KASITLI değiştirilmedi (geniş bir rename riski) —
  // anlamı artık "işaretlendi/tamamlandı" (bkz. çağıran `odev-notu` sayfası).
  if (input.archive && assignment) {
    await deps.assignments.save({ ...assignment, status: "closed", updatedAt: now, updatedBy: actor.uid });
    result.archived = true;
  }
  return result;
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
