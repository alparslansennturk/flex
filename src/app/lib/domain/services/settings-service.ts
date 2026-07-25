import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { FlexosSettings } from "../core/settings";
import { ForbiddenError, ValidationError } from "../errors";
import type { SettingsRepo } from "../repo/settings-repo";

const now = () => new Date().toISOString();

/** Varsayılan günlük yemek ücreti (TL) — ayar dokümanı hiç oluşturulmamışsa. */
const DEFAULT_DAILY_MEAL_ALLOWANCE = 300;

/** Ayarları okur — eksik alanlar varsayılana düşer (`standaloneMode`/`transferRequiresManualSale`: false, tam entegre/otomatik-ek-satış modu). */
export async function getSettings(actor: Actor, repo: SettingsRepo): Promise<FlexosSettings> {
  const existing = await repo.get(actor.tenantId);
  return {
    tenantId: actor.tenantId,
    standaloneMode: existing?.standaloneMode ?? false,
    transferRequiresManualSale: existing?.transferRequiresManualSale ?? false,
    dailyMealAllowance: existing?.dailyMealAllowance ?? DEFAULT_DAILY_MEAL_ALLOWANCE,
    updatedAt: existing?.updatedAt,
    updatedBy: existing?.updatedBy,
  };
}

export interface UpdateSettingsInput {
  standaloneMode?: boolean;
  transferRequiresManualSale?: boolean;
  dailyMealAllowance?: number;
}

/**
 * Sistem anahtarlarını değiştirir (`standaloneMode` + `transferRequiresManualSale` +
 * `dailyMealAllowance`) — yalnız `role.manage` (admin) yetkisiyle, ÜÇÜ DE (2026-07-25
 * kararı — kullanıcı Core-mod self-manage denemesinden VAZGEÇTİ: "yemek ücreti adminde
 * görünecek sadece"). Kısmi güncelleme (READ-MERGE-WRITE): body'de gönderilmeyen alan
 * mevcut değerinde kalır — bağımsız ayarlar aynı dokümanı paylaşır, biri diğerini
 * sessizce sıfırlamamalı.
 */
export async function updateSettings(
  actor: Actor,
  input: UpdateSettingsInput,
  repo: SettingsRepo,
): Promise<FlexosSettings> {
  if (!can(actor, "role.manage")) throw new ForbiddenError("role.manage");

  if (input.dailyMealAllowance !== undefined && (!Number.isFinite(input.dailyMealAllowance) || input.dailyMealAllowance < 0)) {
    throw new ValidationError("dailyMealAllowance geçersiz — 0 veya pozitif bir sayı olmalı.");
  }

  const existing = await repo.get(actor.tenantId);

  const settings: FlexosSettings = {
    tenantId: actor.tenantId,
    standaloneMode: input.standaloneMode ?? existing?.standaloneMode ?? false,
    transferRequiresManualSale: input.transferRequiresManualSale ?? existing?.transferRequiresManualSale ?? false,
    dailyMealAllowance: input.dailyMealAllowance ?? existing?.dailyMealAllowance ?? DEFAULT_DAILY_MEAL_ALLOWANCE,
    updatedAt: now(),
    updatedBy: actor.uid,
  };

  await repo.save(settings);
  return settings;
}
