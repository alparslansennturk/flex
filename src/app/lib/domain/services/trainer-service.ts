import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { ISODateTime } from "../base";
import type { Trainer, TrainerAvailabilitySlot, TrainerNote, TrainerStatus } from "../core/trainer";
import { ForbiddenError, ValidationError } from "../errors";
import type { TrainerRepo } from "../repo/trainer-repo";

const now = (): ISODateTime => new Date().toISOString();
const VALID_STATUS: TrainerStatus[] = ["aktif", "pasif"];

/** Boş/whitespace eğitim adlarını ve boş branşları temizler. */
function sanitizeComp(comp?: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!comp) return out;
  for (const [brans, arr] of Object.entries(comp)) {
    const clean = (arr ?? []).map((s) => s.trim()).filter(Boolean);
    if (clean.length) out[brans] = clean;
  }
  return out;
}

export interface CreateTrainerInput {
  name: string;
  email: string;
  phone?: string;
  branchOffices?: string[];
  status?: TrainerStatus;
  competencies?: Record<string, string[]>;
  hourlyRate?: number; // yetki (trainer.rate.write) yoksa sunucuda düşürülür
  availability?: TrainerAvailabilitySlot[];
  notes?: TrainerNote[];
}

export interface TrainerWriteResult {
  trainer: Trainer;
  /** Ücret gönderildi ama yetki olmadığı için yazılmadıysa true (şeffaflık/log). */
  rateDropped: boolean;
}

/**
 * Eğitmen oluşturma — gated (`trainer.create`).
 * `hourlyRate` yalnız `trainer.rate.write` varsa yazılır (yoksa düşürülür).
 */
export async function createTrainer(
  actor: Actor,
  input: CreateTrainerInput,
  repo: TrainerRepo,
): Promise<TrainerWriteResult> {
  if (!can(actor, "trainer.create")) throw new ForbiddenError("trainer.create");

  const name = input.name?.trim();
  const email = input.email?.trim();
  if (!name) throw new ValidationError("Eğitmen adı zorunludur.");
  if (!email) throw new ValidationError("E-posta zorunludur.");

  const status = input.status ?? "aktif";
  if (!VALID_STATUS.includes(status)) throw new ValidationError("Geçersiz durum.");

  const allowRate = can(actor, "trainer.rate.write");
  const rateProvided = input.hourlyRate != null;
  const rateDropped = rateProvided && !allowRate;
  const hourlyRate = allowRate && rateProvided ? input.hourlyRate : undefined;
  if (hourlyRate != null && !(hourlyRate >= 0)) throw new ValidationError("Ücret negatif olamaz.");

  const trainer: Trainer = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    name,
    email,
    phone: input.phone?.trim() || undefined,
    branchOffices: input.branchOffices ?? [],
    status,
    competencies: sanitizeComp(input.competencies),
    hourlyRate,
    availability: input.availability ?? [],
    notes: input.notes ?? [],
    createdAt: now(),
    createdBy: actor.uid,
  };

  await repo.save(trainer);
  return { trainer, rateDropped };
}

export interface UpdateTrainerInput {
  name?: string;
  email?: string;
  phone?: string;
  branchOffices?: string[];
  status?: TrainerStatus;
  competencies?: Record<string, string[]>;
  hourlyRate?: number | null; // null = açıkça temizle (yetki varsa); undefined = dokunma
}

/**
 * Eğitmen güncelleme — gated (`trainer.edit`).
 * Sadece gönderilen alanlar değişir. `hourlyRate` yalnız `trainer.rate.write`
 * varsa güncellenir; yetkisiz aktör mevcut ücrete DOKUNAMAZ (korunur).
 */
export async function updateTrainer(
  actor: Actor,
  id: string,
  input: UpdateTrainerInput,
  repo: TrainerRepo,
): Promise<TrainerWriteResult> {
  if (!can(actor, "trainer.edit")) throw new ForbiddenError("trainer.edit");

  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Eğitmen bulunamadı.");

  const updated: Trainer = { ...existing };
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new ValidationError("Eğitmen adı boş olamaz.");
    updated.name = n;
  }
  if (input.email !== undefined) {
    const e = input.email.trim();
    if (!e) throw new ValidationError("E-posta boş olamaz.");
    updated.email = e;
  }
  if (input.phone !== undefined) updated.phone = input.phone.trim() || undefined;
  if (input.branchOffices !== undefined) updated.branchOffices = input.branchOffices;
  if (input.status !== undefined) {
    if (!VALID_STATUS.includes(input.status)) throw new ValidationError("Geçersiz durum.");
    updated.status = input.status;
  }
  if (input.competencies !== undefined) updated.competencies = sanitizeComp(input.competencies);

  // ── ücret: yalnız yetki varsa ──
  const allowRate = can(actor, "trainer.rate.write");
  let rateDropped = false;
  if (input.hourlyRate !== undefined) {
    if (allowRate) {
      if (input.hourlyRate === null) {
        updated.hourlyRate = undefined;
      } else {
        if (!(input.hourlyRate >= 0)) throw new ValidationError("Ücret negatif olamaz.");
        updated.hourlyRate = input.hourlyRate;
      }
    } else {
      rateDropped = true; // yetkisiz → mevcut ücret korunur
    }
  }

  updated.updatedAt = now();
  updated.updatedBy = actor.uid;
  await repo.save(updated);
  return { trainer: updated, rateDropped };
}

/**
 * Eğitmen sil — gated (`trainer.delete`).
 * NOT: atanmış gruplarla ilişki burada engellenmez (grupta eğitmen opsiyonel/dummy);
 * grup-eğitmen güvenliği gerekirse ileride GroupRepo deps ile eklenir.
 */
export async function deleteTrainer(actor: Actor, id: string, repo: TrainerRepo): Promise<void> {
  if (!can(actor, "trainer.delete")) throw new ForbiddenError("trainer.delete");
  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Eğitmen bulunamadı.");
  await repo.delete(id, actor.tenantId);
}
