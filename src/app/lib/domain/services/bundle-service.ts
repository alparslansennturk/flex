import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { ISODateTime } from "../base";
import type { Bundle, BundleItem, BundleStatus } from "../eduos/bundle";
import { ForbiddenError, ValidationError } from "../errors";
import type { BundleRepo } from "../repo/bundle-repo";

const now = (): ISODateTime => new Date().toISOString();

export interface CreateBundleInput {
  name: string;
  items: BundleItem[];
  bundlePrice: number;
  vatRate?: number;
  status?: BundleStatus;
}

export interface UpdateBundleInput {
  name?: string;
  items?: BundleItem[];
  bundlePrice?: number;
  vatRate?: number;
  status?: BundleStatus;
}

function validate(name: string, items: BundleItem[], bundlePrice: number) {
  if (!name.trim()) throw new ValidationError("Paket adı zorunludur.");
  if (items.length < 2) throw new ValidationError("En az 2 eğitim seçilmelidir.");
  if (!(bundlePrice > 0)) throw new ValidationError("Paket fiyatı sıfırdan büyük olmalıdır.");
  const total = items.reduce((a, i) => a + i.listPrice, 0);
  if (bundlePrice >= total) throw new ValidationError("Paket fiyatı bireysel toplamdan düşük olmalıdır.");
}

export async function createBundle(
  actor: Actor,
  input: CreateBundleInput,
  repo: BundleRepo,
): Promise<Bundle> {
  if (!can(actor, "bundle.create")) throw new ForbiddenError("bundle.create");
  validate(input.name, input.items, input.bundlePrice);

  const bundle: Bundle = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    name: input.name.trim(),
    items: input.items,
    bundlePrice: input.bundlePrice,
    vatRate: input.vatRate ?? (input.items[0]?.vatRate ?? 10),
    status: input.status ?? "aktif",
    createdAt: now(),
    createdBy: actor.uid,
  };

  await repo.save(bundle);
  return bundle;
}

export async function updateBundle(
  actor: Actor,
  id: string,
  input: UpdateBundleInput,
  repo: BundleRepo,
): Promise<Bundle> {
  if (!can(actor, "bundle.edit")) throw new ForbiddenError("bundle.edit");
  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Paket bulunamadı.");

  const updated: Bundle = { ...existing };
  if (input.name !== undefined) updated.name = input.name.trim();
  if (input.items !== undefined) updated.items = input.items;
  if (input.bundlePrice !== undefined) updated.bundlePrice = input.bundlePrice;
  if (input.vatRate !== undefined) updated.vatRate = input.vatRate;
  if (input.status !== undefined) updated.status = input.status;

  validate(updated.name, updated.items, updated.bundlePrice);

  updated.updatedAt = now();
  updated.updatedBy = actor.uid;
  await repo.save(updated);
  return updated;
}

export async function deleteBundle(
  actor: Actor,
  id: string,
  repo: BundleRepo,
): Promise<void> {
  if (!can(actor, "bundle.delete")) throw new ForbiddenError("bundle.delete");
  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Paket bulunamadı.");
  await repo.delete(id, actor.tenantId);
}
