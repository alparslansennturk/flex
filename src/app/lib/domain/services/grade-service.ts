import { can, widestScope } from "../access/can";
import type { Actor } from "../access/types";
import type { ISODateTime } from "../base";
import type { ActivityLogEntry } from "../core/activity-log";
import type { Grade } from "../education/grade";
import { ForbiddenError, ValidationError } from "../errors";
import type { ActivityLogRepo } from "../repo/activity-log-repo";
import type { GradeRepo } from "../repo/grade-repo";
import type { GroupRepo } from "../repo/group-repo";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

function activityId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface GradeDeps {
  grades: GradeRepo;
  groups: GroupRepo;
  activityLog: ActivityLogRepo;
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

  // Kilitli not — org scope (admin/yetkili) her zaman düzenleyebilir, assigned scope
  // (eğitmen) kilitli KİŞİYİ düzenleyemez (2026-07-08 kararı: kilit KİŞİ-bazlı, örn.
  // sertifikası basılmış biri — bkz. `grade.ts` docstring). Roster genelde TEK seferde
  // topluca gönderilir (bir kişi bugün, öteki 6 ay sonra not girilebiliyor gerçek
  // kullanımda) — kilitli biri diğerlerinin kaydını ENGELLEMEMELİ, sessizce atlanır.
  const canOverrideLock = widestScope(actor, "grade.write") === "org";

  const ts = nowISO();
  const results: Grade[] = [];
  let changedCount = 0;
  for (const entry of input.entries) {
    if (!entry.enrollmentId || !entry.personId) throw new ValidationError("enrollmentId/personId zorunlu.");
    if (!validScore(entry.projectGrade)) throw new ValidationError("Sertifika notu 0-100 arası olmalı.");

    const existing = await deps.grades.getById(entry.enrollmentId, actor.tenantId);
    if (existing?.locked && !canOverrideLock) continue; // kilitli — sessizce atla, diğerlerini engelleme
    const newProjectGrade = entry.projectGrade == null ? undefined : entry.projectGrade;
    const grade: Grade = {
      id: entry.enrollmentId,
      tenantId: actor.tenantId,
      enrollmentId: entry.enrollmentId,
      personId: entry.personId,
      groupId: input.groupId,
      projectGrade: newProjectGrade,
      locked: existing?.locked,
      lockedAt: existing?.lockedAt,
      lockedBy: existing?.lockedBy,
      createdAt: existing?.createdAt ?? ts,
      createdBy: existing?.createdBy ?? actor.uid,
      updatedAt: existing ? ts : undefined,
      updatedBy: existing ? actor.uid : undefined,
    };
    await deps.grades.save(grade);
    results.push(grade);

    // Sadece GERÇEKTEN değişen (ve gerçek bir sayı olan) not sayılır — roster yeniden
    // aynı değerle gönderilirse (ya da temizleme/dokunmama) tekrar SAYILMAZ.
    if (newProjectGrade != null && existing?.projectGrade !== newProjectGrade) changedCount += 1;
  }

  // 2026-07-15 kullanıcı düzeltmesi: roster TEK seferde topluca kaydedilir (bkz. yukarıdaki
  // yorum) — bu yüzden aktivite logu da HER öğrenci için ayrı satır değil, çağrı başına TEK
  // özet satır olmalı ("6 kişiye not girdim, 6 aktivite saçma" — kullanıcı geri bildirimi).
  // Puan da BURADA gösterilmiyor (farklı öğrencilerin farklı notu var, tek bir sayı anlamsız).
  if (changedCount > 0) {
    const log: ActivityLogEntry = {
      id: activityId(),
      tenantId: actor.tenantId,
      trainerId: group.trainerId ?? actor.uid,
      groupId: input.groupId,
      type: "grade.given",
      title: "Sertifika Notu Girildi",
      description: changedCount === 1 ? `${group.code} — 1 öğrenciye not girildi.` : `${group.code} — ${changedCount} öğrenciye not girildi.`,
      createdAt: ts,
    };
    await deps.activityLog.create(log);
  }

  return results;
}

/**
 * Grup notlarını oku — gated `grade.read`
 * (eğitmen: assigned scope, kendi grubu; op/admin: org).
 */
export async function getGradesByGroup(actor: Actor, groupId: string, deps: Pick<GradeDeps, "grades" | "groups">): Promise<Grade[]> {
  if (!groupId) throw new ValidationError("groupId zorunlu.");
  const group = await deps.groups.getById(groupId, actor.tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");

  if (!can(actor, "grade.read", { groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("grade.read");
  }
  return deps.grades.listByGroup(groupId, actor.tenantId);
}
