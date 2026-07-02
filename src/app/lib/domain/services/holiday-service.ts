import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { ISODateTime } from "../base";
import type { Holiday } from "../core/holiday";
import { ForbiddenError, ValidationError } from "../errors";
import type { HolidayRepo } from "../repo/holiday-repo";

const now = (): ISODateTime => new Date().toISOString();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface CreateHolidayInput {
  name: string;
  startDate: string;
  endDate?: string; // verilmezse startDate ile aynı (tek gün)
}

/** Tatil oluştur — gated `holiday.manage`. */
export async function createHoliday(actor: Actor, input: CreateHolidayInput, repo: HolidayRepo): Promise<Holiday> {
  if (!can(actor, "holiday.manage")) throw new ForbiddenError("holiday.manage");

  const name = input.name?.trim();
  if (!name) throw new ValidationError("Tatil adı zorunludur.");
  if (!DATE_RE.test(input.startDate ?? "")) throw new ValidationError("Geçersiz başlangıç tarihi.");
  const endDate = input.endDate?.trim() || input.startDate;
  if (!DATE_RE.test(endDate)) throw new ValidationError("Geçersiz bitiş tarihi.");
  if (endDate < input.startDate) throw new ValidationError("Bitiş tarihi başlangıçtan önce olamaz.");

  const holiday: Holiday = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    name,
    startDate: input.startDate,
    endDate,
    createdAt: now(),
    createdBy: actor.uid,
  };
  await repo.save(holiday);
  return holiday;
}

export interface UpdateHolidayInput {
  name?: string;
  startDate?: string;
  endDate?: string;
}

/** Tatil güncelle — gated `holiday.manage`. */
export async function updateHoliday(actor: Actor, id: string, input: UpdateHolidayInput, repo: HolidayRepo): Promise<Holiday> {
  if (!can(actor, "holiday.manage")) throw new ForbiddenError("holiday.manage");

  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Tatil bulunamadı.");

  const updated: Holiday = { ...existing };
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new ValidationError("Tatil adı boş olamaz.");
    updated.name = n;
  }
  if (input.startDate !== undefined) {
    if (!DATE_RE.test(input.startDate)) throw new ValidationError("Geçersiz başlangıç tarihi.");
    updated.startDate = input.startDate;
  }
  if (input.endDate !== undefined) {
    if (!DATE_RE.test(input.endDate)) throw new ValidationError("Geçersiz bitiş tarihi.");
    updated.endDate = input.endDate;
  }
  if (updated.endDate < updated.startDate) throw new ValidationError("Bitiş tarihi başlangıçtan önce olamaz.");

  updated.updatedAt = now();
  updated.updatedBy = actor.uid;
  await repo.save(updated);
  return updated;
}

/** Tatil sil — gated `holiday.manage`. */
export async function deleteHoliday(actor: Actor, id: string, repo: HolidayRepo): Promise<void> {
  if (!can(actor, "holiday.manage")) throw new ForbiddenError("holiday.manage");
  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Tatil bulunamadı.");
  await repo.delete(id, actor.tenantId);
}
