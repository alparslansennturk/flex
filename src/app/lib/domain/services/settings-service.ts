import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { FlexosSettings } from "../core/settings";
import { ForbiddenError } from "../errors";
import type { SettingsRepo } from "../repo/settings-repo";

const now = () => new Date().toISOString();

/** Ayarları okur — kapalıysa varsayılan `standaloneMode: false` (tam entegre mod) döner. */
export async function getSettings(actor: Actor, repo: SettingsRepo): Promise<FlexosSettings> {
  const existing = await repo.get(actor.tenantId);
  return existing ?? { tenantId: actor.tenantId, standaloneMode: false };
}

export interface UpdateSettingsInput {
  standaloneMode: boolean;
}

/**
 * Eğitmen "tek başına" switch'ini değiştirir — sistem-genelinde tek anahtar,
 * yalnız `role.manage` (admin) yetkisiyle açılır/kapanır.
 */
export async function updateSettings(
  actor: Actor,
  input: UpdateSettingsInput,
  repo: SettingsRepo,
): Promise<FlexosSettings> {
  if (!can(actor, "role.manage")) throw new ForbiddenError("role.manage");

  const settings: FlexosSettings = {
    tenantId: actor.tenantId,
    standaloneMode: input.standaloneMode,
    updatedAt: now(),
    updatedBy: actor.uid,
  };

  await repo.save(settings);
  return settings;
}
