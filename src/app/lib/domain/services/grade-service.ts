import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { ISODateTime } from "../base";
import type { Grade } from "../education/grade";
import { ForbiddenError, ValidationError } from "../errors";
import type { GradeRepo } from "../repo/grade-repo";
import type { GroupRepo } from "../repo/group-repo";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

export interface GradeDeps {
  grades: GradeRepo;
  groups: GroupRepo;
}

export interface GradeEntryInput {
  enrollmentId: string;
  personId: string;
  projectGrade?: number | null; // null = temizle, undefined = dokunma
}

export interface SaveGradesInput {
  groupId: string;
  entries: GradeEntryInput[];
}

function validScore(n: number | null | undefined): boolean {
  return n == null || (Number.isFinite(n) && n >= 0 && n <= 100);
}

/**
 * Grup için notları toplu kaydet (taslak) — gated `grade.write`
 * (eğitmen: assigned scope, kendi grubu; op/admin: org).
 */
export async function saveGrades(actor: Actor, input: SaveGradesInput, deps: GradeDeps): Promise<Grade[]> {
  if (!input.groupId) throw new ValidationError("groupId zorunlu.");
  const group = await deps.groups.getById(input.groupId, actor.tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");

  if (!can(actor, "grade.write", { groupId: input.groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("grade.write");
  }
  if (!input.entries?.length) throw new ValidationError("Not girişi boş olamaz.");

  const ts = nowISO();
  const results: Grade[] = [];
  for (const entry of input.entries) {
    if (!entry.enrollmentId || !entry.personId) throw new ValidationError("enrollmentId/personId zorunlu.");
    if (!validScore(entry.projectGrade)) throw new ValidationError("Sertifika notu 0-100 arası olmalı.");

    const existing = await deps.grades.getById(entry.enrollmentId, actor.tenantId);
    const grade: Grade = {
      id: entry.enrollmentId,
      tenantId: actor.tenantId,
      enrollmentId: entry.enrollmentId,
      personId: entry.personId,
      groupId: input.groupId,
      projectGrade: entry.projectGrade == null ? undefined : entry.projectGrade,
      createdAt: existing?.createdAt ?? ts,
      createdBy: existing?.createdBy ?? actor.uid,
      updatedAt: existing ? ts : undefined,
      updatedBy: existing ? actor.uid : undefined,
    };
    await deps.grades.save(grade);
    results.push(grade);
  }
  return results;
}

/**
 * Grup notlarını oku — gated `grade.read`
 * (eğitmen: assigned scope, kendi grubu; op/admin: org).
 */
export async function getGradesByGroup(actor: Actor, groupId: string, deps: GradeDeps): Promise<Grade[]> {
  if (!groupId) throw new ValidationError("groupId zorunlu.");
  const group = await deps.groups.getById(groupId, actor.tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");

  if (!can(actor, "grade.read", { groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("grade.read");
  }
  return deps.grades.listByGroup(groupId, actor.tenantId);
}
