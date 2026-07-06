import { widestScope } from "../access/can";
import type { Actor } from "../access/types";
import {
  DEFAULT_CERTIFICATE_SETTINGS,
  type CertificateSettings,
  type CertificateWeighting,
} from "../education/certificate-settings";
import { ForbiddenError, ValidationError } from "../errors";
import type { CertificateSettingsRepo } from "../repo/certificate-settings-repo";

const now = () => new Date().toISOString();

/**
 * Ayarları okur — İKİ KATMANLI:
 *  - Aktörün `certificate.settings.write` yetkisi **self** scope'ta ise (standalone
 *    modda eğitmen) önce KENDİ override'ına bakılır; varsa o döner (hem `project`
 *    hem `exam` bloğuyla — kısmi/alan-bazlı birleştirme YOK, kayıt bütün döner).
 *  - Yoksa (ya da aktör org-scope'ta ise — Op/Admin/Full mod eğitmeni) tenant
 *    varsayılanına düşülür; o da yoksa sabit varsayılan (proje: açık %70/%30,
 *    sınav: kapalı %100) döner.
 * Herhangi bir kimlikli aktör okuyabilir — gating yok (Sertifika Notu bunu tüketir).
 */
export async function getCertificateSettings(actor: Actor, repo: CertificateSettingsRepo): Promise<CertificateSettings> {
  if (widestScope(actor, "certificate.settings.write") === "self") {
    const own = await repo.getByTrainer(actor.tenantId, actor.uid);
    if (own) return own;
  }
  const tenantDefault = await repo.get(actor.tenantId);
  return tenantDefault ?? { tenantId: actor.tenantId, ...DEFAULT_CERTIFICATE_SETTINGS };
}

export interface UpdateCertificateSettingsInput {
  project: CertificateWeighting;
  exam: CertificateWeighting;
}

function validateWeighting(w: CertificateWeighting, label: string): void {
  if (!Number.isFinite(w.sertifikaPct) || w.sertifikaPct < 0 || w.sertifikaPct > 100) {
    throw new ValidationError(`${label} ağırlığı 0-100 arası olmalı.`);
  }
}

/**
 * Sertifika hesaplama ayarını değiştirir (proje + sınav blokları BİRLİKTE) — gated
 * `certificate.settings.write`.
 *  - **org scope** (Op/Admin) → tenant varsayılanını yazar (Full modda TEK geçerli kayıt,
 *    kendi kuralını vermemiş eğitmenler buna düşer).
 *  - **self scope** (standalone/Core modda eğitmen) → yalnız KENDİ override'ını yazar,
 *    diğer eğitmenleri/tenant varsayılanını etkilemez.
 */
export async function updateCertificateSettings(
  actor: Actor,
  input: UpdateCertificateSettingsInput,
  repo: CertificateSettingsRepo,
): Promise<CertificateSettings> {
  const scope = widestScope(actor, "certificate.settings.write");
  if (!scope) throw new ForbiddenError("certificate.settings.write");
  validateWeighting(input.project, "Proje Bazlı");
  validateWeighting(input.exam, "Sınav Bazlı");

  const settings: CertificateSettings = {
    tenantId: actor.tenantId,
    trainerId: scope === "self" ? actor.uid : undefined,
    project: input.project,
    exam: input.exam,
    updatedAt: now(),
    updatedBy: actor.uid,
  };

  await repo.save(settings);
  return settings;
}
