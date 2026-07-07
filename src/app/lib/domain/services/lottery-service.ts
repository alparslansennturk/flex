import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId } from "../base";
import type { LotteryResult, StudentDraw } from "../core/lottery-result";
import { ForbiddenError, ValidationError } from "../errors";
import type { LotteryResultRepo } from "../repo/lottery-result-repo";
import type { AssignmentRepo } from "../repo/assignment-repo";
import type { GroupRepo } from "../repo/group-repo";
import type { EnrollmentRepo } from "../repo/enrollment-repo";

const now = () => new Date().toISOString();

export interface LotteryDeps {
  results: LotteryResultRepo;
  assignments: AssignmentRepo;
  groups: GroupRepo;
  enrollments: EnrollmentRepo;
}

/** Çekiliş sonucunu okur — `assignment.read` ile aynı yetki (ödevi görebilen görür). */
export async function getLotteryResult(actor: Actor, assignmentId: string, deps: LotteryDeps): Promise<LotteryResult | null> {
  const assignment = await deps.assignments.getById(assignmentId, actor.tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");
  const group = await deps.groups.getById(assignment.groupId, actor.tenantId);
  if (!can(actor, "assignment.read", { groupId: assignment.groupId, ownerUid: group?.trainerId })) {
    throw new ForbiddenError("assignment.read");
  }
  return deps.results.get(assignmentId);
}

export interface SaveDrawInput {
  assignmentId: EntityId;
  studentId: EntityId;
  studentName: string;
  studentLastName: string;
  draws: StudentDraw["draws"];
}

/**
 * Bir öğrencinin çekiliş sonucunu kaydeder — canlıdaki `GameScreen.tsx::handleStartDrawing`
 * sonundaki Firestore yazımlarıyla birebir: `LotteryResult` upsert + her çekimde
 * `LotteryArchive` snapshot'ı. Grubun TÜM (aktif kayıtlı) öğrencileri çektiyse
 * `Assignment.status` → `"published"` (seçim bitti, normal teslim/not akışına düşer —
 * canlıdaki "gamified task artık normal ödev gibi davranır" kuralıyla aynı).
 *
 * Gated: aktör, ödevin grubunun eğitmeni olmalı (veya org scope) — `assignment.edit`
 * ile aynı sahiplik deseni (`assignment-service.ts::updateAssignment`).
 */
export async function saveDraw(actor: Actor, input: SaveDrawInput, deps: LotteryDeps): Promise<LotteryResult> {
  const assignment = await deps.assignments.getById(input.assignmentId, actor.tenantId);
  if (!assignment) throw new ValidationError("Ödev bulunamadı.");

  if (!can(actor, "assignment.edit", { groupId: assignment.groupId, ownerUid: assignment.trainerId })) {
    throw new ForbiddenError("assignment.edit");
  }
  if (!assignment.gamifiedType) throw new ValidationError("Bu ödev oyunlaştırılmış değil.");
  if (input.draws.length === 0) throw new ValidationError("Çekiliş sonucu boş olamaz.");

  const existing = await deps.results.get(input.assignmentId);
  const otherDraws = (existing?.draws ?? []).filter((d) => d.studentId !== input.studentId);
  const newAllDraws: StudentDraw[] = [...otherDraws, { studentId: input.studentId, draws: input.draws }];

  const result: LotteryResult = {
    id: input.assignmentId,
    tenantId: actor.tenantId,
    assignmentId: input.assignmentId,
    draws: newAllDraws,
    driveFiles: existing?.driveFiles,
    updatedAt: now(),
  };
  await deps.results.save(result);

  // Arşiv snapshot'ı her çekimde güncellenir (canlıdaki "yarım bırakılsa bile arşivde
  // görünsün" kuralı) — öğrenci isim listesi çekim yapan öğrencilerin birikimiyle oluşur.
  const existingArchive = await deps.results.getArchive(input.assignmentId);
  const students = (existingArchive?.students ?? []).filter((s) => s.id !== input.studentId);
  students.push({ id: input.studentId, name: input.studentName, lastName: input.studentLastName });
  await deps.results.saveArchive({
    id: input.assignmentId,
    tenantId: actor.tenantId,
    assignmentId: input.assignmentId,
    groupId: assignment.groupId,
    taskName: assignment.title,
    type: "kolaj",
    draws: newAllDraws,
    students,
    completedAt: now(),
  });

  const roster = await deps.enrollments.listByGroup(assignment.groupId, actor.tenantId);
  if (roster.length > 0 && newAllDraws.length >= roster.length && assignment.status !== "published") {
    await deps.assignments.save({ ...assignment, status: "published", updatedAt: now(), updatedBy: actor.uid });
  }

  return result;
}
