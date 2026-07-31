import type { EntityId } from "../base";
import type { Assignment } from "../core/assignment";
import type { Submission, SubmissionFile } from "../core/submission";
import { ValidationError } from "../errors";
import { requireOwnedPerson } from "./submission-helpers";
import type { StudentActivityItem, SubmissionDeps } from "./submission-types";

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
