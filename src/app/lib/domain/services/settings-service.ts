import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { FlexosSettings } from "../core/settings";
import { ForbiddenError } from "../errors";
import type { SettingsRepo } from "../repo/settings-repo";

const now = () => new Date().toISOString();

/** Ayarları okur — eksik alanlar varsayılana düşer (`standaloneMode`/`transferRequiresManualSale`: false, tam entegre/otomatik-ek-satış modu). */
export async function getSettings(actor: Actor, repo: SettingsRepo): Promise<FlexosSettings> {
  const existing = await repo.get(actor.tenantId);
  return {
    tenantId: actor.tenantId,
    standaloneMode: existing?.standaloneMode ?? false,
    transferRequiresManualSale: existing?.transferRequiresManualSale ?? false,
    updatedAt: existing?.updatedAt,
    updatedBy: existing?.updatedBy,
  };
}

export interface UpdateSettingsInput {
  standaloneMode?: boolean;
  transferRequiresManualSale?: boolean;
}

/**
 * Sistem anahtarlarını değiştirir (`standaloneMode` + `transferRequiresManualSale`) —
 * yalnız `role.manage` (admin) yetkisiyle. Kısmi güncelleme (READ-MERGE-WRITE): body'de
 * gönderilmeyen alan mevcut değerinde kalır — iki bağımsız switch aynı dokümanı paylaşır,
 * biri diğerini sessizce sıfırlamamalı.
 */
export async function updateSettings(
  actor: Actor,
  input: UpdateSettingsInput,
  repo: SettingsRepo,
): Promise<FlexosSettings> {
  if (!can(actor, "role.manage")) throw new ForbiddenError("role.manage");

  const existing = await repo.get(actor.tenantId);

  const settings: FlexosSettings = {
    tenantId: actor.tenantId,
    standaloneMode: input.standaloneMode ?? existing?.standaloneMode ?? false,
    transferRequiresManualSale: input.transferRequiresManualSale ?? existing?.transferRequiresManualSale ?? false,
    updatedAt: now(),
    updatedBy: actor.uid,
  };

  await repo.save(settings);
  return settings;
}
