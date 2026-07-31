import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Submission, SubmissionStatus } from "../core/submission";
import type { Group } from "../core/group";
import { ForbiddenError, ValidationError } from "../errors";
import type { SubmissionDeps } from "./submission-types";

export function nowISO(): ISODateTime {
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
export function submissionDocId(tenantId: string, assignmentId: EntityId, personId: EntityId): string {
  return `${tenantId}_${assignmentId}_${personId}`;
}

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
export async function resolveAssignmentFolderSegments(
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
export function generateActualFileName(sequence: number, originalFileName: string): string {
  return `${String(sequence).padStart(2, "0")}-${originalFileName}`;
}

export async function requireOwnedPerson(
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

export async function currentActiveFileCount(
  submission: Submission | null,
  deps: Pick<SubmissionDeps, "submissionFiles">,
  tenantId: string,
) {
  if (!submission) return 0;
  return (await deps.submissionFiles.listActiveBySubmission(submission.id, tenantId)).length;
}

export async function requireGroupScope(
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

export function activityId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
